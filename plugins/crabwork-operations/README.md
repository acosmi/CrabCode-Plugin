# CrabWork 运营管理

面向运营团队的 CrabCode 插件:供应商管理、流程文档、变更管理、产能规划、合规跟踪与资源规划。可独立使用(直接提供信息、上传文件、描述流程),连接 ITSM、项目管理与知识库等工具后能力更强。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 运营管理」并安装,或通过 marketplace 添加 `crabwork-operations`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `vendor-review` | 评估供应商:成本分析、风险评估、合同摘要与续约/替换建议(含 TCO 拆解) |
| `process-doc` | 编写业务流程文档:流程图、RACI 责任矩阵、SOP 标准作业程序 |
| `process-optimization` | 分析并优化业务流程:识别瓶颈、消除浪费、精简工作流 |
| `change-request` | 创建变更管理申请:影响分析、回滚预案、审批路由与沟通模板 |
| `risk-assessment` | 识别、评估并缓解运营风险:风险登记册、影响分析、控制措施 |
| `compliance-tracking` | 跟踪合规要求:审计准备、认证、监管期限、政策遵从(SOC 2、ISO 27001、GDPR 等) |
| `capacity-plan` | 产能规划:工作量分析、人力建模、利用率预测 |
| `status-report` | 生成状态报告:项目进展、KPI、风险与行动项,面向管理层 |
| `runbook` | 创建/更新运维手册:可重复执行的步骤、排错、回滚与升级路径 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 供应商评审 | 提供细节、上传方案 | 采购系统、知识库 |
| 流程文档 | 描述流程 | 知识库(既有文档) |
| 变更申请 | 描述变更 | ITSM、项目管理 |
| 产能规划 | 上传数据、描述团队 | 项目管理(工作量数据) |
| 状态报告 | 手动提供更新 | 项目管理、聊天工具、日历 |
| 运维手册 | 走查一遍流程 | 知识库、ITSM |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

连接你的工具以获得更丰富的体验:

| 类别 | 示例 | 启用能力 |
|---|---|---|
| ITSM | ServiceNow、Zendesk | 工单管理、变更申请、事故跟踪 |
| 项目管理 | Asana、Jira、monday.com | 项目状态、资源分配、任务跟踪 |
| 知识库 | Notion、Confluence | 流程文档、运维手册、政策 |
| 聊天 | Slack、Teams | 团队协同、审批、状态更新 |
| 日历 | Google Calendar、Microsoft 365 | 会议安排、期限跟踪 |
| 邮件 | Gmail、Microsoft 365 | 供应商沟通、审批 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-operations/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "company": "你的公司",
  "team": "运营",
  "reportingCadence": "weekly",
  "approvalChain": ["经理", "总监", "VP"],
  "complianceFrameworks": ["SOC 2", "ISO 27001"],
  "fiscalYearStart": "January"
}
```

未配置时,插件会在需要时主动询问相关信息。
