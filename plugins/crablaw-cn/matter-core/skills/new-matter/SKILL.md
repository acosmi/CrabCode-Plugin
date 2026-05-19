---
name: new-matter
description: Create a new matter workspace and bind it to a client, parties, scope, permissions, and source policy.
argument-hint: "[client id] [matter title or facts]"
---

# /matter-core:new-matter

【AI 辅助草稿，需律师复核】

Create a matter workspace. This skill opens the matter record but does not authorize substantive work until conflict screening is complete.

## Workflow

1. Confirm the client profile exists. If not, run `/matter-core:new-client` first.
2. Collect matter facts:
   - Matter title and short description.
   - Matter type: contract, data-compliance, labor-employment, corporate, ip, litigation, ai-governance, or other.
   - Engagement scope.
   - Responsible lawyer and review owner.
   - Counterparties, affiliates, third parties, natural persons, opposing counsel, actual controllers, and beneficial owners.
   - Confidentiality and clean-team requirements.
   - Retention and archive expectations.
3. Ensure the matter directory layout exists under `matter-core/`'s storage root (default `~/.crabcode/plugins/config/crablaw-cn/matter-core/`, override with `CRABLAW_CN_HOME`). CrabCode does not auto-create plugin config directories; either run `tsx scripts/bootstrap-matter-store.ts <client-id> <matter-id>` from the repo, or create the equivalent paths manually before writing records:
   - `matters/<matter-id>/matter.json`
   - `matters/<matter-id>/parties.json`
   - `matters/<matter-id>/permissions.json`
   - empty `matters/<matter-id>/review-queue.jsonl`
   - empty `matters/<matter-id>/sources.jsonl`
   - empty `matters/<matter-id>/audit-log.jsonl`
   - `matters/<matter-id>/outputs/`
4. Initialize `conflict-check.json` with status `pending`.
5. Stop before substantive analysis and direct the user to `/matter-core:conflict-check`.

## Output

Return:

- Matter id.
- Client and party summary.
- Engagement scope.
- Conflict-screening status.
- Missing facts.
- Next required action.

## Schemas

Validate each written artefact against its schema before treating the matter as ready:

- `matters/<matter-id>/matter.json` → `matter-core/schemas/matter.schema.json`
- `matters/<matter-id>/parties.json` → `matter-core/schemas/parties.schema.json`
- `matters/<matter-id>/permissions.json` → `matter-core/schemas/permissions.schema.json`
- `matters/<matter-id>/conflict-check.json` → `matter-core/schemas/conflict-check.schema.json`

Repo-local validation: `npm run validate:schema -- <file> matter-core/schemas/<name>.schema.json`.
