# crabwork 插件海外 SaaS 连接器 → 国内设施替换:现状审计与实施方案

> 日期:2026-06-23  ·  状态:**只读审计 + 方案待裁决(未实施)**  ·  目标仓:`acosmi/CrabCode-Plugin`(main)
>
> 触发:用户反馈 TUI/GUI 中 `crabwork-small-business` 等插件大量 MCP server 报 `failed (needs authentication)`,点 OAuth 登录卡死。根因定位后,用户裁决:**不去授权海外站,而是从根上把这些连接器等价替换为国内设施。**

---

## 一、问题与根因(为什么会有这些海外登录)

`crabwork-*` 系列职能插件是从**上游 Anthropic 官方插件市场("Claude for Work" 套件)整体移植改名**而来(crabwork ← Claude work suite)。移植时只做了品牌改名(claude→crab),**MCP 端点原样照搬,未做任何本地化**。上游面向美国中小企业,默认绑定 Stripe / PayPal / QuickBooks / HubSpot / DocuSign / Slack / Canva / Square 等**美国 SaaS 官方 MCP 端点**。

对中国用户的后果:
- 这些服务**用不到**(国内中小企业不用 Stripe/PayPal 收款、不用 QuickBooks 记账);
- 即便想用也**连不通**(实测 `mcp.canva.com`、`mcp.docusign.com` 国内直连超时;海外 OAuth 授权页需稳定代理);
- 首屏却把用户**引导去登录**这些服务 → 满屏 `failed (needs authentication)`,体验崩坏。

**结论:这不是技术上"必须等海外站点",而是照搬遗留的产品错配。根源解决 = 在自有插件库内替换为国内对应设施。**

---

## 二、现状盘点:13 个 crabwork 插件全部绑海外、零国内

整套 `crabwork-*` 职能套件 + 若干独立连接器,捆绑端点清一色海外:

| 插件 | 绑定的海外 MCP 端点(节选) |
|---|---|
| crabwork-small-business | quickbooks, paypal, hubspot, canva, docusign, slack, stripe, square, gmail, google calendar/drive |
| crabwork-marketing | slack, canva, figma, hubspot, amplitude, notion, ahrefs, similarweb, klaviyo, supermetrics |
| crabwork-sales | slack, hubspot, close, clay, zoominfo, notion, atlassian, fireflies, apollo, outreach |
| crabwork-customer-support | slack, intercom, hubspot, guru, atlassian, notion |
| crabwork-design | slack, figma, linear, asana, atlassian, notion, intercom |
| crabwork-engineering | slack, linear, asana, atlassian, notion, github, pagerduty, datadog |
| crabwork-product-management | slack, linear, asana, monday, clickup, atlassian, notion, figma, amplitude, pendo, intercom |
| crabwork-productivity | slack, notion, asana, linear, atlassian, monday, clickup |
| crabwork-operations | slack, notion, atlassian, asana |
| crabwork-hr | slack, notion, atlassian |
| crabwork-data | snowflake, databricks, bigquery, hex, amplitude, atlassian, definite |
| crabwork-enterprise-search | slack, notion, guru, atlassian, asana |
| crabwork-bio-research | pubmed, biorender, biorxiv, consensus, clinical-trials, chembl, synapse, wiley, owkin, opentargets |
| (独立) asana / linear / github / gitlab / discord / telegram / firebase | 各自海外端点 |

### 关键:替换工作量大头在 skill 正文,不在 `.mcp.json`

`.mcp.json` 改端点是小工程;但 skill 的提示词正文里**业务流程是写死海外服务的**。例 `plan-payroll/SKILL.md`:

> "Pull AR, AP from **QuickBooks, PayPal, Stripe, or Square**" / "**PayPal**-issued invoices queue as **PayPal**-send drafts"

工作量量化(grep 引用海外 SaaS 的文件数):

| 插件 | 引用海外 SaaS 的文件数 |
|---|---|
| crabwork-small-business | **78** 个文件(31 SKILL + reference 子文档) |
| crabwork-sales | 10 |
| crabwork-data | 5 |
| crabwork-design | 5 |
| crabwork-marketing | 4 |
| crabwork-productivity | 3 |
| crabwork-bio-research | 3 |
| 其余(engineering/pm/hr 等) | 各 0~1 |

**含义:替换 = `.mcp.json` 端点改写 + skill 正文/reference 文案重写 双轨,后者是主要人力。**

---

## 三、替换目标(用户裁决,2026-06-23)

| 领域 | 替换目标 | 说明 |
|---|---|---|
| 收款支付 | 微信支付 + 支付宝 | 主流国内 SaaS |
| 财务记账 | 用友(好会计) / 金蝶(精斗云) | 主流国内 SaaS |
| **电子签 / 电子认证** | **众律宝(自营)** | **不用 e签宝/法大大,用自营** |
| **设计** | **自营云端设计** | **不用稿定,用自营云端运行的设计** |
| 团队 IM / 协作 | 企业微信 / 钉钉 / 飞书 | 主流国内 SaaS |
| 文档 / 知识库 | 飞书文档 / 语雀 / 腾讯文档 | 主流国内 SaaS |
| 邮件 / 日历 / 网盘 | 腾讯企业邮 / 飞书·钉钉日历 / 阿里云盘 | 主流国内 SaaS |
| CRM | 销售易 / 纷享销客 | 待定选型 |
| 项目管理 | Teambition / ONES / 飞书·钉钉项目 | 待定选型 |

