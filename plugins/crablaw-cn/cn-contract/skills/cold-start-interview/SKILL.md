---
name: 合同审查偏好采集
short-description: 为某客户或法务团队采集中国法合同审查偏好、模板、审批矩阵与资料来源策略
description: 为某客户或法务团队采集中国法合同审查偏好、模板、审批矩阵与资料来源策略。当用户提到配置合同审查/我们团队的审查习惯/设定模板/审批流程/初始化偏好/第一次用先配一下,或需要在批量审合同前先建立团队规则时使用本技能(即使未明说"冷启动")。
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
