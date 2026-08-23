import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const script = path.resolve(
  import.meta.dir,
  "..",
  "scripts",
  "validate-mirror-release-gate.py",
);
const sha = "a".repeat(40);
const runId = 123456789;
const fixtures: string[] = [];

afterAll(async () => {
  await Promise.all(
    fixtures.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function invoke(runJson: string, overrides: Record<string, string> = {}) {
  const values = {
    expectedSha: sha,
    dispatchSha: sha,
    checkedOutSha: sha,
    originMainSha: sha,
    ...overrides,
  };
  return Bun.spawnSync(
    [
      "python3",
      script,
      "--run-json",
      runJson,
      "--expected-run-id",
      String(runId),
      "--expected-sha",
      values.expectedSha,
      "--dispatch-sha",
      values.dispatchSha,
      "--checked-out-sha",
      values.checkedOutSha,
      "--origin-main-sha",
      values.originMainSha,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
}

async function evidence(overrides: Record<string, unknown> = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mirror-release-gate-"));
  fixtures.push(root);
  const file = path.join(root, "run.json");
  await writeFile(
    file,
    JSON.stringify({
      id: runId,
      event: "workflow_dispatch",
      head_branch: "main",
      head_sha: sha,
      status: "completed",
      conclusion: "success",
      path: ".github/workflows/ci.yml",
      repository: { full_name: "acosmi/CrabCode-Plugin" },
      head_repository: { full_name: "acosmi/CrabCode-Plugin" },
      actor: { login: "release-approver" },
      html_url: `https://github.com/acosmi/CrabCode-Plugin/actions/runs/${runId}`,
      ...overrides,
    }),
  );
  return file;
}

describe("mirror release evidence gate", () => {
  test("accepts only exact successful workflow_dispatch main CI", async () => {
    const result = invoke(await evidence());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('"ciRunId": 123456789');
    expect(result.stdout.toString()).toContain('"actor": "release-approver"');
  });

  test("rejects a historical push run", async () => {
    const result = invoke(await evidence({ event: "push" }));
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('"expected": "workflow_dispatch"');
  });

  test("rejects CI SHA mismatch", async () => {
    const result = invoke(await evidence({ head_sha: "b".repeat(40) }));
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('"head_sha"');
  });

  test("rejects stale or advanced origin/main", async () => {
    const result = invoke(await evidence(), { originMainSha: "c".repeat(40) });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("origin/main is stale or advanced");
  });

  test("rejects a different run ID or weakened conclusion", async () => {
    const wrongRun = invoke(await evidence({ id: runId + 1 }));
    expect(wrongRun.exitCode).not.toBe(0);
    expect(wrongRun.stderr.toString()).toContain('"id"');

    const failed = invoke(await evidence({ conclusion: "failure" }));
    expect(failed.exitCode).not.toBe(0);
    expect(failed.stderr.toString()).toContain('"conclusion"');
  });
});
