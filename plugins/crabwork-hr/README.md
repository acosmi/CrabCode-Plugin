# CrabWork 人力资源

面向人力资源团队的 CrabCode 插件:招聘、入职、绩效评估、薪酬分析与政策解答,帮助团队保持合规、运转顺畅。可独立使用(描述需求、粘贴内容、上传数据),连接 HRIS、ATS、薪酬数据等工具后能力更强。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 人力资源」并安装,或通过 marketplace 添加 `crabwork-hr`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `draft-offer` | 起草录用通知:薪酬明细、入职日期与条款 |
| `onboarding` | 为新员工生成入职清单与第一周计划 |
| `performance-review` | 结构化绩效评估:自评提示、经理模板、校准准备 |
| `policy-lookup` | 查询并解读公司政策:年假、福利、报销、差旅、远程办公 |
| `comp-analysis` | 薪酬数据分析:市场对标、薪档定位、股权刷新建模 |
| `people-report` | 生成编制、流失率、多元化或组织健康度报告 |
| `recruiting-pipeline` | 跟踪与管理招聘漏斗:寻源、初筛、面试、发 offer |
| `org-planning` | 编制规划、组织设计与团队结构优化 |
| `interview-prep` | 制定结构化面试方案:能力素质题库、评分卡、复盘模板 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 起草 offer | 手动提供细节 | HRIS、ATS 自动填充 |
| 入职清单 | 描述你的流程 | HRIS、知识库提供模板 |
| 绩效评估 | 手动输入 | HRIS 拉取评估历史 |
| 政策查询 | 粘贴手册内容 | 知识库 |
| 薪酬分析 | 上传 CSV、描述薪档 | 薪酬数据 MCP |
| 人力报告 | 上传数据 | HRIS 提供实时数据 |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

| 类别 | 示例 | 启用能力 |
|---|---|---|
| HRIS | Workday、BambooHR、Rippling | 员工数据、组织结构、年假余额 |
| ATS | Greenhouse、Lever、Ashby | 候选人漏斗、面试排期、offer 跟踪 |
| 薪酬数据 | Pave、Radford | 市场基准、薪档数据 |
| 聊天 | Slack、Teams | 团队公告、候选人协调 |
| 日历 | Google Calendar、Microsoft 365 | 面试安排、入职日历 |
| 邮件 | Gmail、Microsoft 365 | 录用通知、候选人沟通 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-hr/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "company": "你的公司",
  "headquarters": "城市,省/州",
  "employeeCount": 500,
  "benefits": {
    "healthInsurance": "保险服务商名称",
    "pto": "不限 / X 天",
    "parentalLeave": "X 周"
  },
  "compensation": {
    "currency": "CNY",
    "equityType": "RSU / 期权",
    "vestingSchedule": "4 年,1 年 cliff"
  }
}
```

未配置时,插件会在需要时主动询问相关信息。
