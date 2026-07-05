---
name: review
description: 在中国法工作流中对合同草稿或来件协议做律师复核式审查,产出复核工作底稿。当用户提到审合同/看看这份协议/合同有没有问题/合同风险/条款问题/帮我把把关,或拿到一份待签合同需要法律审核时使用本技能(即使未明说"审查")。
argument-hint: "[file path, pasted text, or matter facts]"
---

# /cn-contract:review

【AI 辅助草稿，需律师复核】

Review a contract under PRC law workflow controls. Do not mark the agreement as approved, ready to sign, or ready to send.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before reading the document body, additionally confirm the contract review fits the engagement scope and the output destination is the review queue. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Identify document type from title, preamble, exhibits, schedules, and signature blocks.
2. Extract parties, signing authority, seals, effective date, term, payment, delivery, acceptance, confidentiality, IP, data processing, termination, liability, dispute resolution, and governing law.
3. Compare against the active matter facts and the approved practice profile.
4. Check PRC-law issue areas:
   - Civil Code contract formation, validity, performance, termination, liability, force majeure, and changed circumstances.
   - Authorization, legal representative, seal and apparent authority issues.
   - Electronic signature and data message issues where relevant.
   - Confidentiality and trade secret controls.
   - IP ownership, license, deliverables, and infringement risk allocation.
   - Personal information or data processing cross-over clauses.
5. Record each legal source in `sources.jsonl` when a source is used. If no verified source is available, mark the issue `[需核验]` AND write a paired `source-record` entry in `sources.jsonl` with `status: source-needs-check`; the `effectiveStatus` field must describe what verification is needed. The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. Create a review queue item with status `pending-review`.

## Output

Use:

- Executive summary.
- Matter and document facts.
- Risk table.
- Clause issues and proposed drafting.
- Missing facts.
- Source table.
- Lawyer review points.

## Next Steps

Depending on the review outcome:

- For specific clause revisions: hand off to `/cn-contract:clause-redraft` with the target clause and objective.
- For a business-facing summary derived from this review: hand off to `/cn-contract:risk-summary` with this review item id.
- For confidentiality-only documents: prefer `/cn-contract:nda-review` instead of this generic review.
- When data, labor, or other regulatory issues surface, escalate to the matching domain skill (`/cn-data-compliance:data-activity-triage`, `/cn-labor-employment:employment-contract-review`).

## 产出物路由

- 需要将合同审查备忘录交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
