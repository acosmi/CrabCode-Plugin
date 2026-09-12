---
name: 新建法律事项
short-description: 在 CrabLaw-CN 工作流中新建事项/案件工作区,并绑定客户、当事方、服务范围、权限与资料来源策略
description: 在 CrabLaw-CN 工作流中新建事项/案件工作区,并绑定客户、当事方、服务范围、权限与资料来源策略。当用户提到开案/立案/新建事项/建一个案子/开个新 matter/把这个案子建起来,或需要为某客户开启一项具体法律工作时使用本技能(即使未明说"开案")。
argument-hint: "[client id] [matter title or facts]"
---

# crablaw-cn:new-matter

【AI 辅助草稿，需律师复核】

Create a matter workspace. This skill opens the matter record but does not authorize substantive work until conflict screening is complete.

## Workflow

1. Confirm the client profile exists. If not, run `crablaw-cn:new-client` first.
2. Collect matter facts:
   - Matter title and short description.
   - Matter type: contract, data-compliance, labor-employment, corporate, ip, litigation,
     ai-governance, regulatory, product, legal-aid, or other.
   - Engagement scope.
   - Responsible lawyer and review owner.
   - Counterparties, affiliates, third parties, natural persons, opposing counsel, actual controllers, and beneficial owners.
   - Confidentiality and clean-team requirements.
   - Retention and archive expectations.
3. With explicit authorization to create local matter records, run the dependency-free bootstrap under
   the plugin root. Supply every required value; do not use placeholders for the lawyer, review owner,
   matter type, parties, or allowed user:

   ```text
   python3 ${CRABCODE_PLUGIN_ROOT}/matter-core/scripts/bootstrap_matter.py \
     --client-id <client-id> --client-name <client-name> \
     --matter-id <matter-id> --title <title> --scope <scope> \
     --matter-type <matter-type> --responsible-lawyer <name> --review-owner <name> \
     --allowed-user <authorized-user> \
     --party client:<client-name> --party counterparty:<counterparty-name>
   ```

   The command writes below the storage root (default
   `~/.crabcode/plugins/config/crablaw-cn/matter-core/`, override with `CRABLAW_CN_HOME`), refuses to
   overwrite an existing matter, applies private file permissions, and creates:
   - `matters/<matter-id>/matter.json`
   - `matters/<matter-id>/parties.json`
   - `matters/<matter-id>/permissions.json`
   - empty `matters/<matter-id>/review-queue.jsonl`
   - empty `matters/<matter-id>/sources.jsonl`
   - empty `matters/<matter-id>/audit-log.jsonl`
   - `matters/<matter-id>/outputs/`
4. Read the exit code, not just the text. `0` means created with no local match; `10` means created
   but blocked (`hit-review-required` or `coverage-incomplete`); `3` means the command refused
   because the matter id already exists or is an interrupted (`.pending`) bootstrap; `2` means bad
   arguments, an unreadable store, or a store lock held by a live writer; `11` means the conflict
   policy could not be read or is invalid, so nothing was screened and nothing was created. On
   Windows without a `python3` alias, invoke the same command with `py -3`.
5. What a match means comes from the lawyer-issued conflict policy —
   `<store-root>/conflict-policy.json`, else the shipped `matter-core/conflict-policy.json`,
   described in `matter-core/PRACTICE.md`. The screening record names the policy that produced it,
   and matches the policy calls informational are kept in `informationalHits` without changing the
   status. **Never edit the policy file and never remove or downgrade a recorded hit.** On exit code
   11, report the error and stop; it is not permission to open a matter without a policy.
6. Inspect the returned preliminary conflict status. A local name match sets
   `hit-review-required` and blocks substantive work; absence of a local match is not a final lawyer
   conflict opinion. A `coverage-incomplete` status means the screen could not read part of the
   store — report the `coverage` block verbatim and treat it as blocking, never as "nothing found".
7. Stop before substantive analysis and direct the user to `crablaw-cn:conflict-check` for the
   responsible lawyer's workflow.

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

Validate each file with:

```text
python3 ${CRABCODE_PLUGIN_ROOT}/matter-core/scripts/validate_json.py \
  --schema ${CRABCODE_PLUGIN_ROOT}/matter-core/schemas/<name>.schema.json \
  --file <file>
```
