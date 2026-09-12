import { describe, expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bootstrap,
  bootstrapArgs,
  collectPython,
  makeRoot,
  makeValidRun,
  readJson,
  readSources,
  runPython,
  scriptRoot,
  spawnPython,
  writeJson,
  writeSources,
  type RunFixture,
} from "./matterFixture.ts";

function pythonHostname(): string {
  const result = Bun.spawnSync(["python3", "-c", "import socket; print(socket.gethostname())"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return new TextDecoder().decode(result.stdout).trim();
}

function syncRun(fixture: RunFixture, apply = true) {
  return runPython("sync_run_manifest.py", [
    "--root", fixture.root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    ...(apply ? ["--apply"] : []),
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

async function conflictRecord(root: string, matterId: string) {
  return readJson(path.join(root, "matters", matterId, "conflict-check.json"));
}

describe("conflict screening coverage is reported, never silently skipped", () => {
  test("R01: a corrupt client record turns the screen partial instead of passing as no-hit", async () => {
    const root = await makeRoot("crablaw-corrupt-");
    expect((await bootstrap(root, "matter-one")).exitCode).toBe(0);

    const brokenPath = path.join(root, "clients", "broken-client", "client.json");
    await mkdir(path.dirname(brokenPath), { recursive: true });
    await writeFile(brokenPath, "{ this is not json");

    const screened = await bootstrap(root, "matter-two", "second-client", "无关对手方");
    expect(screened.exitCode).toBe(10);
    const payload = JSON.parse(screened.stdout);
    expect(payload.conflictStatus).toBe("coverage-incomplete");
    expect(payload.substantiveWorkAllowed).toBe(false);
    expect(payload.coverage.status).toBe("partial");
    expect(payload.coverage.corrupt.join("\n")).toContain("clients/broken-client/client.json");

    const record = await conflictRecord(root, "matter-two");
    expect(record.status).toBe("coverage-incomplete");
    expect(record.coverage.corrupt.length).toBe(1);
    const matter = await readJson(path.join(root, "matters", "matter-two", "matter.json"));
    expect(matter.status).toBe("pending-conflict-review");

    // Positive control: the very same scan reports complete once the record parses.
    await writeJson(brokenPath, {
      clientId: "broken-client",
      displayName: "完好客户",
      status: "active",
      confidentiality: "standard",
    });
    const repaired = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-three",
      clientId: "third-client",
      clientName: "第三客户",
      counterparty: "另一无关对手方",
    }));
    expect(repaired.exitCode, repaired.stdout).toBe(0);
    const repairedPayload = JSON.parse(repaired.stdout);
    expect(repairedPayload.conflictStatus).toBe("no-hit");
    expect(repairedPayload.coverage.status).toBe("complete");
    expect(repairedPayload.coverage.corrupt).toEqual([]);
    expect(repairedPayload.coverage.scanned).toBeGreaterThan(0);
  });

  test("X4: a client record that is valid JSON but not an object is a typed coverage gap, not a crash", async () => {
    const root = await makeRoot("crablaw-typeerror-");
    expect((await bootstrap(root, "matter-one")).exitCode).toBe(0);
    const arrayPath = path.join(root, "clients", "array-client", "client.json");
    await mkdir(path.dirname(arrayPath), { recursive: true });
    await writeFile(arrayPath, "[]\n");

    const screened = await bootstrap(root, "matter-two", "second-client", "无关对手方");
    expect(screened.stderr).toBe("");
    expect(screened.exitCode).toBe(10);
    const payload = JSON.parse(screened.stdout);
    expect(payload.conflictStatus).toBe("coverage-incomplete");
    expect(payload.coverage.status).toBe("partial");
    expect(payload.coverage.typeErrors.join("\n")).toContain("clients/array-client/client.json");
    expect(payload.coverage.typeErrors.join("\n")).toContain("expected a JSON object, got list");
    expect(payload.coverage.corrupt).toEqual([]);
  });

  test("X1: archived matters are inside the screening scope and can produce a hit", async () => {
    const root = await makeRoot("crablaw-archived-");
    expect((await bootstrap(root, "matter-one", "demo-client", "归档对手方")).exitCode).toBe(0);

    await mkdir(path.join(root, "matters", "_archived"), { recursive: true });
    await rename(path.join(root, "matters", "matter-one"), path.join(root, "matters", "_archived", "matter-one"));

    const screened = await bootstrap(root, "matter-two", "second-client", "归档对手方");
    expect(screened.exitCode).toBe(10);
    const payload = JSON.parse(screened.stdout);
    expect(payload.coverage.status).toBe("complete");
    expect(payload.coverage.scopes).toContain("matters/_archived");
    expect(payload.conflictStatus).toBe("hit-review-required");

    const record = await conflictRecord(root, "matter-two");
    const archivedHits = record.hits.filter((hit: any) =>
      hit.source === "matters/_archived/matter-one/parties.json");
    expect(archivedHits.length).toBeGreaterThan(0);
    expect(archivedHits[0].matchedValue).toBe("归档对手方");

    // Positive control: an unrelated name is still a clean no-hit after archiving.
    const clean = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-three",
      clientId: "third-client",
      clientName: "第三客户",
      counterparty: "完全不相关的对手方",
    }));
    expect(clean.exitCode, clean.stdout).toBe(0);
    expect(JSON.parse(clean.stdout).conflictStatus).toBe("no-hit");
  });

  test("X2: a directory junction inside the store is refused and reported, not skipped", async () => {
    const root = await makeRoot("crablaw-junction-");
    expect((await bootstrap(root, "matter-one")).exitCode).toBe(0);

    const outside = await makeRoot("crablaw-outside-");
    await writeJson(path.join(outside, "client.json"), {
      clientId: "outside-client",
      displayName: "根外客户",
      status: "active",
      confidentiality: "standard",
    });
    // The leaf file is a real file; only the directory above it redirects.
    symlinkSync(outside, path.join(root, "clients", "linked"), "junction");
    expect((await stat(path.join(root, "clients", "linked", "client.json"))).isFile()).toBe(true);

    const screened = await bootstrap(root, "matter-two", "second-client", "无关对手方");
    expect(screened.exitCode).toBe(10);
    const payload = JSON.parse(screened.stdout);
    expect(payload.conflictStatus).toBe("coverage-incomplete");
    expect(payload.coverage.status).toBe("partial");
    const refused = payload.coverage.refused.join("\n");
    expect(refused).toContain("clients/linked/client.json");
    expect(refused).toMatch(/symbolic link|escapes the matter-store root/);
    expect(payload.coverage.corrupt).toEqual([]);

    // A junction whose target stays inside the root passes the containment test,
    // so only the per-level link check can catch it.
    await rm(path.join(root, "clients", "linked"), { recursive: true, force: true });
    const realClient = path.join(root, "clients", "real-client");
    await writeJson(path.join(realClient, "client.json"), {
      clientId: "real-client",
      displayName: "真实客户",
      status: "active",
      confidentiality: "standard",
    });
    symlinkSync(realClient, path.join(root, "clients", "aliased"), "junction");
    const insideRoot = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-inside",
      clientId: "inside-client",
      clientName: "内部客户",
      counterparty: "无关对手方二号",
    }));
    expect(insideRoot.exitCode).toBe(10);
    const insidePayload = JSON.parse(insideRoot.stdout);
    expect(insidePayload.conflictStatus).toBe("coverage-incomplete");
    expect(insidePayload.coverage.refused.join("\n")).toContain("clients/aliased/client.json");
    expect(insidePayload.coverage.refused.join("\n")).toContain("crosses a symbolic link");
    await rm(path.join(root, "clients", "aliased"), { recursive: true, force: true });
    await rm(realClient, { recursive: true, force: true });

    // Positive control: without the redirection the same store scans completely.
    const clean = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-three",
      clientId: "third-client",
      clientName: "第三客户",
      counterparty: "另一无关对手方",
    }));
    expect(clean.exitCode, clean.stdout).toBe(0);
    expect(JSON.parse(clean.stdout).coverage.status).toBe("complete");
    expect(JSON.parse(clean.stdout).coverage.refused).toEqual([]);
  });

  test("R02: a repeat client with a new counterparty carries roles, source and relation", async () => {
    const root = await makeRoot("crablaw-relation-");
    expect((await bootstrap(root, "matter-one", "demo-client", "示例供应商")).exitCode).toBe(0);

    const second = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-two",
      clientId: "demo-client",
      clientName: "示例客户",
      counterparty: "另一供应商",
    }));
    expect(second.exitCode).toBe(10);
    expect(JSON.parse(second.stdout).conflictStatus).toBe("hit-review-required");

    const record = await conflictRecord(root, "matter-two");
    expect(record.status).toBe("hit-review-required");
    // Not a final decision and not auto-cleared.
    expect(record.lawyerConfirmation.status).toBe("not-reviewed");
    const sameSide = record.hits.filter((hit: any) => hit.relation === "same-side-existing-client");
    expect(sameSide.length).toBeGreaterThan(0);
    for (const hit of record.hits) {
      expect(typeof hit.matchedValue).toBe("string");
      expect(typeof hit.existingRole).toBe("string");
      expect(typeof hit.newRole).toBe("string");
      expect(["same-side-existing-client", "potential-adverse", "name-match-unclassified"])
        .toContain(hit.relation);
      expect(hit.risk).toBe("unknown");
    }
    expect(sameSide.some((hit: any) => hit.matchedValue === "示例客户" && hit.newRole === "client")).toBe(true);
    expect(record.hits.some((hit: any) => hit.source === "clients/demo-client/client.json")).toBe(true);
    expect(record.hits.some((hit: any) => hit.source === "matters/matter-one/parties.json")).toBe(true);

    // Positive control: the existing client showing up as the new counterparty is adverse.
    const adverse = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "matter-three",
      clientId: "third-client",
      clientName: "第三客户",
      counterparty: "示例客户",
    }));
    expect(adverse.exitCode).toBe(10);
    const adverseRecord = await conflictRecord(root, "matter-three");
    const adverseHits = adverseRecord.hits.filter((hit: any) => hit.relation === "potential-adverse");
    expect(adverseHits.length).toBeGreaterThan(0);
    expect(adverseHits.every((hit: any) => hit.newRole === "counterparty")).toBe(true);
  });
});

