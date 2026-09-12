import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bootstrap,
  makeRoot,
  makeValidRun,
  repoRoot,
  runPython,
  writeJson,
} from "./matterFixture.ts";

describe("CrabLaw matter runtime", () => {
  test("bootstrap creates a private matter and blocks a later local conflict hit", async () => {
    const root = await makeRoot("crablaw-bootstrap-");
    expect((await bootstrap(root)).exitCode).toBe(0);
    const matterPath = path.join(root, "matters", "demo-matter", "matter.json");
    if (process.platform !== "win32") {
      // POSIX mode bits only carry meaning where the store enforces them; on
      // Windows every file reports 0o666 regardless of what the tool did.
      expect((await stat(matterPath)).mode & 0o077).toBe(0);
    }
    const overwrite = await bootstrap(root);
    expect(overwrite.exitCode).toBe(3);
    expect(overwrite.stdout).toContain("refusing to overwrite");
    expect(JSON.parse(overwrite.stdout).status).toBe("conflict");
    const hit = await bootstrap(root, "second-matter", "second-client", "示例客户");
    expect(hit.exitCode).toBe(10);
    const matter = JSON.parse(await readFile(path.join(root, "matters", "second-matter", "matter.json"), "utf8"));
    expect(matter.status).toBe("pending-conflict-review");
  });

  test("an existing store lock blocks a concurrent bootstrap writer", async () => {
    const root = await makeRoot("crablaw-lock-");
    await writeFile(path.join(root, ".matter-store.lock"), "held by test\n");
    const result = await bootstrap(root);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("locked");
  });

  test("a complete synthetic run passes strict source and cross-reference validation", async () => {
    const fixture = await makeValidRun();
    const result = runPython("validate_run.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
      "--strict",
      "--require-verified-source",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
  });

  test("the dependency-free schema validator enforces the required client party", async () => {
    const root = await makeRoot("crablaw-schema-");
    const file = path.join(root, "parties.json");
    await writeJson(file, {
      matterId: "demo-matter",
      parties: [{ role: "counterparty", displayName: "只有相对方" }],
    });
    const result = runPython("validate_json.py", [
      "--schema", path.join(repoRoot, "plugins", "crablaw-cn", "matter-core", "schemas", "parties.schema.json"),
      "--file", file,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("matching contains");
  });

  test("changed document bytes fail validation and sync marks the dependent issue stale", async () => {
    const fixture = await makeValidRun();
    await writeFile(fixture.inputPath, "changed bytes\n");
    const failed = runPython("validate_run.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
      "--strict",
    ]);
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toContain("sha256 does not match");

    const synced = runPython("sync_run_manifest.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
      "--apply",
    ]);
    expect(synced.exitCode, synced.stdout).toBe(0);
    const manifest = JSON.parse(await readFile(path.join(fixture.runDir, "run-manifest.json"), "utf8"));
    expect(manifest.status).toBe("stale");
    expect(manifest.staleIssueIds).toContain("issue-delivery");
    const stillBlocked = runPython("validate_run.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
      "--strict",
    ]);
    expect(stillBlocked.exitCode).toBe(1);
    expect(stillBlocked.stderr).toContain("strict validation blocks stale");
  });

  test("path traversal in the document index is rejected", async () => {
    const fixture = await makeValidRun();
    const indexPath = path.join(fixture.runDir, "document-index.json");
    const index = JSON.parse(await readFile(indexPath, "utf8"));
    index.documents[0].path = "../../outside.txt";
    await writeJson(indexPath, index);
    const result = runPython("validate_run.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/pattern|escapes|invalid or unreadable/);
  });

  test("a model-knowledge tag cannot point only to a verified official source", async () => {
    const fixture = await makeValidRun();
    const findingsPath = path.join(fixture.runDir, "analyzer-findings.json");
    const findings = JSON.parse(await readFile(findingsPath, "utf8"));
    findings.findings[0].citationTag = "[模型知识-待核]";
    await writeJson(findingsPath, findings);
    const result = runPython("validate_run.py", [
      "--root", fixture.root,
      "--matter-id", "demo-matter",
      "--run-id", "run-001",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("source-needs-check");
  });
});
