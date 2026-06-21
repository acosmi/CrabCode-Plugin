---
name: review-queue
description: 创建、列出、更新或查看 CrabLaw-CN 各项产出的律师复核队列条目。当用户提到复核队列/待复核/审核列表/待审项/复核进度/有哪些要审的,或需要登记某份产出待律师复核、查看复核状态时使用本技能(即使未明说"复核队列")。
argument-hint: "<new | list | update | show> [matter id] [item id]"
---

# /matter-core:review-queue

【AI 辅助草稿，需律师复核】

Manage review queue records. Every substantive output from a domain plugin must create or reference a review item.

## Commands

- `new`: create a review item for an output.
- `list`: list review items for a matter.
- `show`: inspect one review item.
- `update`: update review status after lawyer action.

## Status Model

- `draft`
- `pending-review`
- `returned`
- `approved-internal`
- `approved-external`
- `sent`
- `archived`

## Rules

1. New domain outputs default to `draft` or `pending-review`.
2. A domain plugin cannot set `approved-internal`, `approved-external`, or `sent`.
3. External delivery requires an explicit approved status and destination record.
4. Returned items must keep the review comments and prior output path.
5. Every status change must append to `audit-log.jsonl`.

## Output

Return a queue table with item id, source skill, status, reviewer, output path, and next action.

## Schemas

Validate each written record against the schema before treating the queue update as complete:

- `matters/<matter-id>/review-queue.jsonl` (one JSON per line) → `matter-core/schemas/review-queue.schema.json`

Repo-local validation per record: `npm run validate:schema -- <record-file> matter-core/schemas/review-queue.schema.json`.
