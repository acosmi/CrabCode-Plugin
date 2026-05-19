---
name: matter-archive
description: Archive a matter with outputs, source records, review records, permissions, and audit trail preserved.
argument-hint: "[matter id]"
---

# /matter-core:matter-archive

【AI 辅助草稿，需律师复核】

Prepare a matter archive. Archiving preserves records; it is not deletion.

## Workflow

1. Load matter files and confirm the matter exists.
2. Check review queue:
   - list open draft or pending-review outputs.
   - flag outputs that were approved but not marked sent or archived.
3. Check source records:
   - identify unreviewed or unknown-status legal sources.
   - list user-provided documents and internal knowledge references.
4. Prepare archive checklist:
   - matter metadata.
   - parties and permissions.
   - conflict-screening record.
   - outputs and final review statuses.
   - source records.
   - audit log.
   - retention policy.
5. Move only after explicit user confirmation.

## Stop Conditions

- If there are unresolved review items, do not close the matter silently.
- If retention policy is missing, flag it before archive.

## Output

Return an archive readiness report and the exact files to preserve.

## Schemas

Before archiving, re-validate the matter's records to ensure the archived bundle is internally consistent:

- `matters/<matter-id>/matter.json` → `matter-core/schemas/matter.schema.json` (must include `closedAt` once `status` becomes `closed` or `archived`)
- `matters/<matter-id>/conflict-check.json` → `matter-core/schemas/conflict-check.schema.json`
- `matters/<matter-id>/review-queue.jsonl` records → `matter-core/schemas/review-queue.schema.json`
- `matters/<matter-id>/sources.jsonl` records → `matter-core/schemas/source-record.schema.json`

Repo-local validation per file: `npm run validate:schema -- <file> matter-core/schemas/<name>.schema.json`.
