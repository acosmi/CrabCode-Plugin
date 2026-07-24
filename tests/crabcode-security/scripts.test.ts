import { describe, expect, test } from "bun:test";
import {
  access,
  mkdir,
  readFile,
  realpath,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createOwnedRenderedReport,
  createOwnedReportRun,
  PLUGIN_ROOT,
  requireSuccess,
  run,
  tempDir,
  writeScanMetaFixture,
  writeJson,
} from "./test-helpers.ts";

const scripts = path.join(PLUGIN_ROOT, "scripts");
const writeScanMeta = path.join(scripts, "write_scan_meta.py");
const renderReport = path.join(scripts, "render_report.py");
const patchArtifacts = path.join(scripts, "patch_artifacts.py");

async function pathExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function prepareSimplePatchRun(root: string): Promise<{
  report: string;
  patchesDir: string;
  patchDir: string;
  base: string;
}> {
  for (const [command, args] of [
    ["git", ["init", "-q"]],
    ["git", ["config", "user.email", "security-tests@example.invalid"]],
    ["git", ["config", "user.name", "Security Tests"]],
  ] as const) {
    requireSuccess(run(command, [...args], { cwd: root }), `${command} ${args.join(" ")}`);
  }
  await writeFile(path.join(root, "tracked.txt"), "base\n");
  requireSuccess(run("git", ["add", "--", "tracked.txt"], { cwd: root }), "git add");
  requireSuccess(
    run("git", ["commit", "-q", "-m", "patch base"], { cwd: root }),
    "git commit",
  );
  const base = run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim();
  const {
    products: report,
    sourceRoot,
  } = await createOwnedRenderedReport(root);
  await writeFile(
    path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl"),
    `${JSON.stringify({
      id: "F1",
      title: "No safe automatic fix",
      impact: "Unknown",
      file: "tracked.txt",
      line: 1,
      description: "The behavior contract is ambiguous.",
      exploit_scenario: "Unknown.",
      preconditions: [],
      category: "other",
      severity: "HIGH",
      confidence: "high",
      recommendation: "Review the caller contract.",
      cwe_id: "CWE-0",
      snippet: "base",
      symbol: "",
    })}\n`,
  );
  await writeJson(
    path.join(report, `CRABCODE-SECURITY-REVISION-${base.slice(0, 12)}.json`),
    {
      scan_root: sourceRoot,
      source_root: sourceRoot,
      products_dir: report,
      mode: "scan",
      revision: { versioned: true, commit: base, dirty: false },
      findings: { total: 1, high: 1, medium: 0, low: 0 },
      verification: { status: "verified" },
    },
  );
  const prepared = run(
    "python3",
    [
      patchArtifacts,
      "--prepare-run",
      report,
      root,
      "--base",
      base,
      "--selection",
      "F1",
    ],
    { cwd: root },
  );
  requireSuccess(prepared, "patch_artifacts.py --prepare-run");
  const record = JSON.parse(prepared.stdout);
  return {
    report: record.report_dir,
    patchesDir: record.patches_dir,
    patchDir: record.patch_dir,
    base,
  };
}

