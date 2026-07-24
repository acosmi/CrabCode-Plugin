import { describe, expect, test } from "bun:test";
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  symlink,
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

async function makeReportRun(label: string): Promise<{
  root: string;
  products: string;
  runDir: string;
}> {
  const root = await tempDir(label);
  const { products, runDir } = await createOwnedReportRun(root);
  return { root, products, runDir };
}

async function writeEmptyReportInputs(
  runDir: string,
  revision: Record<string, unknown>,
): Promise<void> {
  await writeScanMetaFixture(runDir, revision);
  await writeJson(path.join(runDir, "findings.json"), []);
  await writeJson(path.join(runDir, "votes.json"), {
    candidates: 0,
    candidates_deduped: 0,
    panel_votes: 0,
    unreviewed_candidate_sites: 0,
    rounds: {},
  });
  await writeFile(path.join(runDir, "CRABCODE-SECURITY-RESULTS.md"), "# Empty\n");
}

function validFinding(): Record<string, unknown> {
  return {
    id: "F1",
    title: "Unsafe query",
    impact: "Data exposure",
    file: "src/db.py",
    line: 12,
    description: "User input reaches a SQL query.",
    exploit_scenario: "An attacker changes the query.",
    preconditions: ["Attacker controls q"],
    category: "sql-injection",
    severity: "HIGH",
    confidence: "high",
    recommendation: "Use parameters.",
    cwe_id: "CWE-89",
    snippet: "cursor.execute(q)",
    symbol: "search",
  };
}

function completeVotes(): Record<string, unknown> {
  return {
    candidates: 1,
    candidates_deduped: 1,
    panel_votes: 3,
    researchers_dispatched: 1,
    researchers_returned: 1,
    unreviewed_candidate_sites: 0,
    rounds: {
      F1: { panel: { true: 3, false: 0, voters: 3 } },
    },
  };
}

function writtenPatchUnit(
  reviewedPath = "M assets/fixture.bin",
): Record<string, unknown> {
  const claim = (evidence: string) => ({ state: "CONFIDENT", evidence });
  return {
    id: "F1",
    title: "Replace the vulnerable binary fixture",
    status: "patch_written",
    summary: "Updates only the affected fixture.",
    claims: {
      targeted: claim("Only assets/fixture.bin changes."),
      no_new_vulnerability: claim("The replacement contains no executable content."),
      behaviour_unchanged: claim("The fixture's public format is unchanged."),
    },
    untested: false,
    tests_run: "fixture parser test",
    reviewed_paths: [reviewedPath],
    decline_reason: "",
    recommendation: "Use the replacement.",
  };
}

async function initPatchRepository(root: string): Promise<string> {
  requireSuccess(run("git", ["init", "-q"], { cwd: root }), "git init");
  requireSuccess(
    run("git", ["config", "user.email", "security-tests@example.invalid"], {
      cwd: root,
    }),
    "git config email",
  );
  requireSuccess(
    run("git", ["config", "user.name", "Security Tests"], { cwd: root }),
    "git config name",
  );
  await writeFile(path.join(root, "tracked.txt"), "trusted base\n");
  requireSuccess(run("git", ["add", "--", "tracked.txt"], { cwd: root }), "git add");
  requireSuccess(
    run("git", ["commit", "-q", "-m", "trusted base"], { cwd: root }),
    "git commit",
  );
  return run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim();
}

async function preparePatchRun(
  root: string,
  base: string,
  findingFile = "tracked.txt",
): Promise<{
  root: string;
  report: string;
  patchesDir: string;
  patchDir: string;
  base: string;
}> {
  const report = await writePatchReport(root, base, findingFile);
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
    root,
    report: record.report_dir,
    patchesDir: record.patches_dir,
    patchDir: record.patch_dir,
    base,
  };
}