---

## 四、国内 MCP 可行性分层(基于事实核查,截至 2025 末/2026 初)

替换的形态由"国内目标服务是否有可直连的官方 MCP"决定。核查结论分三层:

### A 层 — 有官方 MCP,装包/改 URL 即用(第三方客户端可直连)
| 服务 | 接入方式 | 认证 | 成熟度 |
|---|---|---|---|
| **腾讯文档** | remote HTTP 端点 `https://docs.qq.com/openapi/mcp` | Authorization header token | 生产可用(唯一"纯改 URL") |
| **支付宝** | `npx -y @alipay/mcp-server-alipay`(stdio)/魔搭托管 | 应用私钥 RSA2 | 生产可用(国内支付首选) |
| **钉钉** | `npx -y dingtalk-mcp@latest`(stdio) | ClientID/Secret | 生产可用(含日程) |
| **飞书/Lark** | `npx @larksuiteoapi/lark-mcp`(stdio) | App creds + 用户 OAuth2 | 生产(Beta,活跃;文档仅读/导入) |
| **语雀** | `npx yuque-mcp install`(stdio) | 个人 Token | 生产可用 |
| **MasterGo** | `npx` / SSE 远程 | MG_MCP_TOKEN(Team 版) | 生产可用(设计→代码唯一官方) |

### B 层 — 无官方 MCP,必须自建 wrapper(对接其 OpenAPI)
- **众律宝(自营电子签)** ← DocuSign  ★ 自营,优先级最高
- **自营云端设计** ← Canva  ★ 自营,优先级最高
- 企业微信(社区仅 webhook)、销售易(MCP 内化不可外连)、有赞、稿定/创客贴/即时设计、腾讯企业邮(通用 IMAP MCP)、阿里云盘

### C 层 — "支持 MCP"为真,但内化在其 Agent 平台、不给外部端点(绑平台或基于 OpenAPI 自建)
- **微信支付**(绑腾讯元器平台)、**用友 BIP**、**金蝶苍穹**、**纷享销客**
- 含义:其 MCP 要求"你的工具反向跑进它们的 Agent 平台",而非你来连它。对本产品基本等同 B 层(自建 wrapper 走其 OpenAPI)。

> 来源(节选):支付宝 npm `@alipay/mcp-server-alipay` · 钉钉 github `open-dingtalk/dingtalk-mcp` · 飞书 github `larksuite/lark-openapi-mcp` · 腾讯文档 `docs.qq.com/open/document/mcp` · 语雀 github `yuque/yuque-mcp-server` · MasterGo github `mastergo-design/mastergo-magic-mcp` · 微信支付绑元器 `yuanqi.tencent.com/guide/wechat-pay-mcp-plugin` · 用友 BIP / 金蝶苍穹平台级支持公告。

---

## 五、逐端点替换映射矩阵

| 海外原绑 | 用途 | 国内替换 | 可行性层 | 接入/认证 | 工作量 |
|---|---|---|---|---|---|
| Stripe / PayPal / Square | 收款 | **支付宝**(主)+ 微信支付 | 支付宝 A / 微信支付 C | 支付宝 npm+RSA2;微信支付绑元器或自建 | 中 |
| QuickBooks | 记账 | 用友好会计 / 金蝶精斗云 | C(平台/自建) | 基于好会计·精斗云 OpenAPI 自建 | 高 |
| **DocuSign** | 电子签 | **众律宝(自营)** | B(自建) | 自营,需众律宝 OpenAPI/接口规格 | 高(自营对接) |
| **Canva** | 设计 | **自营云端设计** | B(自建) | 自营,需接口规格 | 高(自营对接) |
| Figma | 设计稿/转代码 | MasterGo(过渡)或自营 | A(MasterGo) | MasterGo npm/SSE + Token | 低-中 |
| Slack | 团队 IM | 钉钉 / 飞书(主)、企业微信 | 钉钉·飞书 A / 企微 B | 官方 npm;企微自建 | 低-中 |
| Notion / Atlassian(文档面) | 文档/知识库 | 语雀 / 腾讯文档 / 飞书文档 | A | 官方,见上 | 低 |
| Gmail | 邮件 | 腾讯企业邮 / 网易企业邮 | B | 通用 IMAP/SMTP MCP + 专用密码 | 中 |
| Google Calendar | 日历 | 飞书日历 / 钉钉日历 | A(随 lark/dingtalk) | 官方 preset | 低 |
| Google Drive | 网盘 | 阿里云盘 / 自营 | B | 自建(阿里云盘开放 API 受限) | 中-高 |
| HubSpot | CRM | 销售易 / 纷享销客 | C(内化/平台) | 自建走其 OpenAPI | 高 |
| Asana/Linear/Monday/ClickUp/Jira | 项目管理 | Teambition / ONES / 飞书·钉钉项目 | 待核实(多为 B) | 多需自建;飞书钉钉覆盖部分 | 高 |
| Amplitude/Pendo(产品分析) | 行为分析 | 神策 / GrowingIO | B | 自建 | 高 |
| BigQuery/Snowflake/Databricks | 数仓 | 阿里云 MaxCompute / 腾讯云 | B | 自建 | 高 |
| Klaviyo/Apollo/ZoomInfo/Ahrefs/SimilarWeb | 营销情报 | 国内对应弱 | — | 多数无对应,建议降级/移除 | — |
| pubmed/biorxiv/chembl…(bio-research) | 学术 | 多为国际公开学术资源 | 特例 | 部分本就公开可保留,其余降级 | 特例 |

