---
name: auto-updater
description: 检查已安装技能与插件的可用更新并给出升级提示。当用户提到检查更新、有没有新版本、升级技能、更新插件、看看哪些过期了,或需要确认本地能力是否最新时使用本技能(即使未明说"更新")。
argument-hint: "[可选:插件名 / 技能名]"
---

# /builder-hub:auto-updater

检查已安装技能与插件的可用更新,并提示升级。

## Workflow

1. 枚举本地已装项:从 `.crabcode-plugin/` 与本地已装清单读取每个技能(skill)的当前版本。
2. 比对市场版本:对照 CrabCode 插件市场 `marketplace.json` 中登记的最新版本。
3. 标记差异:
   - 有新版本可升级。
   - 已是最新。
   - 来源缺失或已下架。
4. 评估更新影响:列出版本变化要点与可能的依赖联动。
5. 仅提示、不自动改动文件;由用户决定是否执行升级。

## Output

返回:

- 可更新项清单(当前版本 → 最新版本)。
- 已是最新的项。
- 来源异常或已下架的项。
- 建议的升级顺序与注意事项。

## Next Steps

- 用 `/builder-hub:skill-installer` 安装目标技能的新版本。
- 用 `/builder-hub:skill-manager` 复核更新后的状态。
- 用 `/builder-hub:skills-qa` 对升级项做回归自检。
