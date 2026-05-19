---
name: data-processing-review
description: Review entrusted processing, joint processing, third-party SDK, and vendor data clauses under PRC data compliance workflow.
argument-hint: "[agreement, SDK list, vendor facts, or clause text]"
---

# /cn-data-compliance:data-processing-review

【AI 辅助草稿，需律师复核】

Review vendor or third-party data processing arrangements.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

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
