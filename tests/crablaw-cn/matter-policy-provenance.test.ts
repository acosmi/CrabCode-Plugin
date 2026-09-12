import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  bootstrap,
  bootstrapArgs,
  makeRoot,
  makeValidRun,
  readJson,
  readSources,
  repoRoot,
  runPython,
  writeJson,
  writeSources,
  type RunFixture,
} from "./matterFixture.ts";

const HEX64 = /^[a-f0-9]{64}$/;
const PLUGIN_DEFAULT_POLICY = path.join(
  repoRoot,
  "plugins",
  "crablaw-cn",
  "matter-core",
  "conflict-policy.json",
);

type Disposition = "lawyer-review-required" | "informational";

function policyWith(overrides: Partial<Record<string, Disposition>>, policyVersion = "2026-09-12-firm") {
  const rule = (relation: string): { disposition: Disposition } => ({
    disposition: overrides[relation] ?? "lawyer-review-required",
  });
  return {
    schemaVersion: 1,
    policyVersion,
    approvedBy: "王律师（合成测试签发）",
    approvedAt: "2026-09-12",
    rules: {
      "same-side-existing-client": rule("same-side-existing-client"),
      "potential-adverse": rule("potential-adverse"),
      "name-match-unclassified": rule("name-match-unclassified"),
    },
  };
}

function storePolicyPath(root: string): string {
  return path.join(root, "conflict-policy.json");
}

function conflictRecord(root: string, matterId: string) {
  return readJson(path.join(root, "matters", matterId, "conflict-check.json"));
}

/**
 * The screening record is only schema-checked by `validate_run.py`, which needs a
 * whole run. A screened matter that never reaches a run would otherwise never have
 * its new `hits[].policyDisposition` / `informationalHits` / `policy` blocks checked
 * against the schema at all, so check them here, directly.
 */
function validateConflictRecord(root: string, matterId: string) {
  return runPython("validate_json.py", [
    "--schema", path.join(repoRoot, "plugins", "crablaw-cn", "matter-core", "schemas", "conflict-check.schema.json"),
    "--file", path.join(root, "matters", matterId, "conflict-check.json"),
  ]);
}

function validateRun(fixture: RunFixture, extra: string[] = []) {
  return runPython("validate_run.py", [
    "--root", fixture.root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    ...extra,
  ]);
}

async function patchPermissions(fixture: RunFixture, crossMatterAccess: unknown): Promise<void> {
  const file = path.join(fixture.matterDir, "permissions.json");
  const permissions = await readJson(file);
  permissions.crossMatterAccess = crossMatterAccess;
  await writeJson(file, permissions);
}

async function addImportedSource(fixture: RunFixture, importedFrom?: Record<string, unknown>): Promise<void> {
  const rows = await readSources(fixture);
  const existing = rows.findIndex((row) => row.sourceId === "src-imported");
  const row: Record<string, unknown> = {
    sourceId: "src-imported",
    matterId: "other-matter",
    sourceType: "internal-knowledge",
    title: "另一事项的内部记录",
    retrievedAt: "2026-08-21",
    confidentiality: "standard",
    accessScope: "经授权的跨事项引用",
    status: "unreviewed",
  };
  if (importedFrom) {
    row.importedFrom = importedFrom;
  }
  if (existing >= 0) {
    rows[existing] = row;
  } else {
    rows.push(row);
  }
  await writeSources(fixture, rows);
}

