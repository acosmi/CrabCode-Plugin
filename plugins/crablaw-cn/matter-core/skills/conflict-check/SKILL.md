---
name: conflict-check
description: 在开展实质性法律工作前,为某事项生成初步利益冲突筛查记录。当用户提到利冲/冲突检查/利益冲突/查冲突/能不能接这个案子/有没有冲突,或需要在动手办案前先做冲突排查时使用本技能(即使未明说"利冲")。
argument-hint: "[matter id]"
---

# /matter-core:conflict-check

【AI 辅助草稿，需律师复核】

Run an initial conflicts screening workflow. This is not a final conflicts conclusion; a responsible lawyer must review and confirm.

## Workflow

1. Load the matter's `matter.json`, `parties.json`, and `permissions.json`.
2. Build search keys from:
   - Client names and identifiers.
   - Counterparties, affiliates, third parties, actual controllers, beneficial owners, opposing counsel, and natural persons.
   - Transaction or dispute subject matter.
   - Former names, aliases, English names, and normalized variants.
3. Search only authorized matter indexes or user-provided conflict records. Do not read unrelated matter files unless cross-matter access is explicitly authorized in `permissions.json`.
4. Record hits in `conflict-check.json`:
   - matched source or matter id.
   - hit summary.
   - preliminary risk.
   - recommended lawyer action.
5. Set status:
   - `no-hit` if no relevant hit was found.
   - `hit-review-required` if any relevant hit exists.
   - never set `cleared-by-lawyer` unless the reviewing lawyer explicitly confirms.

## Stop Conditions

- If matter files are missing, stop with `NO_ACTIVE_MATTER`.
- If permissions do not allow the search, stop with `PERMISSION_DENIED`.
- If cross-matter access is requested without authorization, stop with `CROSS_MATTER_DENIED`.

## Output

Return an initial conflict-screening report with a clear review status and next action.

## Next Steps

After this skill finishes, route based on the screening status:

- `no-hit` or lawyer-confirmed `cleared-by-lawyer`: hand off to the matter's domain skill (`/cn-contract:review`, `/cn-data-compliance:data-activity-triage`, `/cn-labor-employment:employment-contract-review`, or matter-core `/matter-core:review-queue` for direct review-queue authoring).
- `hit-review-required`: stop substantive domain work; escalate to the responsible lawyer for `cleared-by-lawyer` confirmation or matter decline.
- `pending`: re-run after the responsible lawyer reviews; do not allow domain skills to proceed.

## Schemas

Validate the resulting record before treating the screening as complete:

- `matters/<matter-id>/conflict-check.json` → `matter-core/schemas/conflict-check.schema.json`

Repo-local validation: `npm run validate:schema -- <file> matter-core/schemas/conflict-check.schema.json`.
