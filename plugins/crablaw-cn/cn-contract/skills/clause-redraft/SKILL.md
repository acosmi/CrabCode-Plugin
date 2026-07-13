---
name: 合同条款改写
short-description: 在活跃事项内起草或修订中国法合同条款,产出供律师复核的条款稿
description: 在活跃事项内起草或修订中国法合同条款,产出供律师复核的条款稿。当用户提到改条款/重写这条/帮我拟一条/条款怎么写/这段改一下/给个替代表述,或需要对某具体条款做改写打磨时使用本技能(即使未明说"改写")。
argument-hint: "[clause text and objective]"
---

# /cn-contract:clause-redraft

【AI 辅助草稿，需律师复核】

Draft clause language for review. Do not present the clause as final or approved.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). If conflict-check status is `pending`, stop before drafting and emit `CONFLICT_CHECK_PENDING`; if `hit-review-required`, stop and emit `CONFLICT_REVIEW_REQUIRED`. Stop with the matching matter-core stop code if any other check fails.

## Workflow

1. Identify the clause type and user objective.
2. Ask for missing facts when the requested drafting depends on commercial terms.
3. Draft a conservative version aligned with PRC contract principles and the active profile.
4. Add alternatives only when the business tradeoff is clear.
5. Mark legal-source gaps as `[需核验]` AND write a paired entry in `sources.jsonl` (`source-record` with `status: source-needs-check`; `effectiveStatus` must describe what verification is needed). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. Create or update a review queue item.

## Output

Return:

- Draft clause.
- Rationale.
- Business choices.
- Legal verification points.
- Negotiation notes.

## 产出物路由

- 需要将条款改写稿(含修订说明)交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
