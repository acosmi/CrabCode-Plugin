# CrabWork 小微企业

面向小微企业主的 CrabCode 一体化插件:涵盖财务现金流、销售营销、客户运营、招聘与经营简报。安装即获得 15 个原子技能、15 个开箱即用的工作流命令,以及一个能听懂大白话的路由器(`smb-router`)。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

你不需要记任何命令。直接告诉 CrabCode 你的需求 ——「下周发工资有点紧」「有个客户生气了」「我该定多少价?」—— 它会自动判断该用哪个工作流并一步步带你走完。每个工作流在执行任何动作前都会暂停等你确认,凡是涉及钱或客户的步骤,都需要你点头才会进行。

> **重要提示**:本插件辅助小微企业日常工作流,但不构成财务、税务、法律或人力资源建议。所有输出都应由你(必要时连同合格的专业人士)审阅后再使用。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 小微企业」并安装,或通过 marketplace 添加 `crabwork-small-business`。

安装后,说一句 **「帮我设置」** 即可触发 `smb-onboard` 技能 —— 它会帮 CrabCode 了解你的业务、痛点以及你已经在用的工具。

## 需要连接哪些工具

运行 `/smb-onboard` 或直接对 CrabCode 说「帮我设置」。

**核心工具**(优先连接,体验最佳):
- **QuickBooks** —— 驱动全部财务工作流(现金预测、毛利、月末结账、报税准备)
- **PayPal** —— 交易数据、发票、争议与退款
- **HubSpot** —— CRM、线索、营销活动与客服工单

**营销与沟通:**
- **Canva** —— 生成符合品牌调性的社媒与邮件素材
- **Gmail / Outlook** —— 邮件草拟、工单处理、合同审阅
- **Google Calendar / Outlook 日历** —— 会议准备、电话时段、每周事项
- **Slack** —— 简报推送与通知

**可选**(连接后能力更深入):
- **Stripe** —— 收款与订阅数据
- **Square** —— POS 交易数据
- **Google Drive / OneDrive** —— 文件存储与模板
- **DocuSign** —— 从待签信封中审阅合同

不必一次全部连上。先连一两个就能立刻看到价值 —— 插件会在「再连一个工具能解锁更多」时主动提示你。

## 工作原理

三层协同运转:

1. **技能(Skills)** —— 基础积木。每个技能把一件事做到极致(预测现金、给线索打分、起草催款提醒),共 15 个。
2. **命令(Commands)** —— 工作流。把多个技能串成多步骤配方,在关键节点设检查点,执行前先由你确认,共 15 个。
3. **路由器(Router)** —— 总入口。你用大白话和 CrabCode 对话,路由器负责听懂、判断该用哪个工作流并带你过去,你永远不用背命令名。

## 全部 15 个命令

命令是把技能串起来的工作流,每个都在检查点暂停等你批准后才会执行动作。

### 财务与现金

| 命令 | 作用 | 你可以直接说 | 调用技能 | 必需 | 可选 |
|---|---|---|---|---|---|
| `/plan-payroll` | 现金预测 + 逾期发票催收,确认工资有着落 | 「能发出工资吗」「现金紧张」「谁欠我钱」 | cash-flow-snapshot、invoice-chase | QuickBooks | PayPal、Stripe、Square、邮箱 |
| `/month-heads-up` | 30 天现金展望,提前标记风险 | 「下个月什么情况」「现金预测」「跑道」 | cash-flow-snapshot | QuickBooks | PayPal |
| `/close-month` | 月末结账:对账、标差异、出 P&L、导出结账包 | 「结账」「月末」「对账」 | month-end-prep | QuickBooks | PayPal、Stripe、Square |
| `/price-check` | 按产品的毛利表与三套定价情景 | 「我的毛利多少」「该涨价吗」「单位成本」 | margin-analyzer | QuickBooks | PayPal |
| `/tax-prep` | 给会计的报税材料(季度预缴或年终 1099) | 「税的事」「预缴税」「1099」「会计要……」 | tax-season-organizer | QuickBooks | PayPal、Stripe |

### 销售与营销