describe("matter creation is exclusive and crash-visible", () => {
  test("R03: two simultaneous bootstraps of one matter id create it exactly once", async () => {
    const root = await makeRoot("crablaw-race-");
    const args = bootstrapArgs(root, { matterId: "raced-matter", title: "第一个写入者" });
    const [first, second] = await Promise.all([
      collectPython(spawnPython("bootstrap_matter.py", args)),
      collectPython(spawnPython("bootstrap_matter.py", args)),
    ]);

    const outcomes = [first, second].map((result) => ({
      code: result.exitCode,
      status: JSON.parse(result.stdout).status,
      raw: result.stdout,
    }));
    const created = outcomes.filter((item) => item.status === "created");
    const conflicted = outcomes.filter((item) => item.status === "conflict");
    expect(created.length, JSON.stringify(outcomes)).toBe(1);
    expect(conflicted.length, JSON.stringify(outcomes)).toBe(1);
    const winner = created[0]!;
    const loser = conflicted[0]!;
    expect(loser.code).toBe(3);
    expect([0, 10]).toContain(winner.code);
    expect(loser.raw).toContain("refusing to overwrite");

    const matterPath = path.join(root, "matters", "raced-matter", "matter.json");
    const winnerBytes = await readFile(matterPath);
    const matter = JSON.parse(winnerBytes.toString("utf8"));
    expect(matter.matterId).toBe("raced-matter");
    expect(matter.title).toBe("第一个写入者");

    // A later writer with different content still cannot touch the winner's bytes.
    const late = runPython("bootstrap_matter.py", bootstrapArgs(root, {
      matterId: "raced-matter",
      title: "第二个写入者",
    }));
    expect(late.exitCode).toBe(3);
    expect(Buffer.compare(await readFile(matterPath), winnerBytes)).toBe(0);
  });

  test("X3: a lock left behind by a killed process is reclaimed, and a live lock never is", async () => {
    const root = await makeRoot("crablaw-stalelock-");
    const lockPath = path.join(root, ".matter-store.lock");
    const holder = Bun.spawnSync([
      "python3",
      "-c",
      [
        "import os, sys",
        "from pathlib import Path",
        "from _matter_common import file_lock",
        "cm = file_lock(Path(sys.argv[1]))",
        "cm.__enter__()",
        "os._exit(19)",
      ].join("\n"),
      lockPath,
    ], { cwd: scriptRoot, stdout: "pipe", stderr: "pipe" });
    expect(holder.exitCode, new TextDecoder().decode(holder.stderr)).toBe(19);
    const leftover = await readFile(lockPath, "utf8");
    expect(leftover).toContain("pid=");
    expect(leftover).toContain("host=");

    const recovered = await bootstrap(root, "after-crash");
    expect(recovered.exitCode, recovered.stdout).toBe(0);
    expect(await Bun.file(lockPath).exists()).toBe(false);

    // Negative control 1: an old lock owned by a living process is not reclaimed,
    // which is what separates "owner is gone" from "the file looks old".
    const liveRoot = await makeRoot("crablaw-livelock-");
    const livePath = path.join(liveRoot, ".matter-store.lock");
    await writeFile(livePath, `pid=${process.pid} host=${pythonHostname()} created=2020-01-01T00:00:00Z\n`);
    const anHourAgo = new Date(Date.now() - 3_600_000);
    await utimes(livePath, anHourAgo, anHourAgo);
    const blocked = await bootstrap(liveRoot, "blocked-matter");
    expect(blocked.exitCode).toBe(2);
    expect(blocked.stdout).toContain("locked");
    expect(await Bun.file(livePath).exists()).toBe(true);

    // Negative control 2: a dead pid recorded on another host is not ours to judge.
    const foreignRoot = await makeRoot("crablaw-foreignlock-");
    const foreignPath = path.join(foreignRoot, ".matter-store.lock");
    await writeFile(foreignPath, "pid=999999 host=some-other-host created=2020-01-01T00:00:00Z\n");
    const foreign = await bootstrap(foreignRoot, "foreign-matter");
    expect(foreign.exitCode).toBe(2);
    expect(foreign.stdout).toContain("locked");
    expect(await Bun.file(foreignPath).exists()).toBe(true);
  });

  test("an interrupted bootstrap stays pending and blocks both reuse and validation", async () => {
    const fixture = await makeValidRun();
    const pendingMarker = path.join(fixture.matterDir, ".pending");

    const before = validateRun(fixture, ["--strict", "--require-verified-source"]);
    expect(before.exitCode, before.stderr).toBe(0);

    await writeFile(pendingMarker, "");
    const blocked = validateRun(fixture, ["--strict", "--require-verified-source"]);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toContain("matter is pending (incomplete bootstrap)");

    const rebootstrap = await bootstrap(fixture.root, "demo-matter");
    expect(rebootstrap.exitCode).toBe(3);
    expect(rebootstrap.stdout).toContain("matter is pending (incomplete bootstrap)");

    await rm(pendingMarker);
    const after = validateRun(fixture, ["--strict", "--require-verified-source"]);
    expect(after.exitCode, after.stderr).toBe(0);
  });
});

