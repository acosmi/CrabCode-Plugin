---
name: 技能质量检查
short-description: 检查技能前置元数据、命名、可用性并解答使用问题
description: 对技能做质量检查并解答其使用疑问,核对 frontmatter、命名与可用性。当用户提到这个技能怎么用、技能报错、检查 skill 质量、为什么不生效、技能写得对不对,或需要排查与答疑时使用本技能(即使未明说"检查")。
argument-hint: "[技能名 / 问题描述]"
---

# /builder-hub:skills-qa

对技能(skill)做质量检查,并解答其安装与使用疑问。

## Workflow

1. 定位目标:技能目录名,或用户提出的具体问题。
2. 质量检查:
   - frontmatter 是否含 name 与 description,且 description 含 when 触发从句。
   - 目录名与 frontmatter name 是否一致、命名是否规范。
   - SKILL.md 结构是否完整(标题、Workflow、Output、Next Steps)。
   - 是否存在悬空依赖或失效的市场来源。
3. 答疑:针对"怎么用、为何不生效、何时触发"给出具体说明与示例。
4. 排错:对常见问题(未启用、依赖缺失、命名冲突)给出修复步骤。
5. 汇总检查结论与改进建议。

## Output

返回:

- 质量检查结果(通过项与不合格项)。
- 针对用户问题的解答。
- 具体的修复或改进步骤。
- 是否建议进一步操作(启用/重装/更新)。

## Next Steps

- 用 `/builder-hub:disable` 启用未生效的技能。
- 用 `/builder-hub:skill-installer` 重装或补齐缺失依赖。
- 用 `/builder-hub:skill-manager` 复核整体状态。
