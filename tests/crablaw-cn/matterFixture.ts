import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const repoRoot = path.resolve(".");
export const scriptRoot = path.join(repoRoot, "plugins", "crablaw-cn", "matter-core", "scripts");

export interface PythonResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runPython(script: string, args: string[]): PythonResult {
  const result = Bun.spawnSync(["python3", path.join(scriptRoot, script), ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

/** Start a script without waiting, so two writers can genuinely race. */
export function spawnPython(script: string, args: string[]) {
  return Bun.spawn(["python3", path.join(scriptRoot, script), ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
}

export async function collectPython(child: ReturnType<typeof spawnPython>): Promise<PythonResult> {
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
}

export async function writeJson(file: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function readJson<T = any>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

export async function makeRoot(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export interface BootstrapOptions {
  matterId?: string;
  clientId?: string;
  clientName?: string;
  counterparty?: string;
  title?: string;
}

export function bootstrapArgs(root: string, options: BootstrapOptions = {}): string[] {
  const clientId = options.clientId ?? "demo-client";
  const clientName = options.clientName ?? (clientId === "demo-client" ? "示例客户" : "第二客户");
  return [
    "--root", root,
    "--matter-id", options.matterId ?? "demo-matter",
    "--client-id", clientId,
    "--client-name", clientName,
    "--title", options.title ?? "合成合同争议",
    "--scope", "内部分析合同履行与证据问题",
    "--matter-type", "litigation",
    "--responsible-lawyer", "张律师",
    "--review-owner", "王律师",
    "--allowed-user", "test.user",
    "--party", `client:${clientName}`,
    "--party", `counterparty:${options.counterparty ?? "示例供应商"}`,
  ];
}

export async function bootstrap(
  root: string,
  matterId = "demo-matter",
  clientId = "demo-client",
  counterparty = "示例供应商",
): Promise<PythonResult> {
  return runPython("bootstrap_matter.py", bootstrapArgs(root, { matterId, clientId, counterparty }));
}

export interface RunFixture {
  root: string;
  matterDir: string;
  runDir: string;
  inputPath: string;
  sourcesPath: string;
}

export async function makeValidRun(): Promise<RunFixture> {
  const root = await makeRoot("crablaw-runtime-");
  const created = await bootstrap(root);
  if (created.exitCode !== 0) {
    throw new Error(`fixture bootstrap failed (${created.exitCode}): ${created.stdout}${created.stderr}`);
  }
  const matterDir = path.join(root, "matters", "demo-matter");
  const runDir = path.join(matterDir, "runs", "run-001");
  const inputPath = path.join(matterDir, "inputs", "agreement.txt");
  await mkdir(path.dirname(inputPath), { recursive: true });
  await writeFile(inputPath, "用户提供：2026年8月1日双方签署合同，供应商应在8月10日前交付。\n");
  const inputHash = await sha256(inputPath);

  const sources = [
    {
      sourceId: "src-document",
      matterId: "demo-matter",
      sourceType: "user-provided",
      title: "合成合同材料",
      urlOrRecordId: "inputs/agreement.txt",
      retrievedAt: "2026-08-21",
      effectiveStatus: "用户提供的合成测试材料",
      documentId: "doc-agreement",
      contentHash: inputHash,
      confidentiality: "standard",
      accessScope: "本事项内部",
      status: "unreviewed",
    },
    {
      sourceId: "src-law",
      matterId: "demo-matter",
      sourceType: "official-law",
      title: "合成测试用现行法律记录",
      authority: "国家立法机关官方来源（合成记录）",
      urlOrRecordId: "official-record:test-only",
      retrievedAt: "2026-08-21",
      effectiveStatus: "合成测试记录，不承载真实法律结论",
      pinpoint: "测试条目",
      status: "verified",
    },
    {
      sourceId: "src-case",
      matterId: "demo-matter",
      sourceType: "case",
      title: "合成类案记录",
      authority: "人民法院官方案例来源（合成记录）",
      urlOrRecordId: "official-case:test-only",
      retrievedAt: "2026-08-21",
      effectiveStatus: "合成测试记录，不承载真实裁判信息",
      pinpoint: "测试裁判要旨",
      status: "verified",
    },
  ];
  const sourcesPath = path.join(matterDir, "sources.jsonl");
  await writeFile(sourcesPath, `${sources.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await mkdir(runDir, { recursive: true });

  const issueTree = {
    schemaVersion: 1,
    runId: "run-001",
    matterId: "demo-matter",
    issues: [{
      issueId: "issue-delivery",
      title: "是否存在逾期交付风险",
      priority: "high",
      status: "resolved-internal",
      documentIds: ["doc-agreement"],
      factIds: ["fact-deadline"],
      evidenceIds: ["evidence-clause"],
      requiredResearch: ["核验适用规范"],
      targetDomains: ["contract", "litigation"],
      specialistTaskIds: [],
    }],
  };

  const payloads: Record<string, unknown> = {
    "analysis-plan.json": {
      schemaVersion: 1,
      planId: "plan-001",
      runId: "run-001",
      matterId: "demo-matter",
      status: "complete",
      createdAt: "2026-08-21T10:00:00Z",
      updatedAt: "2026-08-21T10:10:00Z",
      documentIds: ["doc-agreement"],
      issues: [{
        issueId: "issue-delivery",
        title: "是否存在逾期交付风险",
        priority: "high",
        status: "complete",
        documentIds: ["doc-agreement"],
        requiredResearch: ["核验适用规范"],
        targetDomains: ["contract", "litigation"],
      }],
    },
    "document-index.json": {
      schemaVersion: 1,
      runId: "run-001",
      matterId: "demo-matter",
      documents: [{
        documentId: "doc-agreement",
        sourceRecordId: "src-document",
        path: "inputs/agreement.txt",
        sha256: inputHash,
        status: "read-complete",
        coverage: { scope: "全文", complete: true, ocrQuality: "not-applicable" },
        issueIds: ["issue-delivery"],
        confidentiality: "standard",
      }],
    },
    "fact-chronology.json": {
      schemaVersion: 1,
      runId: "run-001",
      matterId: "demo-matter",
      facts: [{
        factId: "fact-deadline",
        statement: "材料记载交付期限为2026年8月10日",
        sourceDocumentIds: ["doc-agreement"],
        evidenceIds: ["evidence-clause"],
        occurredAt: "2026-08-10",
        status: "document-stated",
        confidenceBasis: "用户提供材料的明确文字",
        missing: false,
      }],
      evidence: [{
        evidenceId: "evidence-clause",
        documentId: "doc-agreement",
        pinpoint: "第1行",
        purpose: "证明材料记载的交付期限",
        authenticity: "unreviewed",
        legality: "unreviewed",
        relevance: "supported",
        weight: "medium",
      }],
    },
    "issue-tree.json": issueTree,
    "claim-evidence-map.json": {
      schemaVersion: 1,
      runId: "run-001",
      matterId: "demo-matter",
      claims: [{
        claimId: "claim-delivery",
        issueId: "issue-delivery",
        statement: "材料显示需要进一步核验逾期交付责任",
        elementIds: ["element-deadline"],
        counterarguments: ["尚未提供实际交付日期"],
        confidence: "medium",
        reviewRequired: true,
      }],
      elements: [{
        elementId: "element-deadline",
        claimId: "claim-delivery",
        statement: "合同记载明确交付期限",
        factIds: ["fact-deadline"],
        evidenceIds: ["evidence-clause"],
        sourceRecordIds: ["src-law"],
        status: "partially-supported",
        missing: false,
      }],
    },
    "analyzer-findings.json": {
      schemaVersion: 1,
      matterId: "demo-matter",
      runId: "run-001",
      findings: [{
        findingId: "finding-delivery",
        issueId: "issue-delivery",
        category: "legal-conclusion",
        statement: "现有材料支持进一步审查是否构成逾期交付，但实际交付日期仍缺失",
        citationTag: "[已核验-来源]",
        sourceRecordIds: ["src-law"],
        factIds: ["fact-deadline"],
        evidenceIds: ["evidence-clause"],
        severity: "yellow",
        confidenceBasis: "规范记录已登记，关键履行事实仍缺失",
        reviewRequired: true,
        producedBy: "diligence-analyzer",
        recommendation: "补充实际交付记录并由律师复核",
        caseComparisonRequired: true,
      }],
    },
    "specialist-findings.json": {
      schemaVersion: 1,
      matterId: "demo-matter",
      runId: "run-001",
      tasks: [],
    },
  };
  for (const [filename, payload] of Object.entries(payloads)) {
    await writeJson(path.join(runDir, filename), payload);
  }
  const comparisonPath = path.join(runDir, "case-comparison", "issue-delivery.json");
  await writeJson(comparisonPath, {
    schemaVersion: 1,
    matterId: "demo-matter",
    runId: "run-001",
    issueId: "issue-delivery",
    searchDate: "2026-08-21",
    sourcesSearched: ["人民法院官方案例来源（合成测试）"],
    cases: [{
      sourceRecordId: "src-case",
      caseTitle: "合成类案",
      court: "合成法院",
      caseDate: "2026-01-01",
      factsMatch: "仅用于验证结构",
      ruleOrHolding: "不承载真实裁判规则",
      difference: "不用于实务依赖",
      weight: "weak",
      citationTag: "[已核验-来源]",
    }],
    caseSearchLimitations: "合成测试只有一条案例记录",
    conclusion: "仅验证案例比较契约",
  });

  const memoPath = path.join(matterDir, "outputs", "run-001-memo.md");
  await mkdir(path.dirname(memoPath), { recursive: true });
  await writeFile(memoPath, "【AI 辅助草稿，需律师复核】\n\n合成测试备忘录。\n");
  const reviewItem = {
    reviewItemId: "review-run-001",
    matterId: "demo-matter",
    sourcePlugin: "matter-core",
    sourceSkill: "matter-deep-analysis",
    sourceCapability: "crablaw-cn:matter-deep-analysis",
    runId: "run-001",
    issueIds: ["issue-delivery"],
    outputPath: "outputs/run-001-memo.md",
    status: "pending-review",
    createdAt: "2026-08-21",
  };
  await writeJson(path.join(runDir, "review-queue-item.json"), reviewItem);

  // Establish the document/source baseline with the real sync tool rather than
  // re-deriving Python's record digest in TypeScript, then restore the clean
  // run state the fixture is supposed to represent.
  const primed = runPython("sync_run_manifest.py", [
    "--root", root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    "--apply",
  ]);
  if (primed.exitCode !== 0) {
    throw new Error(`fixture source baseline failed: ${primed.stdout}${primed.stderr}`);
  }
  const primedManifest = await readJson(path.join(runDir, "run-manifest.json"));
  await writeJson(path.join(runDir, "issue-tree.json"), issueTree);

  const artifactFiles: Array<[string, string, string]> = [
    ["analysis-plan", "analysis-plan", "analysis-plan.json"],
    ["document-index", "document-index", "document-index.json"],
    ["fact-chronology", "fact-chronology", "fact-chronology.json"],
    ["issue-tree", "issue-tree", "issue-tree.json"],
    ["claim-evidence-map", "claim-evidence-map", "claim-evidence-map.json"],
    ["analysis-findings", "analysis-findings", "analyzer-findings.json"],
    ["specialist-findings", "specialist-findings", "specialist-findings.json"],
    ["case-comparison", "case-comparison", path.join("runs", "run-001", "case-comparison", "issue-delivery.json")],
    ["memo", "memo", path.relative(matterDir, memoPath)],
    ["review-item", "review-item", path.join("runs", "run-001", "review-queue-item.json")],
  ];
  const artifacts = [];
  for (const [artifactId, type, relative] of artifactFiles) {
    const head = relative.split(path.sep)[0];
    const full = head === "runs" || head === "outputs"
      ? path.join(matterDir, relative)
      : path.join(runDir, relative);
    const matterRelative = path.relative(matterDir, full);
    artifacts.push({
      artifactId,
      type,
      path: matterRelative,
      sha256: await sha256(full),
      status: "validated",
      dependsOnDocumentIds: ["doc-agreement"],
      dependsOnIssueIds: ["issue-delivery"],
    });
  }
  await writeJson(path.join(runDir, "run-manifest.json"), {
    schemaVersion: 1,
    runId: "run-001",
    matterId: "demo-matter",
    revision: 1,
    status: "ready-for-review",
    startedAt: "2026-08-21T10:00:00Z",
    updatedAt: "2026-08-21T10:20:00Z",
    documents: [{ documentId: "doc-agreement", sha256: inputHash }],
    sources: primedManifest.sources,
    artifacts,
    staleIssueIds: [],
    completedStepIds: ["plan", "read", "research", "analyze", "review"],
    reviewState: "pending-lawyer-review",
    externalRelease: "prohibited",
  });

  return { root, matterDir, runDir, inputPath, sourcesPath };
}

export async function readSources(fixture: RunFixture): Promise<Record<string, any>[]> {
  const raw = await readFile(fixture.sourcesPath, "utf8");
  return raw.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
}

export async function writeSources(fixture: RunFixture, rows: Record<string, any>[]): Promise<void> {
  await writeFile(fixture.sourcesPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}