| 命令 | 作用 | 你可以直接说 | 调用技能 | 必需 | 可选 |
|---|---|---|---|---|---|
| `/call-list` | 今日该打的 5 个重点线索,含话术与日历时段 | 「该给谁打电话」「有没有热线索」「管道」 | lead-triage | HubSpot | 邮箱、Google Calendar |
| `/run-campaign` | 端到端营销:销售分析 → 内容简报 → Canva 素材 → HubSpot 发送 | 「跑个营销」「销售下滑」「我要更多客户」 | content-strategy、canva-creator、lead-triage | HubSpot、Canva | QuickBooks、PayPal |
| `/sales-brief` | 畅销与滞销榜 + 两周内容简报 | 「什么在卖」「我该主推什么」 | content-strategy | QuickBooks 或 PayPal | HubSpot |

### 客户与运营

| 命令 | 作用 | 你可以直接说 | 调用技能 | 必需 | 可选 |
|---|---|---|---|---|---|
| `/customer-pulse-check` | 客户反馈主题归纳 + 回复模板 | 「客户在说什么」「投诉」「评价」 | customer-pulse、ticket-deflector | PayPal 或 HubSpot | —— |
| `/handle-complaint` | 端到端投诉处理:拉背景、起草回复、提运营改进建议 | 「有客户不满」「处理这条投诉」「愤怒邮件」 | ticket-deflector、customer-pulse | ——(可直接粘贴文本) | Gmail、HubSpot、PayPal |
| `/crm-cleanup` | HubSpot 清理:停滞商机、重复、缺字段 —— 经你批准后修复 | 「清理 CRM」「HubSpot 一团乱」「停滞商机」 | crm-maintenance | HubSpot | —— |
| `/review-contract` | 大白话合同审阅,含红旗与严重度评级 | 「审一下这份合同」「NDA」「该签吗」 | contract-review | ——(可上传文件) | DocuSign |

### 经营洞察

| 命令 | 作用 | 你可以直接说 | 调用技能 | 必需 | 可选 |
|---|---|---|---|---|---|
| `/monday-brief` | 周一晨报:现金、销售、管道、本周展望、Top 3 待办 | 「周一简报」「我手头有啥」「开周」 | business-pulse | ——(优雅降级) | QuickBooks、PayPal、HubSpot、日历、Gmail、Slack |
| `/friday-brief` | 周五收官:本周对比上周收入、亮点与需关注项 | 「周末了」「我们这周如何」「周五复盘」 | business-pulse | PayPal 或 HubSpot | —— |
| `/quarterly-review` | 完整季度回顾(QBR):收入、毛利、客户健康度、机会与风险 | 「季度回顾」「董事会材料」「QBR」 | business-pulse | QuickBooks | PayPal、HubSpot |

## 全部 15 个技能

技能是最小的功能积木,每个把一件事做好。

### 财务与现金

| 技能 | 作用 | 你可以直接说 | 必需 | 可选 |
|---|---|---|---|---|
| **cash-flow-snapshot** | 30/60/90 天现金预测,含置信区间与具名风险标记;聊天摘要 + XLSX | 「预测我的现金流」「能发工资吗」「跑道」「现金吃紧」 | QuickBooks、PayPal、Stripe 或 Square(任一) | 其它作为次级数据源 |
| **invoice-chase** | 按每位客户的付款历史与语气起草逾期催款提醒,经批准后经 PayPal 发送 | 「谁欠我钱」「逾期发票」「催未付款」 | QuickBooks | PayPal、Stripe、Gmail |
| **margin-analyzer** | 按产品/服务的单位经济模型,含通胀基准与三套定价情景 | 「我的毛利多少」「该涨价吗」「成本吃掉利润」「该定多少价」 | QuickBooks | PayPal、Square、CSV 上传 |
| **month-end-prep** | 月末结账:QB 与收款渠道对账、标差异、写 P&L 说明、导出结账包 | 「结这个月账」「对账」「P&L」「收入为啥变了」 | QuickBooks | PayPal、Stripe、Square |
| **tax-season-organizer** | 季度预缴税测算或年终 1099-NEC 准备,含给会计的交接包 | 「季度税」「预缴税款」「1099」「1099-NEC」「年终报税准备」 | QuickBooks | PayPal、Stripe |

