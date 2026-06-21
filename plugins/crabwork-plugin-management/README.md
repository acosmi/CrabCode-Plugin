# CrabWork 插件管理

面向插件作者与团队管理员的 CrabCode 插件:从零创建新插件,以及按组织的工具与工作流定制现有插件。通过引导式对话完成发现、规划、设计、实现与打包,最终交付可直接安装的 `.plugin` 文件。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 插件管理」并安装,或通过 marketplace 添加 `crabwork-plugin-management`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `create-crabcode-plugin` | 从零创建新插件:引导完成发现、组件规划、设计、实现与打包,产出可安装的 `.plugin` 文件 |
| `plugin-customizer` | 按组织的具体工具与工作流定制现有插件:替换模板占位符、配置 MCP 连接器、调整技能内容 |

## 两种使用场景

### 创建新插件

描述你想要插件解决的问题,技能会带你走完五个阶段:

1. **发现** —— 明确插件要做什么、为谁服务
2. **组件规划** —— 确定需要哪些组件(技能 / MCP / 代理 / 钩子)
3. **设计与澄清** —— 逐个组件细化规格
4. **实现** —— 生成全部插件文件
5. **评审与打包** —— 交付 `.plugin` 文件

### 定制现有插件

针对面向通用场景的插件模板,技能会:

- 识别 `~~` 占位符并替换为组织实际使用的工具(如 `~~Jira` → `Asana`)
- 从已连接的知识类 MCP(聊天、文档、邮件)中自动收集组织的工具名、流程与配置值
- 为识别出的工具搜索并连接对应的 MCP 服务
- 更新插件的 MCP 配置并重新打包

## 插件结构速览

技能内置了完整的 CrabCode 插件架构知识,生成的插件遵循如下布局:

```
plugin-name/
├── .crabcode-plugin/
│   └── plugin.json           # 必需:插件清单
├── skills/                   # 技能(每个子目录含 SKILL.md)
│   └── skill-name/
│       ├── SKILL.md
│       └── references/
├── agents/                   # 子代理定义(.md)
├── .mcp.json                 # MCP 服务定义
└── README.md                 # 插件文档
```

## 连接增强

定制场景下,连接知识类 MCP 可大幅提升体验:连接聊天(Slack、Teams)、文档(Notion、Confluence)或邮件(Gmail、Outlook)后,插件能自动发现组织使用的工具与约定,减少手动问答。未连接时,插件会在需要时主动询问相关信息。
