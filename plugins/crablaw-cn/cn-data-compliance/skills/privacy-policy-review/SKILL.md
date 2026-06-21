---
name: privacy-policy-review
description: 在中国法数据合规工作流中审查隐私政策、App 告知、小程序告知或个人信息处理规则。当用户提到审隐私政策/隐私协议看看/用户协议合规/App 告知/收集使用规则/个人信息处理规则,或需要对隐私文本做合规把关时使用本技能(即使未明说"审查")。
argument-hint: "[policy text or file path]"
---

# /cn-data-compliance:privacy-policy-review

【AI 辅助草稿，需律师复核】

Review a privacy policy or personal information notice. Do not mark it approved for publication.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Extract notice structure:
   - processor identity and contact.
   - purposes and processing methods.
   - data categories.
   - retention periods.
   - individual rights and exercise methods.
   - third-party sharing, entrusted processing, disclosure, and transfer.
   - sensitive personal information.
   - minors.
   - cross-border transfer.
2. Compare against user-provided data map and product facts.
3. Flag mismatch between actual processing and notice language.
4. Record verified legal sources in `sources.jsonl`. For any point that cannot be verified, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return issue table, proposed wording, missing data-map facts, source records, and lawyer review points.