---

## 六、技术架构建议:双轨 + 适配层

1. **官方 MCP 直连轨(A 层)**:`.mcp.json` 直接声明官方端点/npm 包(支付宝、钉钉、飞书、语雀、腾讯文档、MasterGo)。改端点 + 改 skill 文案即可。
2. **自建 wrapper 轨(B/C 层)**:CrabCode 侧实现 MCP server,对接目标服务 OpenAPI。**自营众律宝 / 自营云端设计是本轨第一优先**(自有接口、不受第三方平台限制)。建议沉淀一个 `crabwork-mcp-adapters` 通用 wrapper 框架(参考现有 `templates/plugin-mcp-wrapper`),按服务挂适配器。
3. **平台内化单列(C 层)**:微信支付/用友/金蝶/纷享销客的"MCP"会要求反向接入其 Agent 平台。需产品决策是"绑平台"还是"走其 OpenAPI 自建",不能想当然当作可直连。

---

## 七、实施路径(分阶段,先试点后铺开)

- **阶段 0 — 止血(可即做,低风险)**:把连不通的海外端点从默认插件 `.mcp.json` 摘除或改为可选,首屏不再误导刷 `failed`;skill 保留。让用户当下不再被无效 OAuth 困扰。
- **阶段 1 — 试点 `crabwork-small-business`**:端到端替换一个插件(支付→支付宝、记账→用友/金蝶、电子签→众律宝、设计→自营、IM→钉钉/飞书),含 `.mcp.json` + 78 个文件文案重写。打通"官方直连 + 自建 wrapper"双轨范式。
- **阶段 2 — 复制到其余 12 个 crabwork 插件**:按试点范式批量替换,A 层优先(IM/文档/日历改动小),B/C 层随 wrapper 框架就绪推进。
- **阶段 3 — 自建 wrapper 工程**:众律宝、自营云端设计、用友/金蝶、企业微信、腾讯企业邮等逐个落地 wrapper。

> 协作纪律(本仓 §13/§14):doc-only 走独立分支由用户一次性 merge;实施按插件拆独立窗口,一窗一件事;设计裁决先拍板再实施。

---

## 八、待用户/产品裁决的决策点

1. **众律宝接口规格**:自营电子签的 OpenAPI / 认证方式 / 沙箱环境在哪?wrapper 需要它才能动工。
2. **自营云端设计接口规格**:同上。设计场景是"生成图/海报"还是"设计稿转代码"?决定 wrapper 能力面与是否用 MasterGo 过渡。
3. **微信支付**:接受"绑腾讯元器平台",还是基于微信支付 OpenAPI 自建 wrapper?(支付宝已可官方直连,微信支付是额外成本)
4. **CRM 选型**:销售易(MCP 内化不可外连)vs 纷享销客(平台绑定)——还是先不做 CRM、HubSpot 直接移除?
5. **项目管理选型**:Teambition / ONES / 飞书项目 / 钉钉项目,选哪个为主?
6. **营销情报类(Klaviyo/Apollo/Ahrefs 等)**:国内无等价,确认"降级移除"还是另找替代?
7. **bio-research 插件**:其海外学术源多为国际公开资源,是否保留/部分保留,还是一并降级?
8. **阶段 0 止血**是否立即执行(独立于完整替换)。

---

## 九、风险与非目标

- **非目标**:本方案不改 CrabCode 主仓(`src/`/`crates/`),只动插件库 `acosmi/CrabCode-Plugin`。
- **风险 1**:自建 wrapper 是持续维护负担(目标服务 API 变更需跟进)。
- **风险 2**:C 层平台内化服务(微信支付/用友/金蝶/纷享)可能要求反向接入,产品形态需提前确认,否则架构返工。
- **风险 3**:skill 文案重写量大(small-business 单插件 78 文件),需保证替换后业务流程仍自洽(审批门、回退路径等不能丢)。
- **红线**:插件库仍是 marketplace 内容仓,不触碰源码红线;不向公仓推送源码。