describe("write_scan_meta.py", () => {
  test("records the actual revision, inventory extent, namespace, and dirty state", async () => {
    const root = await tempDir("meta");
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "src", "app.py"), "print('ok')\n");
    await writeFile(path.join(root, "docs", "guide.md"), "# guide\n");

    for (const [command, args] of [
      ["git", ["init", "-q"]],
      ["git", ["config", "user.email", "security-tests@example.invalid"]],
      ["git", ["config", "user.name", "Security Tests"]],
      ["git", ["add", "src/app.py", "docs/guide.md"]],
      ["git", ["commit", "-q", "-m", "fixture"]],
    ] as const) {
      requireSuccess(run(command, [...args], { cwd: root }), `${command} ${args.join(" ")}`);
    }

    const commit = run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim();
    const { products: report, runDir } = await createOwnedReportRun(
      root,
      "20260723-120010-1111111111111111",
    );
    await writeFile(path.join(report, "ignored-product.txt"), "not user source\n");

    const first = run(
      "python3",
      [writeScanMeta, runDir, root, "--mode", "scan", "--effort", "high"],
      { cwd: root },
    );
    requireSuccess(first, "write_scan_meta.py");
    expect(first.stdout).toContain('top_level_dirs: ["docs", "src"]');

    const metaPath = path.join(runDir, "scan-meta.json");
    const meta = JSON.parse(await readFile(metaPath, "utf8"));
    expect(meta.agent).toBe("crabcode-security:crabcode-security");
    expect(meta.revision).toMatchObject({
      versioned: true,
      commit,
      dirty: false,
    });
    expect(meta.top_level_dirs).toEqual(["docs", "src"]);
    expect(meta.scope).toEqual([]);
    expect(meta.scan_root).toBe(await realpath(root));
    expect(meta.source_root).toBe(await realpath(root));
    expect(meta.report_dir).toBe(await realpath(report));
    expect(meta.analysis_root).toBe(await realpath(root));
    expect(meta.run_dir).toBe(await realpath(runDir));
    expect(meta.source_revision).toEqual(meta.revision);
    expect(meta.revision_source).toBe("tool-captured");
    expect(meta.snapshot_kind).toBe("live-source-compatibility");
    expect(meta.analysis_content).toMatchObject({
      algorithm: "sha256-path-mode-content-v1",
    });

    await writeFile(path.join(root, "actual-user-change.txt"), "dirty\n");
    const second = run(
      "python3",
      [writeScanMeta, runDir, root, "--mode", "changes", "--effort", "medium", "--base", "HEAD"],
      { cwd: root },
    );
    requireSuccess(second, "write_scan_meta.py dirty run");
    const dirtyMeta = JSON.parse(await readFile(metaPath, "utf8"));
    expect(dirtyMeta.revision.dirty).toBe(true);
    expect(dirtyMeta.revision.base).toBe("HEAD");
    expect(dirtyMeta.top_level_dirs).toBeNull();
  });
});

