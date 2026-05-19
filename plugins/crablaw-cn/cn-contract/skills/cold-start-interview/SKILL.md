---
name: cold-start-interview
description: Capture PRC contract review preferences, templates, approval matrix, and source policy for a client or legal team.
argument-hint: "[practice facts or seed materials]"
---

# /cn-contract:cold-start-interview

【AI 辅助草稿，需律师复核】

Collect contract workflow configuration for a CrabLaw-CN client or team. This does not replace matter-specific intake.

## Workflow

1. Confirm the user has a `matter-core` client or active matter. If not, direct them to create one.
2. Collect:
   - contract types and business lines.
   - standard templates and fallback clauses.
   - approval matrix and escalation owners.
   - seal, signature, authorization, and internal approval rules.
   - dispute forum preferences.
   - data, IP, confidentiality, payment, termination, and liability positions.
3. Identify source materials:
   - user templates.
   - prior approved comments.
   - internal policies.
   - official legal sources requiring verification.
4. Produce a `PRACTICE.md` update draft for user review.

## Output

Return configuration gaps, recommended profile sections, and required seed documents.
