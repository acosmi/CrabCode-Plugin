---
name: cross-border-transfer-check
description: Prepare an initial PRC cross-border data transfer path workpaper.
argument-hint: "[transfer facts]"
---

# /cn-data-compliance:cross-border-transfer-check

【AI 辅助草稿，需律师复核】

Prepare an initial cross-border data transfer path analysis. This does not complete a filing, certification, or standard contract process.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Collect transfer facts:
   - transferor and overseas recipient.
   - data categories and volume.
   - personal information and sensitive personal information.
   - important data candidate.
   - purpose, necessity, frequency, and storage location.
   - recipient jurisdiction and onward transfer.
2. Classify candidate path:
   - security assessment.
   - standard contract.
   - certification.
   - exemption or no-transfer conclusion requiring verification.
3. Identify required documents and missing facts.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return path table, missing facts, document checklist, source status, and lawyer review points.
