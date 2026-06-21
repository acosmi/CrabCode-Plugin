---
name: privacy-policy-review
description: Review a privacy policy, app notice, mini-program notice, or personal information processing rule under PRC data compliance workflow.
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
