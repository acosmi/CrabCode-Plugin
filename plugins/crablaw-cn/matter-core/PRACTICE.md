# Matter Core Practice Profile

【AI 辅助草稿，需律师复核】

This profile defines the shared matter-management baseline for CrabLaw-CN. Domain plugins must not produce substantive legal work product unless the current matter has passed the required checks below.

## Storage Root

Default configuration root:

```text
~/.crabcode/plugins/config/crablaw-cn/matter-core/
```

Expected structure:

```text
ORG_PROFILE.md
clients/<client-id>/client.json
matters/<matter-id>/matter.json
matters/<matter-id>/parties.json
matters/<matter-id>/conflict-check.json
matters/<matter-id>/permissions.json
matters/<matter-id>/review-queue.jsonl
matters/<matter-id>/sources.jsonl
matters/<matter-id>/audit-log.jsonl
matters/<matter-id>/outputs/
matters/_archived/<matter-id>/
```

## Required Gate

Every substantive domain workflow must verify:

- Active matter exists.
- Matter is within the user's authorized scope.
- Conflict screening status is `no-hit` or `cleared-by-lawyer`; `pending` and `hit-review-required` block substantive work.
- Domain work fits the engagement scope.
- Output destination is internal unless review status is approved.
- Source records can be written for legal and factual references.
- Review queue item will be created before any output is treated as complete.

## Stop Codes

- `NO_ACTIVE_MATTER`
- `CONFLICT_CHECK_PENDING`
- `CONFLICT_REVIEW_REQUIRED`
- `OUT_OF_SCOPE`
- `PERMISSION_DENIED`
- `CROSS_MATTER_DENIED`
- `REVIEW_REQUIRED`
- `SOURCE_RECORD_REQUIRED`

## Output Rule

No matter-core workflow gives a final conflict conclusion or final legal opinion. Conflict screening output is an initial screening record for lawyer review.