async function writePatchReport(
  root: string,
  base: string,
  findingFile = "tracked.txt",
): Promise<string> {
  const {
    products: report,
    sourceRoot,
  } = await createOwnedRenderedReport(root);
  await writeFile(
    path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl"),
    `${JSON.stringify({
      ...validFinding(),
      file: findingFile,
      line: 1,
    })}\n`,
  );
  await writeJson(
    path.join(
      report,
      `CRABCODE-SECURITY-REVISION-${base.slice(0, 12)}.json`,
    ),
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
  return report;
}

async function concurrentPatchPrepare(
  root: string,
  report: string,
  base: string,
): Promise<Array<{ status: number; stdout: string; stderr: string }>> {
  const command = [
    "python3",
    patchArtifacts,
    "--prepare-run",
    report,
    root,
    "--base",
    base,
    "--selection",
    "F1",
  ];
  const processes = [
    Bun.spawn(command, {
      cwd: root,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdout: "pipe",
      stderr: "pipe",
    }),
    Bun.spawn(command, {
      cwd: root,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdout: "pipe",
      stderr: "pipe",
    }),
  ];
  return Promise.all(
    processes.map(async (process) => ({
      status: await process.exited,
      stdout: await new Response(process.stdout).text(),
      stderr: await new Response(process.stderr).text(),
    })),
  );
}

async function makePatchRun(label: string): Promise<{
  root: string;
  report: string;
  patchesDir: string;
  patchDir: string;
  base: string;
}> {
  const root = await tempDir(label);
  const base = await initPatchRepository(root);
  return preparePatchRun(root, base);
}

describe("write_scan_meta.py boundary records", () => {
  test("records a non-Git whole tree and excludes only this exact report directory", async () => {
    const root = await tempDir("meta-unversioned");
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "vendor"), { recursive: true });
    await mkdir(path.join(root, "CRABCODE-SECURITY-2026-07-23"), { recursive: true });
    const runDir = path.join(root, "output", ".crabcode-security-run");
    await mkdir(runDir, { recursive: true });

    const result = run(
      "python3",
      [writeScanMeta, runDir, root, "--mode", "scan", "--effort", "medium"],
      { cwd: root },
    );
    requireSuccess(result, "write_scan_meta.py non-Git run");
    expect(result.stdout).toContain("revision: UNVERSIONED");

    const meta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
    expect(meta.revision).toEqual({ versioned: false });
    expect(meta.top_level_dirs).toEqual([
      "CRABCODE-SECURITY-2026-07-23",
      "src",
      "vendor",
    ]);
    expect(meta.scan_root).toBe(await realpath(root));
  });

  test("normalizes whole-tree dot scope but preserves an actual trimmed scope", async () => {
    const root = await tempDir("meta-scope");
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "tests"), { recursive: true });
    const runDir = path.join(root, "output", ".crabcode-security-run");
    await mkdir(runDir, { recursive: true });

    const whole = run(
      "python3",
      [
        writeScanMeta,
        runDir,
        root,
        "--mode",
        "scan",
        "--effort",
        "low",
        "--scope",
        " . , ./ ",
      ],
      { cwd: root },
    );
    requireSuccess(whole, "write_scan_meta.py dot scope");
    const wholeMeta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
    expect(wholeMeta.scope).toEqual([]);
    expect(wholeMeta.top_level_dirs).toEqual(["src", "tests"]);

    const scoped = run(
      "python3",
      [
        writeScanMeta,
        runDir,
        root,
        "--mode",
        "scan",
        "--effort",
        "low",
        "--scope",
        " src, tests ",
      ],
      { cwd: root },
    );
    requireSuccess(scoped, "write_scan_meta.py concrete scope");
    const scopedMeta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
    expect(scopedMeta.scope).toEqual(["src", "tests"]);
    expect(scopedMeta.top_level_dirs).toBeNull();
  });

  test("refuses commit mode outside Git without leaving a misleading meta file", async () => {
    const root = await tempDir("meta-commit-unversioned");
    const runDir = path.join(root, ".crabcode-security-run");
    await mkdir(runDir, { recursive: true });
    const result = run(
      "python3",
      [
        writeScanMeta,
        runDir,
        root,
        "--mode",
        "commit",
        "--commit",
        "abcdef1",
        "--effort",
        "high",
      ],
      { cwd: root },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("needs a git repository");
    expect(await pathExists(path.join(runDir, "scan-meta.json"))).toBe(false);
  });
});

