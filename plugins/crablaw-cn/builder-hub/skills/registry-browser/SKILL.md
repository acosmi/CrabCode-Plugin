---
name: registry-browser
description: 浏览 CrabCode 插件市场上可用的技能目录,按分类和关键词检索可安装项。当用户提到逛市场、看有哪些技能可装、搜索插件、找某类能力、浏览 marketplace 目录,或需要发现新技能时使用本技能(即使未明说"浏览")。
argument-hint: "[搜索关键词 / 分类]"
---

# /builder-hub:registry-browser

浏览并检索 CrabCode 插件市场上可用的技能目录。

## Workflow

1. 加载市场目录:读取 `marketplace.json` 中登记的全部插件与技能(skill)条目。
2. 接收检索条件:关键词、分类、所属插件或功能场景。
3. 匹配与排序:
   - 按名称、描述(description)、触发词命中度筛选。
   - 优先展示与当前任务相关、维护活跃的条目。
4. 对每个候选项展示:名称、所属插件、版本、简介、是否已安装。
5. 标注安装状态:已装 / 未装 / 有更新。

## Output

返回:

- 命中条目列表(名称、插件、版本、简介)。
- 每项的安装状态。
- 推荐优先安装的若干项及理由。

## Next Steps

- 用 `/builder-hub:skill-installer` 安装选中的技能。
- 用 `/builder-hub:related-skills-surfacer` 获取任务相关推荐。
- 用 `/builder-hub:skill-manager` 对照已装清单。
