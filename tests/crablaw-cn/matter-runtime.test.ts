import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const scriptRoot = path.join(repoRoot, "plugins", "crablaw-cn", "matter-core", "scripts");

function runPython(script: string, args: string[]) {
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

async function writeJson(file: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function bootstrap(root: string, matterId = "demo-matter", clientId = "demo-client", counterparty = "示例供应商") {
  return runPython("bootstrap_matter.py", [
    "--root", root,
    "--matter-id", matterId,
    "--client-id", clientId,
    "--client-name", clientId === "demo-client" ? "示例客户" : "第二客户",
    "--title", "合成合同争议",
    "--scope", "内部分析合同履行与证据问题",
    "--matter-type", "litigation",
    "--responsible-lawyer", "张律师",
    "--review-owner", "王律师",
    "--allowed-user", "test.user",
    "--party", `client:${clientId === "demo-client" ? "示例客户" : "第二客户"}`,
    "--party", `counterparty:${counterparty}`,
  ]);
}

async function makeValidRun() {
  const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-runtime-"));
  const created = await bootstrap(root);
  expect(created.exitCode).toBe(0);
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
      status: "unreviewed",
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
      status: "unreviewed",
    },
  ];
  await writeFile(path.join(matterDir, "sources.jsonl"), `${sources.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await mkdir(runDir, { recursive: true });

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
    "issue-tree.json": {
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
    },
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
    const full = relative.startsWith("runs/") || relative.startsWith("outputs/")
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
    artifacts,
    staleIssueIds: [],
    completedStepIds: ["plan", "read", "research", "analyze", "review"],
    reviewState: "pending-lawyer-review",
    externalRelease: "prohibited",
  });

  return { root, matterDir, runDir, inputPath };
}

describe("CrabLaw matter runtime", () => {
  test("bootstrap creates a private matter and blocks a later local conflict hit", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-bootstrap-"));
    expect((await bootstrap(root)).exitCode).toBe(0);
    const matterPath = path.join(root, "matters", "demo-matter", "matter.json");
    expect((await stat(matterPath)).mode & 0o077).toBe(0);
    const overwrite = await bootstrap(root);
    expect(overwrite.exitCode).toBe(2);
    expect(overwrite.stdout).toContain("refusing to overwrite");
    const hit = await bootstrap(root, "second-matter", "second-client", "示例客户");
    expect(hit.exitCode).toBe(10);
    const matter = JSON.parse(await readFile(path.join(root, "matters", "second-matter", "matter.json"), "utf8"));
    expect(matter.status).toBe("pending-conflict-review");
  });

  test("an existing store lock blocks a concurrent bootstrap writer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-lock-"));
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
    const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-schema-"));
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