### 销售与营销

| 技能 | 作用 | 你可以直接说 | 必需 | 可选 |
|---|---|---|---|---|
| **lead-triage** | 按互动、契合度与紧迫度给 HubSpot 线索打分,产出含话术的排序通话清单 | 「给线索排序」「先打给谁」「管道」 | HubSpot | Gmail、Google Calendar |
| **content-strategy** | 分析销售数据找出畅销与滞销品,产出优先排序的 30 天内容简报 | 「我该发什么」「内容计划」「什么在卖」「该推什么」 | QuickBooks 或 PayPal | Square |
| **canva-creator** | 拿到内容简报后执行整套营销:排期、Canva 素材、文案、HubSpot 暂存 | 「做内容」「生成帖子」「做素材」「把这个变成营销活动」 | Canva、HubSpot | —— |

### 客户与运营

| 技能 | 作用 | 你可以直接说 | 必需 | 可选 |
|---|---|---|---|---|
| **customer-pulse** | 汇总争议、工单、邮件情绪与评价,归纳主题报告 + 「本周做这三件事」清单 | 「客户感受如何」「大家在说什么」「争议」「评价分析」 | ——(优雅降级) | PayPal、HubSpot、Gmail |
| **ticket-deflector** | 读取客户邮件或工单,拉订单/退款状态,起草语气匹配的回复;经批准可发起 PayPal 退款 | 「起草回复」「回这个客户」「我的订单到哪了」「我要退款」 | PayPal、HubSpot、邮箱 | Intercom、Square |
| **crm-maintenance** | 保持 HubSpot 最新:建/更新联系人与商机、记录通话与备注、标记停滞记录 | 「更新 CRM」「记一通电话」「清理 HubSpot」「给商机补背景」 | HubSpot | Gmail、Google Calendar |
| **contract-review** | 大白话合同审阅,含风险红旗、严重度评级与带批注的 redline DOCX | 「审一下这份合同」「我签的是什么」「标出隐患」「看下付款条款」 | ——(可上传文件) | Gmail、DocuSign |

### 招聘

| 技能 | 作用 | 你可以直接说 | 必需 | 可选 |
|---|---|---|---|---|
| **job-post-builder** | 生成完整招聘包:岗位发布、含评分量表的结构化面试指南、录用通知模板 | 「帮我招人」「写个岗位」「职位描述」「招聘岗」「面试题」「起草录用通知」 | ——(可独立使用) | DocuSign、Google Drive |

### 经营洞察与上手

| 技能 | 作用 | 你可以直接说 | 必需 | 可选 |
|---|---|---|---|---|
| **business-pulse** | 一页经营快照:现金、销售、管道、承诺事项、关注清单,以及今天最该处理的那件事 | 「生意怎么样」「快照」「每周总结」「给我对一下进度」 | ——(优雅降级) | QuickBooks、PayPal、HubSpot、Google Calendar、Gmail、Slack |
| **smb-onboard** | 带你连接工具、跑一个演示配方、采集业务背景,并设定每周复盘节奏 | 「帮我设置」「设置」「开始」「帮我上手」「我是新手」「你能做什么」 | —— | 全部连接器 |

> 注:另有若干别名技能(如 `month-heads-up`、`monday-brief`、`friday-brief`、`call-list`、`price-check` 等)与上述命令同名,作为路由入口,均由 `smb-router` 统一调度。

## 个性化定制

这些工作流是通用起点,按你实际的经营方式定制后会好用得多:

- **补充业务背景** —— 把你的行业、产品、客户与流程写进技能文件,让 CrabCode 懂你的世界。
- **调整阈值** —— 把 `business-pulse` 与 `cash-flow-snapshot` 里的预警阈值调到适配你的规模。
- **替换连接器** —— 让技能指向你真正在用的工具。

也可在 `crabwork-small-business/.crabcode/settings.local.json` 创建本地设置文件,预填你的姓名、业务、技术栈等;未配置时插件会在需要时主动询问。

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。
