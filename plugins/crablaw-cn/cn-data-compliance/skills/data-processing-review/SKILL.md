---
name: data-processing-review
description: 在中国法数据合规工作流中审查委托处理、共同处理、第三方 SDK 及供应商数据条款。当用户提到供应商数据协议/委托处理协议/共同处理/接入了 SDK/数据处理条款/外包数据/合作方拿数据,或需要审查第三方/供应商的数据安排时使用本技能(即使未明说"审查")。
argument-hint: "[agreement, SDK list, vendor facts, or clause text]"
---

# /cn-data-compliance:data-processing-review

【AI 辅助草稿，需律师复核】

Review vendor or third-party data processing arrangements.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Identify processing relationship:
   - entrusted processing.
   - joint processing.
   - independent recipient.
   - third-party SDK.
   - public disclosure or transfer.
2. Extract purposes, categories, retention, security measures, subcontracting, audit, deletion/return, incident notification, and individual-right cooperation.
3. Check whether separate consent, notice update, PIA, or cross-border review is needed.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return relationship classification, clause gaps, action list, missing facts, source records, and review points.
