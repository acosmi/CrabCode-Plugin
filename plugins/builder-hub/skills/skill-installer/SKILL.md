---
name: 技能与插件安装
short-description: 从官方插件市场安装技能或插件并接入本地工作流
description: 把 CrabCode 插件市场上的插件或技能安装到本地 CrabCode 环境。当用户提到安装技能、装插件、把某个 skill 加进来、从 marketplace 拉取,或需要将一个新能力接入工作流时使用本技能(即使未明说"安装")。
argument-hint: "[插件名 / 技能名 / marketplace 来源]"
---

# /builder-hub:skill-installer

把 CrabCode 插件市场中的插件或技能安装到本地环境。

## Workflow

1. 确认安装目标:
   - 插件 ID 或技能(skill)目录名。
   - 来源:CrabCode 插件市场(marketplace)、本地路径或仓库地址。
   - 期望版本(默认最新稳定版)。
2. 核对来源清单:在 `marketplace.json` 中定位目标条目,读取其名称、版本、依赖与所属插件。
3. 解析依赖:列出该技能依赖的其他技能或插件,提示一并安装。
4. 写入 `.crabcode-plugin/` 结构:
   - 将技能放入对应插件的 `skills/<skill目录名>/`。
   - 在 `marketplace.json`(或本地已装清单)登记条目与版本号。
5. 完成后校验:确认 SKILL.md frontmatter 完整(name/description),目录命名规范一致。

## Output

返回:

- 已安装的插件/技能名称与版本。
- 安装路径(`.crabcode-plugin/...`)。
- 一并安装的依赖清单。
- 未满足的依赖或命名冲突告警。

## Next Steps

- 用 `/builder-hub:skill-manager` 查看安装结果与状态。
- 用 `/builder-hub:disable` 按需启用或禁用新装技能。
- 用 `/builder-hub:skills-qa` 做一次质量自检。
