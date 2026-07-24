import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const REPO_ROOT = path.resolve(import.meta.dir, "../..");
export const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", "crabcode-security");

export async function tempDir(label: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `crabcode-security-${label}-`));
}

export function run(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
  } = {},
): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
      ...(options.env ?? {}),
    },
    input: options.input,
    encoding: "utf8",
    timeout: 30_000,
  });
}

export function requireSuccess(result: SpawnSyncReturns<string>, context: string): void {
  if (result.error || result.status !== 0) {
    throw new Error(
      `${context} failed (status ${String(result.status)}):\n${result.stderr}\n${String(result.error ?? "")}`,
    );
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export const EMPTY_ANALYSIS_CONTENT = {
  algorithm: "sha256-path-mode-content-v1",
  sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  entries: 0,
  bytes: 0,
} as const;

export const FIXTURE_RUN_ID = "20260723-120000-0123456789abcdef";

export async function createOwnedRenderedReport(
  sourceRoot: string,
  runId = FIXTURE_RUN_ID,
): Promise<{
  products: string;
  runDir: string;
  sourceRoot: string;
  owner: string;
}> {
  const canonicalSource = await realpath(sourceRoot);
  const products = path.join(canonicalSource, `CRABCODE-SECURITY-${runId}`);
  const runDir = path.join(products, ".crabcode-security-run");
  await mkdir(products);
  await writeFile(path.join(products, ".gitignore"), "*\n");
  const owner = `${JSON.stringify({
    schema: "crabcode-security-run-owner/v1",
    owner: "crabcode-security",
    run_id: runId,
    source_root: canonicalSource,
    report_dir: products,
    run_dir: runDir,
  })}\n`;
  await writeFile(path.join(products, ".crabcode-security-owner.json"), owner);
  return { products, runDir, sourceRoot: canonicalSource, owner };
}

export async function createOwnedReportRun(
  sourceRoot: string,
  runId = FIXTURE_RUN_ID,
): Promise<{
  products: string;
  runDir: string;
  analysisRoot: string;
  sourceRoot: string;
}> {
  const {
    products,
    runDir,
    sourceRoot: canonicalSource,
    owner,
  } = await createOwnedRenderedReport(sourceRoot, runId);
  const analysisRoot = path.join(runDir, "analysis-root");
  await mkdir(analysisRoot, { recursive: true });
  await writeFile(path.join(runDir, ".gitignore"), "*\n");
  await writeFile(path.join(runDir, ".crabcode-security-owner.json"), owner);
  return {
    products,
    runDir,
    analysisRoot,
    sourceRoot: canonicalSource,
  };
}

export async function writeScanMetaFixture(
  runDir: string,
  revision: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const canonicalRun = await realpath(runDir);
  const reportDir = await realpath(path.dirname(canonicalRun));
  const sourceRoot = await realpath(path.dirname(reportDir));
  const analysisRoot = await realpath(path.join(canonicalRun, "analysis-root"));
  await writeJson(path.join(canonicalRun, "scan-meta.json"), {
    scan_root: sourceRoot,
    source_root: sourceRoot,
    analysis_root: analysisRoot,
    report_dir: reportDir,
    run_dir: canonicalRun,
    mode: "scan",
    scope: [],
    effort: "low",
    revision,
    source_revision: { ...revision },
    revision_source: "tool-captured",
    snapshot_kind: "fixture-empty-analysis",
    analysis_content: EMPTY_ANALYSIS_CONTENT,
    ...overrides,
  });
}
