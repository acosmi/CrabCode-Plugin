---
name: 事项深度尽调
short-description: 对多份案卷材料开展事实证据与法律研究双链路分析,形成可回溯的律师复核备忘录
description: 对一个中国法律事项的多份案卷/合同/证据做完整读取、问题树、法条与类案研究、证据链、跨领域专家回流和红队复核,输出可增量更新的内部深度分析备忘录。当用户说深度分析这些材料/一堆案卷帮我看/做尽调或案件 memo/梳理争点证据与类案/跨合同诉讼数据劳动知产综合研判时使用;单文件简单摘要不使用本技能。
argument-hint: "[matter id] [document paths or pasted text]"
---

# crablaw-cn:matter-deep-analysis

【AI 辅助草稿，需律师复核】

This is CrabLaw-CN's flagship multi-document analysis workflow. It may be triggered directly, but it
uses the same control plane, matter store, registry, source policy, and review queue as
`crablaw-cn:legal-workbench`.

## Load before analysis

Read completely:

- `${CRABCODE_PLUGIN_ROOT}/matter-core/PRACTICE.md`;
- `${CRABCODE_PLUGIN_ROOT}/legal-core/PRACTICE.md`;
- `${CRABCODE_PLUGIN_ROOT}/legal-core/capability-registry.json`;
- `${CRABCODE_PLUGIN_ROOT}/legal-core/references/official-source-policy.md`;
- `${CRABCODE_PLUGIN_ROOT}/legal-core/references/legal-reasoning-modes.md`;
- `${CRABCODE_PLUGIN_ROOT}/legal-core/references/argument-quality-policy.md`.

## Matter Gate

Apply the Required Gate in `matter-core/PRACTICE.md`. Confirm user role, client, matter, parties,
engagement scope, permissions, conflict status, responsible lawyer, review owner, source write
ability, and an internal output destination. Stop on any blocking stop code.

If the store is missing, route to `crablaw-cn:legal-workbench` for intake. The deterministic local
bootstrap is available at:

```text
python3 ${CRABCODE_PLUGIN_ROOT}/matter-core/scripts/bootstrap_matter.py ...
```

Do not infer missing matter type, lawyer, review owner, party, or permission values.

## Two independent input lanes

### Matter-document lane

Register each supplied document as a user-provided source, assign a document ID, and use one
Agent(crablaw-cn:diligence-reader) per document. The Reader has no network/write access. Aggregate
its outputs into:

- `document-index.json`;
- `fact-chronology.json`;
- initial issue signals.

Track exact read coverage, OCR quality, missing ranges, duplicates, versions, disputed statements,
and evidence pinpoints. A document statement is not automatically an established fact.

### Legal-research lane

After the issue tree exists, send one minimized issue task at a time to
Agent(crablaw-cn:legal-researcher). Do not expose unrelated matter documents. Record official law,
guidance, cases, contrary authority, validity checks, and access limitations in `sources.jsonl` and
issue-level case-comparison artifacts.

## Five-stage workflow

1. **Plan** — create run ID, analysis plan, document list, issue IDs, target domains, expected
   artifacts, and stop conditions.
2. **Read** — complete the document lane and validate coverage/fact/evidence artifacts.
3. **Research** — complete the source lane; unresolved authorities remain needs-check.
4. **Analyze and specialize** — build claim-element-evidence maps; run
   Agent(crablaw-cn:diligence-analyzer); route scoped tasks to canonical domain capabilities and
   record identified → routed → accepted → specialist-returned → integrated → reviewed/closed.
5. **Red-team and write** — run Agent(crablaw-cn:diligence-reviewer), execute deterministic
   validation, then allow Agent(crablaw-cn:diligence-writer) to render the internal memo.

Between stages, validate the artifact against its schema under
`${CRABCODE_PLUGIN_ROOT}/legal-core/schemas/`. Malformed data stops the handoff.

## Required run layout

Use the active matter store and keep state under `matters/<matter-id>/runs/<run-id>/`:

```text
run-manifest.json
analysis-plan.json
document-index.json
fact-chronology.json
issue-tree.json
claim-evidence-map.json
case-comparison/*.json
analyzer-findings.json
specialist-findings.json
review-queue-item.json
```

Write the final memo below the matter `outputs/` directory. Keep source and audit JSONL files at the
matter root.

## Traceability rules

- Every applied legal conclusion has `issueId`, source-record IDs, and fact IDs.
- Evidence IDs resolve to an indexed document and pinpoint.
- `[已核验-来源]` requires a current official-law/guidance/case source record.
- `[模型知识-待核]` requires a `source-needs-check` record.
- Outcome/practice-sensitive findings link a case comparison or state why one is unavailable.
- Open specialist work has a limitation/blocking reason and remains reviewer-visible.
- RED/YELLOW severity cannot be silently downgraded.

## Incremental refresh

Use the hash synchronizer in dry-run mode first:

```text
python3 ${CRABCODE_PLUGIN_ROOT}/matter-core/scripts/sync_run_manifest.py \
  --matter-id <matter-id> --run-id <run-id>
```

With user-authorized local writes, rerun with `--apply`. It only computes hashes and marks dependent
issues/artifacts stale; it does not start background work. Explicitly rerun stale issues and validate
again.

## Deterministic completion gate

Before Writer rendering and again before treating the run as ready for review, run:

```text
python3 ${CRABCODE_PLUGIN_ROOT}/matter-core/scripts/validate_run.py \
  --matter-id <matter-id> --run-id <run-id> --strict
```

Add `--require-verified-source` when the memo contains any verified legal conclusion. A failed
validator blocks completion.

## Deliverable

Produce an internal memo containing reviewer note, scope/coverage, RED→YELLOW→GREEN findings,
claim/evidence/source traceability, contrary arguments, case-comparison summaries, missing facts and
sources, open specialist limitations, and a next-step decision tree. Create a `pending-review` item
with `sourceCapability: crablaw-cn:matter-deep-analysis` and append a non-sensitive audit event.

Engineering validation is not legal approval. Never mark the memo ready to send, file, sign, or
publish without a separate named-lawyer decision.

## Optional document output

If the user requests a Word deliverable after the Markdown memo passes review, route to
`crabcode-office-suite:crabcode-documents`. If unavailable, keep the validated Markdown; do not make
the office suite a hard plugin dependency.