describe("what a conflict match means comes from a lawyer-issued policy", () => {
  test("the shipped default sends every relation to lawyer review", async () => {
    const root = await makeRoot("crablaw-policy-default-");
    expect((await bootstrap(root, "matter-one", "demo-client", "示例供应商")).exitCode).toBe(0);

    const repeat = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-two",
      clientId: "demo-client",
      clientName: "示例客户",
      counterparty: "另一供应商",
    }));
    expect(repeat.exitCode, repeat.stdout).toBe(10);
    const payload = JSON.parse(repeat.stdout);
    expect(payload.conflictStatus).toBe("hit-review-required");
    expect(payload.policy.source).toBe("plugin-default");
    expect(payload.informationalHitCount).toBe(0);

    const record = await conflictRecord(root, "matter-two");
    expect(record.hits.length).toBeGreaterThan(0);
    expect(record.hits.every((hit: any) => hit.policyDisposition === "lawyer-review-required")).toBe(true);
    expect(record.informationalHits).toEqual([]);
    expect(record.policy.policyVersion).toBe("2026-09-12-default");
    expect(record.policy.policyDigest).toMatch(HEX64);
    expect(record.policy.approvedBy.length).toBeGreaterThan(0);
    expect(record.lawyerConfirmation.status).toBe("not-reviewed");
    const checked = validateConflictRecord(root, "matter-two");
    expect(checked.exitCode, checked.stderr).toBe(0);
  });

  test("a firm policy can call one relation informational without hiding it", async () => {
    const root = await makeRoot("crablaw-policy-firm-");
    await writeJson(storePolicyPath(root), policyWith({ "same-side-existing-client": "informational" }));
    expect((await bootstrap(root, "matter-one", "demo-client", "示例供应商")).exitCode).toBe(0);

    const repeat = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-two",
      clientId: "demo-client",
      clientName: "示例客户",
      counterparty: "另一供应商",
    }));
    expect(repeat.exitCode, repeat.stdout).toBe(0);
    expect(JSON.parse(repeat.stdout).conflictStatus).toBe("no-hit");
    expect(JSON.parse(repeat.stdout).policy.source).toBe("store");

    const record = await conflictRecord(root, "matter-two");
    expect(record.status).toBe("no-hit");
    expect(record.hits).toEqual([]);
    // Downgraded, never deleted: the lawyer still sees exactly what matched.
    expect(record.informationalHits.length).toBeGreaterThan(0);
    expect(record.informationalHits.every((hit: any) => hit.relation === "same-side-existing-client")).toBe(true);
    expect(record.informationalHits.every((hit: any) => hit.policyDisposition === "informational")).toBe(true);
    expect(record.informationalHits.some((hit: any) => hit.matchedValue === "示例客户")).toBe(true);
    expect(record.lawyerConfirmation.status).toBe("not-reviewed");
    const checked = validateConflictRecord(root, "matter-two");
    expect(checked.exitCode, checked.stderr).toBe(0);

    // Positive control: the relation the policy did not loosen still blocks.
    const adverse = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-three",
      clientId: "third-client",
      clientName: "第三客户",
      counterparty: "示例客户",
    }));
    expect(adverse.exitCode, adverse.stdout).toBe(10);
    const adverseRecord = await conflictRecord(root, "matter-three");
    expect(adverseRecord.status).toBe("hit-review-required");
    expect(adverseRecord.hits.every((hit: any) => hit.relation === "potential-adverse")).toBe(true);
  });

  test("a policy that leaves a relation unclassified stops the bootstrap entirely", async () => {
    const root = await makeRoot("crablaw-policy-broken-");
    const incomplete = policyWith({});
    delete (incomplete.rules as Record<string, unknown>)["name-match-unclassified"];
    await writeJson(storePolicyPath(root), incomplete);

    const refused = await bootstrap(root, "matter-one");
    expect(refused.exitCode, refused.stdout).toBe(11);
    const payload = JSON.parse(refused.stdout);
    expect(payload.status).toBe("policy-unusable");
    expect(payload.error).toContain("name-match-unclassified");
    // Nothing was screened, so nothing may have been created.
    expect(existsSync(path.join(root, "matters", "matter-one"))).toBe(false);

    // Positive control: the same store opens once the policy covers every relation.
    await writeJson(storePolicyPath(root), policyWith({}));
    const created = await bootstrap(root, "matter-one");
    expect(created.exitCode, created.stdout).toBe(0);
    expect(JSON.parse(created.stdout).policy.source).toBe("store");
  });

  test("a run is refused once its screening policy is no longer the one in force", async () => {
    const fixture = await makeValidRun();
    const clean = validateRun(fixture, ["--strict"]);
    expect(clean.exitCode, clean.stderr).toBe(0);

    // Byte-for-byte the shipped default, reformatted: the digest is over content,
    // so where the policy came from must not change the answer.
    const shipped = await readJson(PLUGIN_DEFAULT_POLICY);
    await writeJson(storePolicyPath(fixture.root), shipped);
    const sameContent = validateRun(fixture, ["--strict"]);
    expect(sameContent.exitCode, sameContent.stderr).toBe(0);

    await writeJson(storePolicyPath(fixture.root), { ...shipped, policyVersion: "2026-10-01-firm" });
    const changed = validateRun(fixture);
    expect(changed.exitCode).toBe(1);
    expect(changed.stderr).toContain("different policy");
    expect(changed.stderr).toContain("rerun conflict screening");

    // Positive control: restoring the policy in force clears it.
    await writeJson(storePolicyPath(fixture.root), shipped);
    const restored = validateRun(fixture, ["--strict"]);
    expect(restored.exitCode, restored.stderr).toBe(0);
  });

  test("a screening record from before policy binding is rerun, not reinterpreted", async () => {
    const fixture = await makeValidRun();
    const file = path.join(fixture.matterDir, "conflict-check.json");
    const record = await readJson(file);
    const bound = record.policy;
    delete record.policy;
    await writeJson(file, record);

    const legacy = validateRun(fixture);
    expect(legacy.exitCode).toBe(1);
    expect(legacy.stderr).toContain("conflict screening predates policy binding; rerun");

    // Positive control: the record with its policy block passes.
    record.policy = bound;
    await writeJson(file, record);
    expect(validateRun(fixture, ["--strict"]).exitCode).toBe(0);
  });
});

