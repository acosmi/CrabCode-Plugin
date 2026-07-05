# Builder Hub 插件与技能管理

CrabCode 插件与技能管理元工具:安装、卸载、启用/禁用、浏览市场目录、推荐关联技能、检查更新与技能质量。

## 安装

在 CrabCode 插件市场中添加 `builder-hub`,或通过 `/plugin` 安装。

## 技能(按需自动触发)

| 技能 | 说明 |
|---|---|
| `skill-installer` | 从插件市场安装插件或技能到本地环境 |
| `uninstall` | 卸载已安装的插件或技能并清理登记 |
| `disable` | 启用/禁用技能,无需卸载即可临时关闭能力 |
| `skill-manager` | 已安装技能总览:状态、版本与归属插件 |
| `registry-browser` | 按分类与关键词浏览、检索市场可安装项 |
| `related-skills-surfacer` | 基于当前任务推荐关联的已装或可装技能 |
| `auto-updater` | 检查已装技能与插件的可用更新并给出升级提示 |
| `skills-qa` | 技能质量检查与使用答疑:frontmatter、命名、可用性排查 |

## 使用入口

直接说"装一个 XX 技能""看看装了哪些插件""这个技能为什么不生效",CrabCode 会自动匹配对应技能。
