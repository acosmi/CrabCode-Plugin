import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
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

const sourceLower = `c${"laude"}`;
const sourceTitle = `C${"laude"}`;
const sourceUpper = `C${"LAUDE"}`;
const upstreamCheckout =
  process.env.CRABCODE_SECURITY_UPSTREAM_CHECKOUT ??
  path.join("/private/tmp", `${sourceLower}-security-4b3d2a2`);
const upstreamPlugin = path.join(
  upstreamCheckout,
  "plugins",
  `${sourceLower}-security`,
);
const targetScripts = path.join(PLUGIN_ROOT, "scripts");
const sourceScripts = path.join(upstreamPlugin, "scripts");
const scriptNames = [
  "write_scan_meta.py",
  "render_report.py",
  "patch_artifacts.py",
] as const;
const checkoutAvailable =
  existsSync(path.join(upstreamCheckout, ".git")) &&
  scriptNames.every((name) => existsSync(path.join(sourceScripts, name)));
const integrationTest = checkoutAvailable ? test : test.skip;

function normalizeSourceBrand(text: string): string {
  return text
    .replaceAll(`${sourceUpper}-SECURITY`, "CRABCODE-SECURITY")
    .replaceAll(`.${sourceLower}-security-run`, ".crabcode-security-run")
    .replaceAll(`${sourceTitle} Security`, "CrabCode Security")
    .replaceAll(sourceTitle, "CrabCode")
    .replaceAll(`${sourceLower}-security`, "crabcode-security");
}

function inverseNormalizeTarget(text: string): string {
  return text
    .replaceAll("CRABCODE-SECURITY", `${sourceUpper}-SECURITY`)
    .replaceAll(".crabcode-security-run", `.${sourceLower}-security-run`)
    .replaceAll("CrabCode Security", `${sourceTitle} Security`)
    .replaceAll("CrabCode", sourceTitle)
    .replaceAll("crabcode-security", `${sourceLower}-security`);
}

async function writeRenderInputs(
  runDir: string,
  reportPrefix: string,
  currentContract: boolean,
): Promise<void> {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const revision = { versioned: true, commit: sha, dirty: true };
  if (currentContract) {
    await writeScanMetaFixture(runDir, revision, { effort: "medium" });
  } else {
    await writeJson(path.join(runDir, "scan-meta.json"), {
      scan_root: path.dirname(path.dirname(runDir)),
      mode: "scan",
      scope: [],
      effort: "medium",
      revision,
      run_dir: await realpath(runDir),
    });
  }
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
      F1: { panel: { true: 3, false: 0, voters: 3 } },
    },
  });
  await writeFile(
    path.join(runDir, `${reportPrefix}-RESULTS.md`),
    `# ${reportPrefix} results\n`,
  );
  await writeFile(path.join(path.dirname(runDir), ".gitignore"), "*\n");
  await writeFile(path.join(runDir, ".gitignore"), "*\n");
}

async function writeDeclinedPatchInputs(patchDir: string): Promise<void> {
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
}

integrationTest(
  "matches unchanged scripts byte-for-byte and pins every reviewed hardening delta",
  async () => {
    const lock = JSON.parse(
      await readFile(
        path.join(PLUGIN_ROOT, "docs", "legal", "SOURCE-LOCK.json"),
        "utf8",
      ),
    );
    const head = run("git", ["rev-parse", "HEAD"], { cwd: upstreamCheckout });
    requireSuccess(head, "read upstream checkout HEAD");
    expect(head.stdout.trim()).toBe(lock.upstream.commit);

    for (const name of scriptNames) {
      const target = await readFile(path.join(targetScripts, name), "utf8");
      const source = await readFile(path.join(sourceScripts, name), "utf8");
      const relative = `scripts/${name}`;
      const entry = lock.files.find(
        (candidate: any) => candidate.targetRelativePath === relative,
      );
      expect(entry).toBeDefined();
      expect(createHash("sha256").update(source).digest("hex")).toBe(entry.sha256);
      expect(createHash("sha256").update(target).digest("hex")).toBe(
        entry.targetSha256,
      );
      if (entry.changeAxes.includes("securityHardening")) {
        expect(inverseNormalizeTarget(target)).not.toBe(source);
      } else {
        expect(inverseNormalizeTarget(target)).toBe(source);
      }
    }
  },
);

integrationTest(
  "limits scan.js changes to branding, namespaces, and the declared XML hardening",
  async () => {
    const source = await readFile(
      path.join(upstreamPlugin, "workflows", "scan.js"),
      "utf8",
    );
    const target = await readFile(
      path.join(PLUGIN_ROOT, "workflows", "scan.js"),
      "utf8",
    );
    const sourceEscaper =
      'function fe(e){return String(null==e?"":e)}';
    const targetEscaper =
      'function fe(e){return String(null==e?"":e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}';

    expect(target.split(targetEscaper)).toHaveLength(2);
    expect(target.match(/fe\(o\)/g)).toHaveLength(6);

    const reverted = target
      .replace(targetEscaper, sourceEscaper)
      .replaceAll("fe(o)", "o")
      .replaceAll("CrabCode", sourceTitle)
      .replaceAll("crabcode", sourceLower);

    expect(reverted).toBe(source);
    expect(Buffer.byteLength(target) - Buffer.byteLength(source)).toBe(106);
  },
);

