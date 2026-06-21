---
name: new-client
description: 在 CrabLaw-CN 工作流中创建或更新客户档案,作为开展任何具体事项前的客户基础。当用户提到新客户/建客户/录入客户信息/客户资料/新来一个委托人/接了个客户,或需要先把客户档案建起来再开案时使用本技能(即使未明说"建档")。
argument-hint: "[client name or profile facts]"
---

# /matter-core:new-client

【AI 辅助草稿，需律师复核】

Create a client profile under the CrabLaw-CN matter foundation. This skill does not clear conflicts and does not approve representation.

## Workflow

1. Collect the minimum client facts:
   - Client display name.
   - Unified social credit code if available.
   - Former names, aliases, English names, branch names, and affiliates.
   - Contacts and relationship owner.
   - Industry and business description.
   - Confidentiality level: standard, heightened, or clean-team.
2. Normalize names:
   - Preserve the original user-provided name.
   - Add simplified/traditional, full-width/half-width, common abbreviation, English, former-name, and affiliate variants when known.
   - Do not invent entity registration data.
3. Prepare `clients/<client-id>/client.json` using `matter-core/schemas/client.schema.json`.
4. Add an `audit-log.jsonl` entry if an active matter already exists.
5. Tell the user the next required step is `/matter-core:new-matter` or `/matter-core:conflict-check`.

## Stop Conditions

- If the user asks for substantive legal analysis before a matter exists, stop with `NO_ACTIVE_MATTER`.
- If the requested client identity is ambiguous, ask for clarification before writing the profile.

## Output

Return:

- Client profile summary.
- Missing identity fields.
- Conflict-screening keywords derived from the profile.
- Next required action.