describe("staleness survives a second sync and follows source records", () => {
  test("X5: a second apply with no new change keeps the stale ledger", async () => {
    const fixture = await makeValidRun();
    await writeFile(fixture.inputPath, "changed bytes\n");

    const first = syncRun(fixture);
    expect(first.exitCode, first.stdout).toBe(0);
    const firstResult = JSON.parse(first.stdout);
    expect(firstResult.status).toBe("apply-ready");
    expect(firstResult.staleIssueIds).toContain("issue-delivery");

    const second = syncRun(fixture);
    expect(second.exitCode, second.stdout).toBe(0);
    const secondResult = JSON.parse(second.stdout);
    expect(secondResult.status).toBe("unchanged");
    expect(secondResult.changedDocumentIds).toEqual([]);
    expect(secondResult.staleIssueIds).toContain("issue-delivery");
    const manifest = await readJson(path.join(fixture.runDir, "run-manifest.json"));
    expect(manifest.staleIssueIds).toContain("issue-delivery");

    // Positive control: once the issue tree records the rerun, the mark clears.
    const issueTree = await readJson(path.join(fixture.runDir, "issue-tree.json"));
    issueTree.issues[0].status = "resolved-internal";
    await writeJson(path.join(fixture.runDir, "issue-tree.json"), issueTree);
    const third = syncRun(fixture);
    expect(third.exitCode, third.stdout).toBe(0);
    expect(JSON.parse(third.stdout).staleIssueIds).toEqual([]);
  });

  test("X7: editing only sources.jsonl makes the issues that rely on it stale", async () => {
    const fixture = await makeValidRun();

    // Control: the primed baseline reports nothing changed.
    const baseline = syncRun(fixture);
    expect(baseline.exitCode, baseline.stdout).toBe(0);
    const baselineResult = JSON.parse(baseline.stdout);
    expect(baselineResult.status).toBe("unchanged");
    expect(baselineResult.changedSourceIds).toEqual([]);
    expect(baselineResult.staleIssueIds).toEqual([]);

    const rows = await readSources(fixture);
    const law = rows.find((row) => row.sourceId === "src-law");
    expect(law).toBeDefined();
    law!.effectiveStatus = "合成测试记录已被后续修订取代";
    await writeSources(fixture, rows);

    const synced = syncRun(fixture);
    expect(synced.exitCode, synced.stdout).toBe(0);
    const result = JSON.parse(synced.stdout);
    expect(result.status).toBe("apply-ready");
    expect(result.changedSourceIds).toEqual(["src-law"]);
    expect(result.changedDocumentIds).toEqual([]);
    expect(result.staleIssueIds).toContain("issue-delivery");

    const manifest = await readJson(path.join(fixture.runDir, "run-manifest.json"));
    expect(manifest.status).toBe("stale");
    expect(manifest.staleIssueIds).toContain("issue-delivery");
    const blocked = validateRun(fixture, ["--strict"]);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toContain("strict validation blocks stale");
  });
});