describe("render_report.py", () => {
  test("renders stable machine products, enforces vote confidence, and removes only a fenced run", async () => {
    const root = await tempDir("report");
    const {
      products,
      runDir,
      sourceRoot,
    } = await createOwnedReportRun(root);
    expect(
      await readFile(path.join(products, ".crabcode-security-owner.json"), "utf8"),
    ).toBe(await readFile(path.join(runDir, ".crabcode-security-owner.json"), "utf8"));
    expect(await readFile(path.join(products, ".gitignore"), "utf8")).toBe("*\n");
    expect(await readFile(path.join(runDir, ".gitignore"), "utf8")).toBe("*\n");

    const sha = "0123456789abcdef0123456789abcdef01234567";
    await writeScanMetaFixture(
      runDir,
      { versioned: true, commit: sha, dirty: false },
      { effort: "medium", model: null },
    );
    await writeJson(path.join(runDir, "findings.json"), [
      {
        id: "F1",
        title: "Unsafe query",
        impact: "Data exposure",
        file: "src/db.py",
        line: 12,
        description: "User input reaches a SQL query.",
        exploit_scenario: "An attacker changes the query.",
        preconditions: ["Attacker controls q"],
        category: "SQL injection",
        severity: "HIGH",
        confidence: "high",
        recommendation: "Use parameters.",
        cwe_id: "89",
        snippet: "cursor.execute(q)",
        symbol: "search",
      },
    ]);
    await writeJson(path.join(runDir, "votes.json"), {
      candidates: 1,
      candidates_deduped: 1,
      panel_votes: 3,
      researchers_dispatched: 1,
      researchers_returned: 1,
      unreviewed_candidate_sites: 0,
      rounds: {
        F1: { panel: { true: 2, false: 1, voters: 3 } },
      },
    });
    await writeJson(path.join(runDir, "coverage.json"), {
      collapsed: "small-diff",
      diffFiles: 2,
      diffLines: 40,
      scopeFiles: null,
      emptyDiff: false,
      emptyScope: false,
      researchersDispatched: 1,
      skippedComponents: [],
      completenessCheckOutcome: "not-applicable",
      unaccountedTopLevelDirs: [],
      inventoryFallback: null,
      topLevelCount: null,
    });
    await writeFile(
      path.join(runDir, "CRABCODE-SECURITY-RESULTS.md"),
      "# CrabCode Security results\n",
    );
    await writeFile(
      path.join(products, "CRABCODE-SECURITY-REVISION-abcdef1.json"),
      "{}\n",
    );

    const result = run(
      "python3",
      [renderReport, runDir, "--products-dir", products],
      { cwd: root },
    );
    requireSuccess(result, "render_report.py");
    expect(result.stdout).toContain("verification.status: verified");
    expect(result.stdout).toContain("removed run directory");
    expect(await pathExists(runDir)).toBe(false);
    expect(await pathExists(path.join(products, ".crabcode-security-owner.json"))).toBe(
      true,
    );

    const jsonlPath = path.join(products, "CRABCODE-SECURITY-RESULTS.jsonl");
    const rows = (await readFile(jsonlPath, "utf8")).trim().split("\n");
    expect(rows).toHaveLength(1);
    const finding = JSON.parse(rows[0]!);
    expect(Object.keys(finding)).toEqual([
      "id",
      "title",
      "impact",
      "file",
      "line",
      "description",
      "exploit_scenario",
      "preconditions",
      "category",
      "severity",
      "confidence",
      "recommendation",
      "cwe_id",
      "snippet",
      "symbol",
    ]);
    expect(finding).toMatchObject({
      id: "F1",
      category: "sql-injection",
      confidence: "medium",
      cwe_id: "CWE-89",
      line: 12,
    });

    const stampName = `CRABCODE-SECURITY-REVISION-${sha.slice(0, 12)}.json`;
    const stamp = JSON.parse(await readFile(path.join(products, stampName), "utf8"));
    expect(stamp.verification).toMatchObject({
      status: "verified",
      candidates: 1,
      panel_reviewed_findings: 1,
      panel_quorum_findings: 1,
      researchers_dispatched: 1,
      researchers_returned: 1,
    });
    expect(stamp.run_shape).toMatchObject({
      collapsed: "small-diff",
      diff_files: 2,
      diff_lines: 40,
      researchers_dispatched: 1,
    });
    expect(stamp).toMatchObject({
      scan_root: sourceRoot,
      source_root: sourceRoot,
      revision_source: "tool-captured",
      source_revision: { versioned: true, commit: sha, dirty: false },
      analysis: {
        snapshot_kind: "fixture-empty-analysis",
      },
    });
    expect(await pathExists(path.join(products, "CRABCODE-SECURITY-REVISION-abcdef1.json"))).toBe(
      false,
    );
    expect(await readFile(path.join(products, "CRABCODE-SECURITY-RESULTS.md"), "utf8")).toBe(
      "# CrabCode Security results\n",
    );
  });

  test("refuses an input directory outside the exact report/run fence", async () => {
    const root = await tempDir("report-refusal");
    const products = path.join(
      root,
      "CRABCODE-SECURITY-20260723-120001-2222222222222222",
    );
    const input = path.join(root, "user-data");
    await mkdir(products, { recursive: true });
    await mkdir(input, { recursive: true });
    await writeJson(path.join(input, "scan-meta.json"), {
      scan_root: root,
      mode: "scan",
      scope: [],
      effort: "low",
      revision: { versioned: false },
      run_dir: await realpath(input),
    });
    await writeJson(path.join(input, "findings.json"), []);
    await writeJson(path.join(input, "votes.json"), {
      candidates: 0,
      candidates_deduped: 0,
      panel_votes: 0,
      unreviewed_candidate_sites: 0,
      rounds: {},
    });
    await writeFile(path.join(input, "CRABCODE-SECURITY-RESULTS.md"), "# Empty\n");
    await writeFile(path.join(input, "must-remain.txt"), "sentinel\n");

    const result = run(
      "python3",
      [renderReport, input, "--products-dir", products],
      { cwd: root },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("run directory basename");
    expect(await readFile(path.join(input, "must-remain.txt"), "utf8")).toBe("sentinel\n");
  });
});

describe("patch_artifacts.py", () => {
  test("writes declined artifacts, cleans its run, removes only stale owned products, and fences output", async () => {
    const root = await tempDir("patches");
    const { report, patchesDir, patchDir, base } =
      await prepareSimplePatchRun(root);
    const runRoot = path.join(report, ".crabcode-security-run");
    const scratch = path.join(patchDir, "scratch-F1");
    await mkdir(path.join(scratch, ".git"), { recursive: true });
    await writeJson(path.join(patchDir, "patches.json"), {
      units: [
        {
          id: "F1",
          title: "No safe automatic fix",
          status: "declined",
          decline_reason: "The behavior contract is ambiguous.",
          recommendation: "Review the caller contract.",
          reviewed_paths: ["src/app.ts"],
        },
      ],
    });
    await writeFile(path.join(patchesDir, "F99.md"), "stale\n");
    await writeFile(path.join(patchesDir, "F99.patch"), "stale\n");
    await writeFile(path.join(patchesDir, "user-note.md"), "preserve\n");

    const result = run(
      "python3",
      [patchArtifacts, patchDir, patchesDir, root, "--base", base],
      { cwd: root },
    );
    requireSuccess(result, "patch_artifacts.py");
    expect(await pathExists(runRoot)).toBe(false);
    expect(await pathExists(path.join(report, ".crabcode-security-owner.json"))).toBe(
      true,
    );
    expect(await pathExists(path.join(patchesDir, "F99.md"))).toBe(false);
    expect(await pathExists(path.join(patchesDir, "F99.patch"))).toBe(false);
    expect(await readFile(path.join(patchesDir, "user-note.md"), "utf8")).toBe("preserve\n");
    expect(await readFile(path.join(report, ".gitignore"), "utf8")).toBe("*\n");
    expect(await readFile(path.join(patchesDir, "F1.md"), "utf8")).toContain(
      "The behavior contract is ambiguous.",
    );
    expect(await readFile(path.join(patchesDir, "PATCHES.md"), "utf8")).toContain(
      "No patch produced",
    );
    const row = JSON.parse((await readFile(path.join(patchesDir, "patches.jsonl"), "utf8")).trim());
    expect(row).toMatchObject({
      id: "F1",
      status: "declined",
      base,
      patch: null,
      note: "F1.md",
    });
    expect((await readdir(patchesDir)).sort()).toEqual(
      [
        ".crabcode-security-patches-owner.json",
        "F1.md",
        "PATCHES.md",
        "patches.jsonl",
        "user-note.md",
      ].sort(),
    );
  });

  test("refuses scratch deletion outside the exact fenced hierarchy", async () => {
    const root = await tempDir("scratch-refusal");
    const scratch = path.join(root, "patch-2026-07-23", "scratch-F1");
    await mkdir(path.join(scratch, ".git"), { recursive: true });
    await writeFile(path.join(scratch, "sentinel.txt"), "keep\n");

    const result = run("python3", [patchArtifacts, "--remove-scratch", scratch]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refusing to remove");
    expect(result.stderr).toContain("patch-<timestamp>");
    expect(await readFile(path.join(scratch, "sentinel.txt"), "utf8")).toBe("keep\n");
  });

  test("removes only the requested valid scratch workspace and preserves siblings", async () => {
    const root = await tempDir("scratch-valid");
    const { patchDir } = await prepareSimplePatchRun(root);
    const scratch = path.join(patchDir, "scratch-F1");
    await mkdir(path.join(scratch, ".git"), { recursive: true });
    await writeFile(path.join(scratch, "temporary.txt"), "delete\n");
    await writeFile(path.join(patchDir, "sibling.txt"), "keep\n");

    const result = run("python3", [patchArtifacts, "--remove-scratch", scratch]);
    requireSuccess(result, "patch_artifacts.py --remove-scratch");
    expect(await pathExists(scratch)).toBe(false);
    expect(await readFile(path.join(patchDir, "sibling.txt"), "utf8")).toBe("keep\n");
  });
});
