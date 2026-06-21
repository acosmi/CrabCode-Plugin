---
name: skill-manager
description: 已安装技能的管理总览,列出所有技能并查看其状态、版本与归属插件。当用户提到查看已装技能、列出所有 skill、管理插件、看看装了什么、检查技能状态,或需要一份本地能力清单时使用本技能(即使未明说"管理")。
argument-hint: "[可选:插件名 / 状态过滤]"
---

# /builder-hub:skill-manager

提供已安装技能的管理总览:列出、分组、查看状态。

## Workflow

1. 扫描本地 `.crabcode-plugin/` 结构,枚举所有已安装的插件与技能(skill)。
2. 读取 `marketplace.json`(或本地已装清单),为每个技能汇总:
   - 名称与所属插件。
   - 当前版本。
   - 启用/禁用状态。
   - 描述(description)摘要。
3. 应用过滤:按插件、按状态(enabled/disabled)或按关键词筛选。
4. 标记异常:缺失 frontmatter、命名不规范、悬空依赖、版本落后等。
5. 汇总输出一份结构化清单。

## Output

返回:

- 已装技能总数及按插件分组的清单。
- 每项的版本与启用状态。
- 异常与待办标记。
- 可执行的后续操作建议。

## Next Steps

- 用 `/builder-hub:disable` 切换某项的启用状态。
- 用 `/builder-hub:auto-updater` 检查可更新项。
- 用 `/builder-hub:skills-qa` 对异常项做质量检查。