describe("[已核验-来源] requires an actually verified source", () => {
  async function withLawStatus(fixture: RunFixture, patch: Record<string, unknown>) {
    const rows = await readSources(fixture);
    const law = rows.find((row) => row.sourceId === "src-law")!;
    Object.assign(law, patch);
    await writeSources(fixture, rows);
  }

  for (const status of ["unreviewed", "unknown", "superseded"]) {
    test(`P-L2-a: status ${status} does not satisfy the verified-source tag`, async () => {
      const fixture = await makeValidRun();
      await withLawStatus(fixture, { status });
      const result = validateRun(fixture, ["--strict", "--require-verified-source"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("no verified official/case source");
    });
  }

  test("P-L2-a: a lawyer-reviewed official source still satisfies the tag", async () => {
    const fixture = await makeValidRun();
    await withLawStatus(fixture, { status: "lawyer-reviewed", reviewer: "王律师" });
    const result = validateRun(fixture, ["--strict", "--require-verified-source"]);
    expect(result.exitCode, result.stderr).toBe(0);
  });

  test("P-L2-a: source-needs-check still fails the tag", async () => {
    const fixture = await makeValidRun();
    await withLawStatus(fixture, { status: "source-needs-check" });
    const result = validateRun(fixture, ["--strict", "--require-verified-source"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no verified official/case source");
  });
});
