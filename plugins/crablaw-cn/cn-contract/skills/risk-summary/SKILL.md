---
name: risk-summary
description: 将中国法合同复核底稿转化为面向内部业务方的风险摘要。当用户提到给业务方说人话/风险点总结/给老板/领导汇报/合同有哪些坑/精简版风险/出个摘要,或需要把法律审查结论转成业务能懂的概要时使用本技能(即使未明说"风险摘要")。
argument-hint: "[review output path or pasted review]"
---

# /cn-contract:risk-summary

【AI 辅助草稿，需律师复核】

Prepare an internal business-facing summary from a contract review. Do not send externally and do not remove lawyer-review caveats.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Additionally confirm the upstream review item exists; risk summaries must derive from a recorded review item, not from raw input. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Load the review output or pasted review.
2. Preserve risk severity and lawyer-review flags.
3. Translate legal detail into business impact:
   - money.
   - operational burden.
   - delivery risk.
   - termination risk.
   - data/IP exposure.
4. Remove privileged strategy only if the user asks for a broader internal audience summary; keep a note that the sanitized version still requires legal review.
5. Create or update a review queue item.

## Output

Return a concise internal summary, decision points, owner list, and lawyer review caveats.