integrationTest(
  "produces equivalent meta, report, and declined-patch artifacts from the same fixtures",
  async () => {
    const fixture = await tempDir("upstream-differential");
    const scanRoot = path.join(fixture, "scan-root");
    await mkdir(path.join(scanRoot, "docs"), { recursive: true });
    await mkdir(path.join(scanRoot, "src"), { recursive: true });
    await writeFile(path.join(scanRoot, "src", "app.py"), "print('ok')\n");

    const targetMetaRun = path.join(fixture, "target-meta-run");
    const sourceMetaRun = path.join(fixture, "source-meta-run");
    await mkdir(targetMetaRun);
    await mkdir(sourceMetaRun);
    for (const [scriptRoot, runDir] of [
      [targetScripts, targetMetaRun],
      [sourceScripts, sourceMetaRun],
    ] as const) {
      const result = run(
        "python3",
        [
          path.join(scriptRoot, "write_scan_meta.py"),
          runDir,
          scanRoot,
          "--mode",
          "scan",
          "--effort",
          "high",
        ],
        { cwd: scanRoot },
      );
      requireSuccess(result, "write_scan_meta.py differential fixture");
    }
    const targetMeta = JSON.parse(
      await readFile(path.join(targetMetaRun, "scan-meta.json"), "utf8"),
    );
    const sourceMeta = JSON.parse(
      normalizeSourceBrand(
        await readFile(path.join(sourceMetaRun, "scan-meta.json"), "utf8"),
      ),
    );
    expect(targetMeta).toMatchObject({
      scan_root: await realpath(scanRoot),
      source_root: await realpath(scanRoot),
      analysis_root: await realpath(scanRoot),
      report_dir: await realpath(fixture),
      source_revision: targetMeta.revision,
      revision_source: "tool-captured",
      snapshot_kind: "live-source-compatibility",
      analysis_content: {
        algorithm: "sha256-path-mode-content-v1",
      },
      top_level_entries: ["docs", "src"],
    });
    for (const field of [
      "scan_root",
      "flow",
      "agent",
      "mode",
      "scope",
      "effort",
      "model",
      "revision",
      "top_level_dirs",
    ]) {
      expect(sourceMeta[field]).toEqual(targetMeta[field]);
    }

    const {
      products: targetProducts,
      runDir: targetReportRun,
    } = await createOwnedReportRun(scanRoot);
    const sourceProducts = path.join(
      scanRoot,
      `${sourceUpper}-SECURITY-20260723-120000-0123456789abcdef`,
    );
    const sourceReportRun = path.join(
      sourceProducts,
      `.${sourceLower}-security-run`,
    );
    await mkdir(sourceReportRun, { recursive: true });
    await writeRenderInputs(targetReportRun, "CRABCODE-SECURITY", true);
    await writeRenderInputs(
      sourceReportRun,
      `${sourceUpper}-SECURITY`,
      false,
    );
    expect(
      await readFile(
        path.join(targetProducts, ".crabcode-security-owner.json"),
        "utf8",
      ),
    ).toBe(
      await readFile(
        path.join(targetReportRun, ".crabcode-security-owner.json"),
        "utf8",
      ),
    );
    requireSuccess(
      run(
        "python3",
        [
          path.join(targetScripts, "render_report.py"),
          targetReportRun,
          "--products-dir",
          targetProducts,
        ],
        { cwd: fixture },
      ),
      "target render_report.py",
    );
    requireSuccess(
      run(
        "python3",
        [
          path.join(sourceScripts, "render_report.py"),
          sourceReportRun,
          "--products-dir",
          sourceProducts,
        ],
        { cwd: fixture },
      ),
      "source render_report.py",
    );
    expect(existsSync(targetReportRun)).toBe(false);
    expect(
      existsSync(path.join(targetProducts, ".crabcode-security-owner.json")),
    ).toBe(true);
    expect(
      await readFile(
        path.join(targetProducts, "CRABCODE-SECURITY-RESULTS.jsonl"),
        "utf8",
      ),
    ).toBe(
      await readFile(
        path.join(sourceProducts, `${sourceUpper}-SECURITY-RESULTS.jsonl`),
        "utf8",
      ),
    );
    const stampTail = "0123456789ab-dirty.json";
    const targetStamp = JSON.parse(
      await readFile(
        path.join(targetProducts, `CRABCODE-SECURITY-REVISION-${stampTail}`),
        "utf8",
      ),
    );
    const sourceStamp = JSON.parse(
      await readFile(
        path.join(
          sourceProducts,
          `${sourceUpper}-SECURITY-REVISION-${stampTail}`,
        ),
        "utf8",
      ),
    );
    for (const stamp of [targetStamp, sourceStamp]) {
      stamp.generated_at = "<generated-at>";
      stamp.products_dir = "<products-dir>";
      stamp.scan_root = "<scan-root>";
    }
    expect(targetStamp).toMatchObject({
      source_root: await realpath(scanRoot),
      source_revision: targetStamp.revision,
      revision_source: "tool-captured",
      analysis: {
        snapshot_kind: "fixture-empty-analysis",
      },
    });
    const {
      source_root: _sourceRoot,
      source_revision: _sourceRevision,
      analysis: _analysis,
      ...targetCommonStamp
    } = targetStamp;
    sourceStamp.revision_source = "tool-captured";
    expect(sourceStamp).toEqual(targetCommonStamp);

    const patchRoot = path.join(fixture, "patch-root");
    await mkdir(patchRoot);
    for (const [command, args] of [
      ["git", ["init", "-q"]],
      ["git", ["config", "user.email", "security-tests@example.invalid"]],
      ["git", ["config", "user.name", "Security Tests"]],
    ] as const) {
      requireSuccess(
        run(command, [...args], { cwd: patchRoot }),
        `${command} ${args.join(" ")}`,
      );
    }
    await writeFile(path.join(patchRoot, "tracked.txt"), "base\n");
    requireSuccess(
      run("git", ["add", "--", "tracked.txt"], { cwd: patchRoot }),
      "git add patch fixture",
    );
    requireSuccess(
      run("git", ["commit", "-q", "-m", "patch fixture"], { cwd: patchRoot }),
      "git commit patch fixture",
    );
    const patchBase = run("git", ["rev-parse", "HEAD"], {
      cwd: patchRoot,
    }).stdout.trim();
    const patchRunId = "20260723-120100-0123456789012345";
    const {
      products: targetPatchReport,
      runDir: targetScanRun,
      sourceRoot: canonicalPatchRoot,
    } = await createOwnedRenderedReport(patchRoot, patchRunId);
    expect(existsSync(targetScanRun)).toBe(false);
    const patchFinding = {
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
    };
    await writeFile(
      path.join(targetPatchReport, "CRABCODE-SECURITY-RESULTS.jsonl"),
      `${JSON.stringify(patchFinding)}\n`,
    );
    await writeJson(
      path.join(
        targetPatchReport,
        `CRABCODE-SECURITY-REVISION-${patchBase.slice(0, 12)}.json`,
      ),
      {
        scan_root: canonicalPatchRoot,
        source_root: canonicalPatchRoot,
        products_dir: targetPatchReport,
        mode: "scan",
        revision: { versioned: true, commit: patchBase, dirty: false },
        findings: { total: 1, high: 1, medium: 0, low: 0 },
        verification: { status: "verified" },
      },
    );
    const preparedTarget = run(
      "python3",
      [
        path.join(targetScripts, "patch_artifacts.py"),
        "--prepare-run",
        targetPatchReport,
        patchRoot,
        "--base",
        patchBase,
        "--selection",
        "F1",
      ],
      { cwd: fixture },
    );
    requireSuccess(preparedTarget, "target patch_artifacts.py --prepare-run");
    const targetPatchOwner = JSON.parse(preparedTarget.stdout);
    const targetPatchDir = targetPatchOwner.patch_dir;
    const targetPatches = targetPatchOwner.patches_dir;
    const sourcePatchReport = path.join(
      patchRoot,
      `${sourceUpper}-SECURITY-${patchRunId}`,
    );
    const sourcePatchDir = path.join(
      sourcePatchReport,
      `.${sourceLower}-security-run`,
      "patch-2026-07-23",
    );
    const sourcePatches = path.join(sourcePatchReport, "patches");
    await mkdir(sourcePatchDir, { recursive: true });
    await mkdir(sourcePatches, { recursive: true });
    await writeDeclinedPatchInputs(targetPatchDir);
    await writeDeclinedPatchInputs(sourcePatchDir);
    requireSuccess(
      run(
        "python3",
        [
          path.join(targetScripts, "patch_artifacts.py"),
          targetPatchDir,
          targetPatches,
          patchRoot,
          "--base",
          patchBase,
        ],
        { cwd: fixture },
      ),
      "target patch_artifacts.py",
    );
    requireSuccess(
      run(
        "python3",
        [
          path.join(sourceScripts, "patch_artifacts.py"),
          sourcePatchDir,
          sourcePatches,
          patchRoot,
          "--base",
          patchBase,
        ],
        { cwd: fixture },
      ),
      "source patch_artifacts.py",
    );
    expect(existsSync(path.join(targetPatchReport, ".crabcode-security-run"))).toBe(
      false,
    );
    expect(
      existsSync(
        path.join(targetPatchReport, ".crabcode-security-owner.json"),
      ),
    ).toBe(true);
    for (const name of ["F1.md", "patches.jsonl"]) {
      expect(await readFile(path.join(sourcePatches, name), "utf8")).toBe(
        await readFile(path.join(targetPatches, name), "utf8"),
      );
    }
    expect(
      normalizeSourceBrand(
        await readFile(path.join(sourcePatches, "PATCHES.md"), "utf8"),
      ),
    ).toBe(await readFile(path.join(targetPatches, "PATCHES.md"), "utf8"));
  },
);