describe("a record from another matter needs live authorization to be here", () => {
  test("provenance, authorization, authorizer and expiry are each load-bearing", async () => {
    const fixture = await makeValidRun();

    await addImportedSource(fixture);
    const noProvenance = validateRun(fixture);
    expect(noProvenance.exitCode).toBe(1);
    expect(noProvenance.stderr).toContain(
      "source src-imported is imported from matter other-matter without valid cross-matter authorization",
    );

    const importedFrom = {
      matterId: "other-matter",
      sourceId: "src-origin",
      importedBy: "test.user",
      importedAt: "2026-09-01",
      authorizedBy: "王律师",
    };
    await addImportedSource(fixture, importedFrom);
    const notEnabled = validateRun(fixture);
    expect(notEnabled.exitCode).toBe(1);
    expect(notEnabled.stderr).toContain("does not enable crossMatterAccess");

    await patchPermissions(fixture, {
      enabled: true,
      authorizedBy: "张律师",
      reason: "合成测试授权",
      expiresAt: "2026-12-31",
    });
    const wrongAuthorizer = validateRun(fixture);
    expect(wrongAuthorizer.exitCode).toBe(1);
    expect(wrongAuthorizer.stderr).toContain("is not this matter's authorizer");

    await patchPermissions(fixture, {
      enabled: true,
      authorizedBy: "王律师",
      reason: "合成测试授权",
      expiresAt: "2026-08-31",
    });
    const expired = validateRun(fixture);
    expect(expired.exitCode).toBe(1);
    expect(expired.stderr).toContain("expired on 2026-08-31");

    // Positive control: a live authorization by the right person admits the record.
    await patchPermissions(fixture, {
      enabled: true,
      authorizedBy: "王律师",
      reason: "合成测试授权",
      expiresAt: "2026-12-31",
    });
    const authorized = validateRun(fixture, ["--strict"]);
    expect(authorized.exitCode, authorized.stderr).toBe(0);
  });

  test("an imported record keeps the confidentiality it was granted", async () => {
    const fixture = await makeValidRun();
    await patchPermissions(fixture, {
      enabled: true,
      authorizedBy: "王律师",
      reason: "合成测试授权",
      expiresAt: "2026-12-31",
    });

    const rows = await readSources(fixture);
    const document = rows.find((row) => row.sourceId === "src-document")!;
    document.matterId = "other-matter";
    document.confidentiality = "heightened";
    document.importedFrom = {
      matterId: "other-matter",
      sourceId: "src-origin",
      importedBy: "test.user",
      importedAt: "2026-09-01",
      authorizedBy: "王律师",
    };
    await writeSources(fixture, rows);

    const relabelled = validateRun(fixture);
    expect(relabelled.exitCode).toBe(1);
    expect(relabelled.stderr).toContain("does not match");
    expect(relabelled.stderr).toContain("imported source record");

    // Positive control: matching confidentiality is accepted.
    document.confidentiality = "standard";
    await writeSources(fixture, rows);
    const aligned = validateRun(fixture, ["--strict"]);
    expect(aligned.exitCode, aligned.stderr).toBe(0);
  });

  test("a run payload that names another matter is a mis-file, not a stale field", async () => {
    const fixture = await makeValidRun();
    const file = path.join(fixture.runDir, "fact-chronology.json");
    const chronology = await readJson(file);
    chronology.matterId = "other-matter";
    await writeJson(file, chronology);

    const mismatched = validateRun(fixture);
    expect(mismatched.exitCode).toBe(1);
    expect(mismatched.stderr).toContain("fact-chronology matterId mismatch");

    // Positive control: the same file passes when it names this matter.
    chronology.matterId = "demo-matter";
    await writeJson(file, chronology);
    expect(validateRun(fixture, ["--strict"]).exitCode).toBe(0);
  });

  test("the ownership check reaches the case-comparison list too", async () => {
    const fixture = await makeValidRun();
    const file = path.join(fixture.runDir, "case-comparison", "issue-delivery.json");
    const comparison = await readJson(file);
    comparison.matterId = "other-matter";
    await writeJson(file, comparison);

    const mismatched = validateRun(fixture);
    expect(mismatched.exitCode).toBe(1);
    expect(mismatched.stderr).toContain("case-comparisons matterId mismatch");

    await rm(file);
    const removed = validateRun(fixture);
    expect(removed.stderr).not.toContain("case-comparisons matterId mismatch");
  });
});