describe("render_report.py refusal and revision naming", () => {
  test("marks an incomplete voter panel unverified and names the missing finding", async () => {
    const { root, products, runDir } = await makeReportRun("report-incomplete-panel");
    const sha = "0123456789abcdef0123456789abcdef01234567";
    await writeScanMetaFixture(
      runDir,
      { versioned: true, commit: sha, dirty: false },
      { effort: "high" },
    );
    await writeJson(path.join(runDir, "findings.json"), [validFinding()]);
    await writeJson(path.join(runDir, "votes.json"), {
      ...completeVotes(),
      panel_votes: 2,
      rounds: { F1: { panel: { true: 2, false: 0, voters: 2 } } },
    });
    await writeFile(path.join(runDir, "CRABCODE-SECURITY-RESULTS.md"), "# One finding\n");

    const result = run(
      "python3",
      [renderReport, runDir, "--products-dir", products],
      { cwd: root },
    );
    requireSuccess(result, "render_report.py incomplete panel");
    expect(result.stdout).toContain("verification.status: unverified");
    expect(result.stdout).toContain("F1");

    const stamp = JSON.parse(
      await readFile(
        path.join(products, `CRABCODE-SECURITY-REVISION-${sha.slice(0, 12)}.json`),
        "utf8",
      ),
    );
    expect(stamp.verification).toMatchObject({
      status: "unverified",
      panel_reviewed_findings: 0,
      panel_quorum_findings: 0,
    });
    expect(stamp.verification.reason).toContain("F1");
    expect(stamp.verification.reason).toContain("3-voter");
  });

  test("uses explicit -dirty and UNVERSIONED revision stamp names", async () => {
    const dirtyRun = await makeReportRun("report-dirty-name");
    const sha = "fedcba9876543210fedcba9876543210fedcba98";
    await writeEmptyReportInputs(dirtyRun.runDir, {
      versioned: true,
      commit: sha,
      dirty: true,
    });
    const dirtyResult = run(
      "python3",
      [renderReport, dirtyRun.runDir, "--products-dir", dirtyRun.products],
      { cwd: dirtyRun.root },
    );
    requireSuccess(dirtyResult, "render_report.py dirty name");
    expect(
      await pathExists(
        path.join(
          dirtyRun.products,
          `CRABCODE-SECURITY-REVISION-${sha.slice(0, 12)}-dirty.json`,
        ),
      ),
    ).toBe(true);

    const unversionedRun = await makeReportRun("report-unversioned-name");
    await writeEmptyReportInputs(unversionedRun.runDir, { versioned: false });
    const unversionedResult = run(
      "python3",
      [
        renderReport,
        unversionedRun.runDir,
        "--products-dir",
        unversionedRun.products,
      ],
      { cwd: unversionedRun.root },
    );
    requireSuccess(unversionedResult, "render_report.py UNVERSIONED name");
    expect(
      await pathExists(
        path.join(
          unversionedRun.products,
          "CRABCODE-SECURITY-REVISION-UNVERSIONED.json",
        ),
      ),
    ).toBe(true);
  });

  test("refuses malformed top-level schemas without deleting the evidence directory", async () => {
    const cases: Array<{
      label: string;
      file: "scan-meta.json" | "findings.json" | "votes.json";
      value: unknown;
      message: string;
    }> = [
      {
        label: "meta-array",
        file: "scan-meta.json",
        value: [],
        message: "scan-meta.json must be a JSON object",
      },
      {
        label: "findings-object",
        file: "findings.json",
        value: {},
        message: "findings.json must be a JSON array",
      },
      {
        label: "votes-array",
        file: "votes.json",
        value: [],
        message: "votes.json must be a JSON object",
      },
      {
        label: "rounds-array",
        file: "votes.json",
        value: { ...completeVotes(), rounds: [] },
        message: "rounds",
      },
    ];

    for (const item of cases) {
      const { root, products, runDir } = await makeReportRun(`report-schema-${item.label}`);
      await writeEmptyReportInputs(runDir, { versioned: false });
      await writeJson(path.join(runDir, item.file), item.value);
      await writeFile(path.join(runDir, "must-remain.txt"), "evidence\n");

      const result = run(
        "python3",
        [renderReport, runDir, "--products-dir", products],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(item.message);
      expect(await readFile(path.join(runDir, "must-remain.txt"), "utf8")).toBe(
        "evidence\n",
      );
      expect(
        await pathExists(path.join(products, "CRABCODE-SECURITY-RESULTS.jsonl")),
      ).toBe(false);
    }
  });

  test("refuses malformed finding fields and negative vote counters", async () => {
    const cases: Array<{
      label: string;
      finding?: Record<string, unknown>;
      votes?: Record<string, unknown>;
      message: string;
    }> = [
      {
        label: "missing-title",
        finding: { ...validFinding(), title: "" },
        message: "missing required field 'title'",
      },
      {
        label: "bad-severity",
        finding: { ...validFinding(), severity: "CRITICAL" },
        message: "severity",
      },
      {
        label: "bad-confidence",
        finding: { ...validFinding(), confidence: "certain" },
        message: "confidence",
      },
      {
        label: "bad-preconditions",
        finding: { ...validFinding(), preconditions: "network access" },
        message: "preconditions must be a list",
      },
      {
        label: "negative-candidates",
        votes: { ...completeVotes(), candidates: -1 },
        message: "non-negative integer",
      },
    ];

    for (const item of cases) {
      const { root, products, runDir } = await makeReportRun(`report-field-${item.label}`);
      await writeEmptyReportInputs(runDir, {
        versioned: true,
        commit: "0123456789abcdef0123456789abcdef01234567",
        dirty: false,
      });
      await writeJson(path.join(runDir, "findings.json"), [
        item.finding ?? validFinding(),
      ]);
      await writeJson(path.join(runDir, "votes.json"), item.votes ?? completeVotes());

      const result = run(
        "python3",
        [renderReport, runDir, "--products-dir", products],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(item.message);
      expect(await pathExists(runDir)).toBe(true);
    }
  });

  test("refuses non-canonical or external finding paths and non-positive/non-integer lines", async () => {
    const cases: Array<{
      label: string;
      finding: Record<string, unknown>;
      message: string;
    }> = [
      {
        label: "absolute-posix",
        finding: { ...validFinding(), file: "/etc/passwd" },
        message: "repository-relative",
      },
      {
        label: "absolute-windows",
        finding: { ...validFinding(), file: "C:/Windows/system.ini" },
        message: "repository-relative",
      },
      {
        label: "parent",
        finding: { ...validFinding(), file: "../secret.txt" },
        message: "normalized repository-relative",
      },
      {
        label: "embedded-parent",
        finding: { ...validFinding(), file: "src/../secret.txt" },
        message: "normalized repository-relative",
      },
      {
        label: "control",
        finding: { ...validFinding(), file: "src/db.py\nforged.md" },
        message: "control character",
      },
      {
        label: "zero-line",
        finding: { ...validFinding(), line: 0 },
        message: "positive integer",
      },
      {
        label: "negative-line",
        finding: { ...validFinding(), line: -1 },
        message: "positive integer",
      },
      {
        label: "float-line",
        finding: { ...validFinding(), line: 12.5 },
        message: "positive integer",
      },
      {
        label: "string-line",
        finding: { ...validFinding(), line: "12" },
        message: "positive integer",
      },
    ];

    for (const item of cases) {
      const { root, products, runDir } = await makeReportRun(`report-path-${item.label}`);
      await writeEmptyReportInputs(runDir, { versioned: false });
      await writeJson(path.join(runDir, "findings.json"), [item.finding]);
      await writeJson(path.join(runDir, "votes.json"), completeVotes());

      const result = run(
        "python3",
        [renderReport, runDir, "--products-dir", products],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(item.message);
      expect(await pathExists(runDir)).toBe(true);
      expect(
        await pathExists(path.join(products, "CRABCODE-SECURITY-RESULTS.jsonl")),
      ).toBe(false);
    }
  });

  test("refuses arithmetically forged panel records and aggregate vote counts", async () => {
    const cases: Array<{
      label: string;
      votes: Record<string, unknown>;
      message: string;
    }> = [
      {
        label: "panel-sum",
        votes: {
          ...completeVotes(),
          rounds: { F1: { panel: { true: 2, false: 0, voters: 3 } } },
        },
        message: "true + false must equal voters",
      },
      {
        label: "negative-panel",
        votes: {
          ...completeVotes(),
          rounds: { F1: { panel: { true: -1, false: 4, voters: 3 } } },
        },
        message: "non-negative integer",
      },
      {
        label: "panel-too-large",
        votes: {
          ...completeVotes(),
          panel_votes: 4,
          rounds: { F1: { panel: { true: 3, false: 1, voters: 4 } } },
        },
        message: "fixed 3-voter panel",
      },
      {
        label: "aggregate-panel-votes",
        votes: { ...completeVotes(), panel_votes: 300 },
        message: "panel_votes is inconsistent with rounds",
      },
      {
        label: "candidate-count",
        votes: { ...completeVotes(), candidates: 0 },
        message: "candidates_deduped cannot exceed candidates",
      },
      {
        label: "unaccounted-deduped",
        votes: {
          ...completeVotes(),
          candidates: 2,
          candidates_deduped: 2,
          unreviewed_candidate_sites: 0,
        },
        message: "does not account",
      },
      {
        label: "bad-round-id",
        votes: {
          ...completeVotes(),
          rounds: {
            "../F1": { panel: { true: 3, false: 0, voters: 3 } },
          },
        },
        message: "valid candidate id",
      },
    ];

    for (const item of cases) {
      const { root, products, runDir } = await makeReportRun(`report-votes-${item.label}`);
      await writeEmptyReportInputs(runDir, { versioned: false });
      await writeJson(path.join(runDir, "findings.json"), [validFinding()]);
      await writeJson(path.join(runDir, "votes.json"), item.votes);

      const result = run(
        "python3",
        [renderReport, runDir, "--products-dir", products],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(item.message);
      expect(await pathExists(runDir)).toBe(true);
    }
  });

  test("keeps incomplete vote evidence unverified and clamps unsupported confidence", async () => {
    const { root, products, runDir } = await makeReportRun("report-mismatched-round");
    await writeEmptyReportInputs(runDir, { versioned: false });
    await writeJson(path.join(runDir, "findings.json"), [validFinding()]);
    await writeJson(path.join(runDir, "votes.json"), {
      candidates: 1,
      candidates_deduped: 1,
      panel_votes: 3,
      unreviewed_candidate_sites: 0,
      rounds: {
        F2: { panel: { true: 3, false: 0, voters: 3 } },
      },
    });

    const result = run(
      "python3",
      [renderReport, runDir, "--products-dir", products],
      { cwd: root },
    );
    requireSuccess(result, "render_report.py mismatched round");
    expect(result.stdout).toContain("verification.status: unverified");
    expect(result.stdout).toContain("F1");
    const finding = JSON.parse(
      (await readFile(path.join(products, "CRABCODE-SECURITY-RESULTS.jsonl"), "utf8")).trim(),
    );
    expect(finding.confidence).toBe("low");
  });

  test("accepts and exactly accounts for a valid max-effort partial repanel record", async () => {
    const { root, products, runDir } = await makeReportRun("report-valid-adversarial");
    await writeEmptyReportInputs(runDir, { versioned: false });
    await writeJson(path.join(runDir, "findings.json"), [validFinding()]);
    await writeJson(path.join(runDir, "votes.json"), {
      candidates: 1,
      candidates_deduped: 1,
      panel_votes: 5,
      unreviewed_candidate_sites: 0,
      rounds: {
        F1: {
          panel: { true: 2, false: 1, voters: 3 },
          adversarial: {
            repanel: { true: 2, false: 0, voters: 2 },
            redteam: "no-vote",
          },
        },
      },
    });

    const result = run(
      "python3",
      [renderReport, runDir, "--products-dir", products],
      { cwd: root },
    );
    requireSuccess(result, "render_report.py valid adversarial record");
    expect(result.stdout).toContain("verification.status: verified");
  });

  test("refuses invalid report ownership and preserves symlink targets", async () => {
    const invalidProducts = await tempDir("report-invalid-products");
    const invalidRun = path.join(invalidProducts, ".crabcode-security-run");
    await mkdir(path.join(invalidRun, "analysis-root"), { recursive: true });
    await writeFile(path.join(invalidRun, ".gitignore"), "*\n");
    await writeEmptyReportInputs(invalidRun, { versioned: false });
    const invalidName = run(
      "python3",
      [renderReport, invalidRun, "--products-dir", invalidProducts],
      { cwd: invalidProducts },
    );
    expect(invalidName.status).toBe(1);
    expect(invalidName.stderr).toContain("products directory must be named");
    expect(await pathExists(invalidRun)).toBe(true);

    const missingMarkerRoot = await tempDir("report-missing-marker");
    const {
      products: missingMarkerProducts,
      runDir: missingMarkerRun,
    } = await createOwnedRenderedReport(
      missingMarkerRoot,
      "20260723-120002-2222222222222222",
    );
    await mkdir(path.join(missingMarkerRun, "analysis-root"), { recursive: true });
    await writeFile(path.join(missingMarkerRun, ".gitignore"), "*\n");
    await writeEmptyReportInputs(missingMarkerRun, { versioned: false });
    const missingMarker = run(
      "python3",
      [renderReport, missingMarkerRun, "--products-dir", missingMarkerProducts],
      { cwd: missingMarkerRoot },
    );
    expect(missingMarker.status).toBe(1);
    expect(missingMarker.stderr).toContain("run ownership marker");
    expect(await pathExists(missingMarkerRun)).toBe(true);

    const mismatchedOwner = await makeReportRun("report-owner-mismatch");
    await writeEmptyReportInputs(mismatchedOwner.runDir, { versioned: false });
    await writeScanMetaFixture(
      mismatchedOwner.runDir,
      { versioned: false },
      { run_dir: path.join(mismatchedOwner.root, "someone-elses-run") },
    );
    const mismatchedResult = run(
      "python3",
      [
        renderReport,
        mismatchedOwner.runDir,
        "--products-dir",
        mismatchedOwner.products,
      ],
      { cwd: mismatchedOwner.root },
    );
    expect(mismatchedResult.status).toBe(1);
    expect(mismatchedResult.stderr).toContain("canonical run directory");
    expect(await pathExists(mismatchedOwner.runDir)).toBe(true);

    const { root, products, runDir } = await makeReportRun("report-stale-symlink");
    await writeEmptyReportInputs(runDir, { versioned: false });
    const outside = path.join(root, "outside.json");
    const stale = path.join(products, "CRABCODE-SECURITY-REVISION-abcdef1.json");
    await writeFile(outside, "outside must survive\n");
    await symlink(outside, stale);
    const staleResult = run(
      "python3",
      [renderReport, runDir, "--products-dir", products],
      { cwd: root },
    );
    expect(staleResult.status).toBe(1);
    expect(staleResult.stderr).toContain("stale revision symlink");
    expect(await readFile(outside, "utf8")).toBe("outside must survive\n");
    expect(await pathExists(stale)).toBe(true);
    expect(await pathExists(runDir)).toBe(true);
  });

  test("refuses a symlinked run-directory escape before reading or deleting it", async () => {
    const root = await tempDir("report-run-symlink");
    const products = path.join(
      root,
      "CRABCODE-SECURITY-20260723-120003-3333333333333333",
    );
    const outsideParent = path.join(root, "outside");
    const outsideRun = path.join(outsideParent, ".crabcode-security-run");
    const runLink = path.join(products, ".crabcode-security-run");
    await mkdir(products, { recursive: true });
    await mkdir(path.join(outsideRun, "analysis-root"), { recursive: true });
    await writeFile(path.join(outsideRun, ".gitignore"), "*\n");
    await writeEmptyReportInputs(outsideRun, { versioned: false });
    await writeFile(path.join(outsideRun, "must-remain.txt"), "evidence\n");
    await symlink(outsideRun, runLink);

    const result = run(
      "python3",
      [renderReport, runLink, "--products-dir", products],
      { cwd: root },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("symbolic link");
    expect(await readFile(path.join(outsideRun, "must-remain.txt"), "utf8")).toBe(
      "evidence\n",
    );
  });
});

describe("patch_artifacts.py written-patch guarantees", () => {
  test("preserves a binary Git diff byte-for-byte and records a clean apply check", async () => {
    const root = await tempDir("patch-binary");
    await initPatchRepository(root);
    const assetDir = path.join(root, "assets");
    const asset = path.join(assetDir, "fixture with space.bin");
    const original = Buffer.from([0x00, 0x01, 0x02, 0x0a, 0x0d, 0x80, 0xff, 0x00]);
    const replacement = Buffer.from([0x00, 0x01, 0x03, 0x0d, 0x0a, 0x81, 0xfe, 0x00]);
    await mkdir(assetDir, { recursive: true });
    await writeFile(asset, original);
    requireSuccess(
      run("git", ["add", "assets/fixture with space.bin"], { cwd: root }),
      "git add",
    );
    requireSuccess(
      run("git", ["commit", "-q", "-m", "binary fixture"], { cwd: root }),
      "git commit",
    );
    const base = run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim();
    const { patchesDir, patchDir } = await preparePatchRun(
      root,
      base,
      "assets/fixture with space.bin",
    );

    await writeFile(asset, replacement);
    const diffResult = run(
      "git",
      [
        "diff",
        "--binary",
        "--full-index",
        "--",
        "assets/fixture with space.bin",
      ],
      { cwd: root },
    );
    requireSuccess(diffResult, "git diff --binary");
    expect(diffResult.stdout).toContain("GIT binary patch");
    const diff = Buffer.from(diffResult.stdout, "utf8");
    await writeFile(path.join(patchDir, "F1.diff"), diff);
    await writeFile(asset, original);
    await writeJson(path.join(patchDir, "patches.json"), {
      units: [writtenPatchUnit("M assets/fixture with space.bin")],
    });

    const result = run(
      "python3",
      [patchArtifacts, patchDir, patchesDir, root, "--base", base],
      { cwd: root },
    );
    requireSuccess(result, "patch_artifacts.py binary patch");
    expect(result.stdout).toContain("apply check: clean");

    const patchPath = path.join(patchesDir, "F1.patch");
    const rendered = await readFile(patchPath);
    expect(rendered.subarray(rendered.length - diff.length).equals(diff)).toBe(true);
    const applyCheck = run("git", ["apply", "--check", patchPath], { cwd: root });
    requireSuccess(applyCheck, "independent git apply --check");

    const row = JSON.parse(
      (await readFile(path.join(patchesDir, "patches.jsonl"), "utf8")).trim(),
    );
    expect(row).toMatchObject({
      id: "F1",
      status: "patch_written",
      base,
      patch: "F1.patch",
      apply_check: "clean",
      diffstat: [
        {
          path: "assets/fixture with space.bin",
          added: "-",
          deleted: "-",
        },
      ],
    });
  });

  test("refuses traversal and absolute paths embedded in a raw diff before writing products", async () => {
    const cases = [
      {
        label: "parent-traversal",
        diff: [
          "diff --git a/../../outside.txt b/../../outside.txt",
          "--- a/../../outside.txt",
          "+++ b/../../outside.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+owned",
          "",
        ].join("\n"),
      },
      {
        label: "absolute-path",
        diff: [
          "diff --git /private/tmp/crabcode-security-outside.txt /private/tmp/crabcode-security-outside.txt",
          "--- /private/tmp/crabcode-security-outside.txt",
          "+++ /private/tmp/crabcode-security-outside.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+owned",
          "",
        ].join("\n"),
      },
      {
        label: "windows-drive",
        diff: [
          "diff --git a/C:/outside.txt b/C:/outside.txt",
          "--- a/C:/outside.txt",
          "+++ b/C:/outside.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+owned",
          "",
        ].join("\n"),
      },
      {
        label: "backslash",
        diff: [
          "diff --git a/src\\\\outside.txt b/src\\\\outside.txt",
          "--- a/src\\\\outside.txt",
          "+++ b/src\\\\outside.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+owned",
          "",
        ].join("\n"),
      },
      {
        label: "dot-segment",
        diff: [
          "diff --git a/src/./outside.txt b/src/./outside.txt",
          "--- a/src/./outside.txt",
          "+++ b/src/./outside.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+owned",
          "",
        ].join("\n"),
      },
    ];

    for (const item of cases) {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        `patch-unsafe-${item.label}`,
      );
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [writtenPatchUnit()],
      });
      await writeFile(path.join(patchDir, "F1.diff"), item.diff, "utf8");
      await writeFile(path.join(patchDir, "must-remain.txt"), "evidence\n");

      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("F1.diff");
      expect(await pathExists(path.join(patchesDir, "F1.patch"))).toBe(false);
      expect(await readFile(path.join(patchDir, "must-remain.txt"), "utf8")).toBe(
        "evidence\n",
      );
    }
  });

  test("refuses a written patch whose actual paths were not in REVIEWED_PATHS", async () => {
    const { root, patchesDir, patchDir, base } = await makePatchRun(
      "patch-unreviewed-path",
    );
    await writeFile(
      path.join(patchDir, "F1.diff"),
      [
        "diff --git a/src/actual.ts b/src/actual.ts",
        "--- a/src/actual.ts",
        "+++ b/src/actual.ts",
        "@@ -1 +1 @@",
        "-safe",
        "+changed",
        "",
      ].join("\n"),
    );
    await writeJson(path.join(patchDir, "patches.json"), {
      units: [
        {
          ...writtenPatchUnit(),
          reviewed_paths: ["M src/claimed.ts"],
        },
      ],
    });

    const result = run(
      "python3",
      [patchArtifacts, patchDir, patchesDir, root, "--base", base],
      { cwd: root },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("do not match reviewed_paths");
    expect(result.stderr).toContain("src/actual.ts");
    expect(await pathExists(path.join(patchesDir, "F1.patch"))).toBe(false);
    expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
  });

  test("refuses malformed patch-unit schemas before consuming the patch run", async () => {
    const cases: Array<{ label: string; units: unknown[]; message: string }> = [
      {
        label: "bad-id",
        units: [{ ...writtenPatchUnit(), id: "../F1" }],
        message: "not a finding id",
      },
      {
        label: "missing-claim",
        units: [
          {
            ...writtenPatchUnit(),
            claims: {
              targeted: {
                state: "CONFIDENT",
                evidence: "Only one path changes.",
              },
            },
          },
        ],
        message: "claim 'no_new_vulnerability' is missing",
      },
      {
        label: "missing-untested",
        units: [
          Object.fromEntries(
            Object.entries(writtenPatchUnit()).filter(([key]) => key !== "untested"),
          ),
        ],
        message: '"untested" is missing',
      },
      {
        label: "duplicate-id",
        units: [
          { id: "F1", status: "declined", decline_reason: "Unsafe to automate." },
          { id: "F1", status: "declined", decline_reason: "Still unsafe." },
        ],
        message: "appears more than once",
      },
    ];

    for (const item of cases) {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        `patch-schema-${item.label}`,
      );
      await writeJson(path.join(patchDir, "patches.json"), { units: item.units });
      await writeFile(path.join(patchDir, "must-remain.txt"), "evidence\n");
      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(item.message);
      expect(await readFile(path.join(patchDir, "must-remain.txt"), "utf8")).toBe(
        "evidence\n",
      );
      expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
    }
  });

  test("validates report identity and refuses planted paths or a different current root", async () => {
    const root = await tempDir("patch-report-identity");
    const base = await initPatchRepository(root);
    const report = await writePatchReport(root, base);

    const valid = run(
      "python3",
      [
        patchArtifacts,
        "--validate-report",
        report,
        root,
        "--base",
        base,
        "--selection",
        "F1",
      ],
      { cwd: root, env: { GIT_DIR: path.join(root, "attacker-controlled-git-dir") } },
    );
    requireSuccess(valid, "patch_artifacts.py --validate-report");
    expect(JSON.parse(valid.stdout)).toMatchObject({
      base,
      report_commit: base,
      selected: [{ id: "F1", file: "tracked.txt" }],
    });

    const otherRoot = await tempDir("patch-wrong-current-root");
    const mismatch = run(
      "python3",
      [
        patchArtifacts,
        "--validate-report",
        report,
        otherRoot,
        "--base",
        base,
      ],
      { cwd: root },
    );
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain("direct child");

    const linkedRoot = `${root}-link`;
    await symlink(root, linkedRoot);
    const symlinkRoot = run(
      "python3",
      [
        patchArtifacts,
        "--validate-report",
        report,
        linkedRoot,
        "--base",
        base,
      ],
      { cwd: root },
    );
    expect(symlinkRoot.status).toBe(1);
    expect(symlinkRoot.stderr).toContain("scan root itself must not be a symbolic link");

    await writeFile(
      path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl"),
      `${JSON.stringify({
        ...validFinding(),
        file: "../outside.txt",
      })}\n`,
    );
    const planted = run(
      "python3",
      [
        patchArtifacts,
        "--validate-report",
        report,
        root,
        "--base",
        base,
      ],
      { cwd: root },
    );
    expect(planted.status).toBe(1);
    expect(planted.stderr).toContain("'..'");

    await writeFile(
      path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl"),
      `${JSON.stringify({
        ...validFinding(),
        file: "tracked.txt",
        line: 1,
      })}\n`,
    );
    await writeFile(path.join(root, "new-head.txt"), "new head\n");
    requireSuccess(run("git", ["add", "--", "new-head.txt"], { cwd: root }), "git add");
    requireSuccess(
      run("git", ["commit", "-q", "-m", "move HEAD"], { cwd: root }),
      "git commit",
    );
    const stale = run(
      "python3",
      [
        patchArtifacts,
        "--validate-report",
        report,
        root,
        "--base",
        base,
      ],
      { cwd: root },
    );
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("current HEAD");
  });

  test("atomically refuses an active run and never reuses its nonce-bearing patch directory", async () => {
    const root = await tempDir("patch-run-collision");
    const base = await initPatchRepository(root);
    const first = await preparePatchRun(root, base);

    const collision = run(
      "python3",
      [
        patchArtifacts,
        "--prepare-run",
        first.report,
        root,
        "--base",
        base,
        "--selection",
        "F1",
      ],
      { cwd: root },
    );
    expect(collision.status).toBe(1);
    expect(collision.stderr).toContain("active or interrupted");
    expect(await pathExists(first.patchDir)).toBe(true);

    await writeJson(path.join(first.patchDir, "patches.json"), {
      units: [
        {
          id: "F1",
          title: "Declined",
          status: "declined",
          decline_reason: "No safe patch.",
        },
      ],
    });
    const finish = run(
      "python3",
      [
        patchArtifacts,
        first.patchDir,
        first.patchesDir,
        root,
        "--base",
        base,
      ],
      { cwd: root },
    );
    requireSuccess(finish, "finish first patch run");

    const second = run(
      "python3",
      [
        patchArtifacts,
        "--prepare-run",
        first.report,
        root,
        "--base",
        base,
        "--selection",
        "F1",
      ],
      { cwd: root },
    );
    requireSuccess(second, "prepare second patch run");
    const secondRecord = JSON.parse(second.stdout);
    expect(secondRecord.patch_dir).not.toBe(first.patchDir);
    expect(path.basename(secondRecord.patch_dir)).toMatch(
      /^patch-\d{8}-\d{6}-[0-9a-f]{32}$/,
    );
  });

  test("two genuinely concurrent prepare-run processes produce exactly one owner and one fail-closed loser", async () => {
    const root = await tempDir("patch-run-concurrent");
    const base = await initPatchRepository(root);
    const report = await writePatchReport(root, base);
    const results = await concurrentPatchPrepare(root, report, base);
    const winners = results.filter((result) => result.status === 0);
    const losers = results.filter((result) => result.status !== 0);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.stderr).toContain("patch_artifacts.py:");
    const winner = JSON.parse(winners[0]!.stdout);
    expect(await realpath(winner.report_dir)).toBe(report);
    expect(await realpath(winner.patch_dir)).toBe(winner.patch_dir);
    const patchOwnerPath = path.join(
      winner.patch_dir,
      ".crabcode-security-patch-owner.json",
    );
    const productsOwnerPath = path.join(
      winner.patches_dir,
      ".crabcode-security-patches-owner.json",
    );
    const patchOwner = JSON.parse(await readFile(patchOwnerPath, "utf8"));
    const productsOwner = JSON.parse(await readFile(productsOwnerPath, "utf8"));
    expect(patchOwner).toMatchObject({
      nonce: winner.nonce,
      patch_dir: winner.patch_dir,
      selected_ids: ["F1"],
    });
    expect(productsOwner).toMatchObject({
      report_dir: report,
      base,
      results_sha256: patchOwner.results_sha256,
      revision_sha256: patchOwner.revision_sha256,
    });
    const runRoot = path.dirname(winner.patch_dir);
    expect(await readFile(path.join(runRoot, ".gitignore"), "utf8")).toBe("*\n");
    expect((await readdir(runRoot)).sort()).toEqual(
      [".gitignore", path.basename(winner.patch_dir)].sort(),
    );
    expect(losers[0]!.stdout).toBe("");
  });

  test("a pre-owned products directory also yields exactly one concurrent run-lease winner", async () => {
    const root = await tempDir("patch-run-concurrent-preowned");
    const base = await initPatchRepository(root);
    const seeded = await preparePatchRun(root, base);
    await writeJson(path.join(seeded.patchDir, "patches.json"), {
      units: [
        {
          id: "F1",
          title: "Declined",
          status: "declined",
          decline_reason: "Seed the products owner before the lease race.",
        },
      ],
    });
    const seededFinish = run(
      "python3",
      [
        patchArtifacts,
        seeded.patchDir,
        seeded.patchesDir,
        root,
        "--base",
        base,
      ],
      { cwd: root },
    );
    requireSuccess(seededFinish, "finish seed patch run");

    const productsOwnerPath = path.join(
      seeded.patchesDir,
      ".crabcode-security-patches-owner.json",
    );
    const productsOwnerBefore = await readFile(productsOwnerPath, "utf8");
    const results = await concurrentPatchPrepare(root, seeded.report, base);
    const winners = results.filter((result) => result.status === 0);
    const losers = results.filter((result) => result.status !== 0);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.stderr).toContain("active or interrupted");
    expect(await readFile(productsOwnerPath, "utf8")).toBe(productsOwnerBefore);
    const winner = JSON.parse(winners[0]!.stdout);
    expect(winner.patches_dir).toBe(seeded.patchesDir);
    expect(
      await pathExists(
        path.join(winner.patch_dir, ".crabcode-security-patch-owner.json"),
      ),
    ).toBe(true);
  });

  test("refuses an unowned pre-existing products directory before creating a run", async () => {
    const root = await tempDir("patch-planted-products");
    const base = await initPatchRepository(root);
    const report = await writePatchReport(root, base);
    const planted = path.join(report, "patches");
    await mkdir(planted);
    await writeFile(path.join(planted, "user-content.txt"), "preserve\n");

    const result = run(
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
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("owner marker");
    expect(
      await pathExists(path.join(report, ".crabcode-security-run")),
    ).toBe(false);
    expect(await readFile(path.join(planted, "user-content.txt"), "utf8")).toBe(
      "preserve\n",
    );
  });

  test("refuses symlinked diff inputs, intermediate diff paths, and product collisions", async () => {
    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-symlink-diff",
      );
      const outside = path.join(root, "outside.diff");
      await writeFile(
        outside,
        [
          "diff --git a/tracked.txt b/tracked.txt",
          "--- a/tracked.txt",
          "+++ b/tracked.txt",
          "@@ -1 +1 @@",
          "-trusted base",
          "+changed",
          "",
        ].join("\n"),
      );
      await symlink(outside, path.join(patchDir, "F1.diff"));
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [writtenPatchUnit("M tracked.txt")],
      });
      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("linked, or unreadable");
      expect(await readFile(outside, "utf8")).toContain("diff --git");
      expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
    }

    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-symlink-component",
      );
      const outside = await tempDir("patch-diff-outside");
      await writeFile(path.join(outside, "owned.txt"), "safe\n");
      await symlink(outside, path.join(root, "linked"));
      await writeFile(
        path.join(patchDir, "F1.diff"),
        [
          "diff --git a/linked/owned.txt b/linked/owned.txt",
          "--- a/linked/owned.txt",
          "+++ b/linked/owned.txt",
          "@@ -1 +1 @@",
          "-safe",
          "+changed",
          "",
        ].join("\n"),
      );
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [writtenPatchUnit("M linked/owned.txt")],
      });
      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("crosses a symbolic link");
      expect(await readFile(path.join(outside, "owned.txt"), "utf8")).toBe("safe\n");
    }

    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-product-collision",
      );
      const outside = path.join(root, "outside-note.md");
      await writeFile(outside, "preserve\n");
      await symlink(outside, path.join(patchesDir, "F1.md"));
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [
          {
            id: "F1",
            title: "Declined",
            status: "declined",
            decline_reason: "No safe patch.",
          },
        ],
      });
      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("symbolic link");
      expect(await readFile(outside, "utf8")).toBe("preserve\n");
    }

    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-special-product",
      );
      requireSuccess(
        run("mkfifo", [path.join(patchesDir, "F1.md")], { cwd: root }),
        "mkfifo product collision",
      );
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [
          {
            id: "F1",
            title: "Declined",
            status: "declined",
            decline_reason: "No safe patch.",
          },
        ],
      });
      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("special file");
    }

    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-dir-link",
      );
      const linkedPatchDir = `${patchDir}-alias`;
      await symlink(patchDir, linkedPatchDir);
      const result = run(
        "python3",
        [patchArtifacts, linkedPatchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("patch directory itself must not be a symbolic link");
      expect(await pathExists(patchDir)).toBe(true);
    }
  });

  test("refuses a run after its report revision identity changes", async () => {
    const { root, report, patchesDir, patchDir, base } = await makePatchRun(
      "patch-stale-owner",
    );
    await writeJson(path.join(patchDir, "patches.json"), {
      units: [
        {
          id: "F1",
          title: "Declined",
          status: "declined",
          decline_reason: "No safe patch.",
        },
      ],
    });
    const stamp = path.join(
      report,
      `CRABCODE-SECURITY-REVISION-${base.slice(0, 12)}.json`,
    );
    const parsed = JSON.parse(await readFile(stamp, "utf8"));
    parsed.effort = "tampered-after-prepare";
    await writeJson(stamp, parsed);

    const result = run(
      "python3",
      [patchArtifacts, patchDir, patchesDir, root, "--base", base],
      { cwd: root },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("revision_sha256");
    expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
    expect(await pathExists(patchDir)).toBe(true);
  });

  test("refuses post-prepare results and patch-owner tampering before writing products", async () => {
    {
      const { root, report, patchesDir, patchDir, base } = await makePatchRun(
        "patch-results-tamper",
      );
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [
          {
            id: "F1",
            title: "Declined",
            status: "declined",
            decline_reason: "No safe patch.",
          },
        ],
      });
      const resultsPath = path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl");
      const changedFinding = JSON.parse(await readFile(resultsPath, "utf8"));
      changedFinding.title = "Tampered after prepare";
      await writeFile(resultsPath, `${JSON.stringify(changedFinding)}\n`);

      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("results_sha256");
      expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
      expect(await pathExists(patchDir)).toBe(true);
    }

    {
      const { root, patchesDir, patchDir, base } = await makePatchRun(
        "patch-owner-tamper",
      );
      await writeJson(path.join(patchDir, "patches.json"), {
        units: [
          {
            id: "F1",
            title: "Declined",
            status: "declined",
            decline_reason: "No safe patch.",
          },
        ],
      });
      const ownerPath = path.join(
        patchDir,
        ".crabcode-security-patch-owner.json",
      );
      const owner = JSON.parse(await readFile(ownerPath, "utf8"));
      owner.selected_paths = ["different.txt"];
      await writeJson(ownerPath, owner);

      const result = run(
        "python3",
        [patchArtifacts, patchDir, patchesDir, root, "--base", base],
        { cwd: root },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("patch run owner marker");
      expect(result.stderr).toContain("selected_paths");
      expect(await pathExists(path.join(patchesDir, "PATCHES.md"))).toBe(false);
      expect(await pathExists(patchDir)).toBe(true);
    }
  });

  test("preflights every selected unit before refreshing any existing product", async () => {
    const root = await tempDir("patch-all-unit-preflight");
    const base = await initPatchRepository(root);
    const report = await writePatchReport(root, base);
    await writeFile(
      path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl"),
      [
        JSON.stringify({ ...validFinding(), file: "tracked.txt", line: 1 }),
        JSON.stringify({
          ...validFinding(),
          id: "F2",
          title: "Second finding",
          file: "tracked.txt",
          line: 1,
          severity: "MEDIUM",
        }),
        "",
      ].join("\n"),
    );
    const stampPath = path.join(
      report,
      `CRABCODE-SECURITY-REVISION-${base.slice(0, 12)}.json`,
    );
    const stamp = JSON.parse(await readFile(stampPath, "utf8"));
    stamp.findings = { total: 2, high: 1, medium: 1, low: 0 };
    await writeJson(stampPath, stamp);

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
        "all",
      ],
      { cwd: root },
    );
    requireSuccess(prepared, "prepare two-unit run");
    const owner = JSON.parse(prepared.stdout);
    await writeFile(path.join(owner.patches_dir, "F1.md"), "old product\n");
    await writeJson(path.join(owner.patch_dir, "patches.json"), {
      units: [
        {
          id: "F1",
          title: "Declined",
          status: "declined",
          decline_reason: "No safe patch.",
        },
        {
          ...writtenPatchUnit("M tracked.txt"),
          id: "F2",
          title: "Invalid second diff",
        },
      ],
    });
    await writeFile(
      path.join(owner.patch_dir, "F2.diff"),
      [
        "diff --git a/../outside.txt b/../outside.txt",
        "--- a/../outside.txt",
        "+++ b/../outside.txt",
        "@@ -1 +1 @@",
        "-safe",
        "+owned",
        "",
      ].join("\n"),
    );

    const result = run(
      "python3",
      [
        patchArtifacts,
        owner.patch_dir,
        owner.patches_dir,
        root,
        "--base",
        base,
      ],
      { cwd: root },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("F2.diff");
    expect(await readFile(path.join(owner.patches_dir, "F1.md"), "utf8")).toBe(
      "old product\n",
    );
    expect(await pathExists(path.join(owner.patches_dir, "PATCHES.md"))).toBe(false);
  });
});
