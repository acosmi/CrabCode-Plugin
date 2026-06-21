# CrabWork 销售助手

面向销售团队的 CrabCode 插件:挖掘潜客、撰写触达、管理销售管道、准备客户通话与制定成交策略。可独立使用(联网搜索 + 你的输入),连接 CRM、邮件等工具后能力更强。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 销售助手」并安装,或通过 marketplace 添加 `crabwork-sales`。

## 命令(显式调用)

通过斜杠命令显式触发的工作流:

| 命令 | 说明 |
|---|---|
| `/call-summary` | 处理通话记录或转录稿——提取行动项、起草跟进邮件、生成内部摘要 |
| `/forecast` | 生成加权销售预测——上传 CSV 或描述你的管道,设定配额,得到预测结果 |
| `/pipeline-review` | 分析管道健康度——给交易排序、标记风险、产出每周行动计划 |

所有命令均可**独立使用**(粘贴笔记、上传 CSV 或描述现状),连接 MCP 连接器后体验更佳。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `account-research` | 调研公司或个人——联网搜索公司情报、关键联系人、近期新闻、招聘信号 |
| `call-prep` | 准备销售通话——客户背景、与会者调研、建议议程、挖需问题 |
| `call-summary` | 处理通话笔记或转录稿——提取行动项、起草跟进、生成内部摘要 |
| `competitive-intelligence` | 调研竞品——产品对比、价格情报、近期发布、差异化矩阵、销售话术 |
| `create-an-asset` | 生成定制销售物料——落地页、演示稿、单页、工作流演示,贴合你的潜客 |
| `daily-briefing` | 优先级排序的每日销售简报——会议、管道告警、邮件优先级、建议动作 |
| `draft-outreach` | 调研优先的触达——先调研潜客,再起草个性化邮件与 LinkedIn 消息 |
| `forecast` | 生成加权销售预测——最佳/最可能/最差情景、承诺 vs 上探、差距分析 |
| `pipeline-review` | 分析管道健康度——交易优先级、风险标记、每周行动计划 |

## 示例工作流

### 通话之后

```
/call-summary
```

粘贴你的笔记或转录稿。得到结构化摘要、带责任人的行动项,以及一封跟进邮件草稿。若已连接 CRM,会主动提议记录活动并创建任务。

### 每周预测

```
/forecast
```

上传从 CRM 导出的 CSV(或粘贴你的交易)。告诉我你的配额与时间窗口。得到加权预测,含最佳/最可能/最差情景、承诺 vs 上探拆分,以及差距分析。

### 管道复盘

```
/pipeline-review
```

上传 CSV 或描述你的管道。得到健康评分、交易优先级、风险标记(停滞交易、过期关单日期、单线程联系)以及每周行动计划。

### 调研潜客

直接自然地提问:

```
明天通话前帮我调研一下 Acme Corp
```

`account-research` 技能会自动触发,给你公司概览、关键联系人、近期新闻和推荐打法。

### 起草触达

```
给 TechStart 的工程 VP 起草一封邮件
```

`draft-outreach` 技能会先调研潜客,再生成多角度的个性化触达内容。

### 竞争情报

```
我们和竞品 X 相比如何?
```

`competitive-intelligence` 技能会同时调研双方公司,构建差异化矩阵并配上销售话术。

## 独立使用 + 连接增强

每个命令与技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能做什么 | 独立使用 | 连接增强 |
|---|---|---|
| 处理通话笔记 | 粘贴笔记/转录稿 | 转录类 MCP(如 Gong、Fireflies) |
| 预测管道 | 上传 CSV、粘贴交易 | CRM 类 MCP |
| 复盘管道 | 上传 CSV、描述交易 | CRM 类 MCP |
| 调研潜客 | 联网搜索 | 数据增强类 MCP(如 Clay、ZoomInfo) |
| 准备通话 | 描述会议 | CRM、邮件、日历类 MCP |
| 起草触达 | 联网搜索 + 你的背景 | CRM、邮件类 MCP |
| 竞争情报 | 联网搜索 | CRM(输赢数据)、文档(战书) |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

连接你的工具以获得更丰富的体验:

| 类别 | 示例 | 启用能力 |
|---|---|---|
| **CRM** | HubSpot、Close | 管道数据、客户历史、联系人记录 |
| **转录** | Fireflies、Gong、Chorus | 通话录音、转录稿、关键片段 |
| **数据增强** | Clay、ZoomInfo、Apollo | 公司与联系人数据增强 |
| **聊天** | Slack、Teams | 内部讨论、同事情报 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表,包括邮件、日历及更多 CRM 选项。

## 个性化设置

在 `crabwork-sales/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "name": "你的名字",
  "title": "客户经理",
  "company": "你的公司",
  "quota": {
    "annual": 1000000,
    "quarterly": 250000
  },
  "product": {
    "name": "你的产品",
    "value_props": [
      "核心价值主张 1",
      "核心价值主张 2"
    ],
    "competitors": [
      "竞品 A",
      "竞品 B"
    ]
  }
}
```

未配置时,插件会在需要时主动询问相关信息。
