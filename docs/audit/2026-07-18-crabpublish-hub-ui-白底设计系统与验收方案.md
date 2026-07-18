# CrabPublish Hub UI 白底设计系统与验收方案

- 文档日期：2026-07-18
- 文档状态：`0.1.0` 独立本地 UI fixture 与自动化 smoke/回归基线已实施；UI-3 真实后端及 UI-4 人工/production 验收未完成
- 上位方案：[《CrabCode 多平台多内容类型分发调研与实施方案》](./2026-07-18-crabcode-media-publisher-多平台多内容类型分发调研与实施方案.md)
- 建议实施位置：`CrabCode-Plugin/plugins/crabcode-media-publisher/apps/publisher-app/`
- Figma 基础文件：[CrabPublish Hub UI · Apple White](https://www.figma.com/design/oOtG8Etm4wGVhGfrkU2GBy)
- Figma 续作状态：[figma-state.json](../../plugins/crabcode-media-publisher/docs/design/figma-state.json)
- 设计范围：Hub Web 控制台、编辑器、平台变体预览、审批、任务结果、账号能力、证据与 Edge 配对
- 强制主题：白底工作区；导航使用固定浅灰，编辑器、预览、弹窗和主表面保持纯白/浅灰层级，均不随系统深色偏好反转

## 一、文档边界

本文档是 Hub UI 的信息架构、视觉、组件、交互和视觉验收真源。上位方案仍是发布架构、权限、数据、审批、幂等、连接器、部署和安全边界的真源。

若两份文档冲突：

1. 不得通过 UI 降级强身份、审批哈希、一次性授权、幂等、证据、Cookie 本地化和 fail-closed 约束。
2. 状态命名、发布语义和账号能力以上位方案为准。
3. 布局、排版、组件、交互和视觉验收以本文档为准。

本文档不声明任何已部署的 Hub 域名或 MCP URL。UI 开发和验收可使用 loopback；正式入口由上位方案的部署门单独决定。

## 二、设计目标与非目标

### 2.1 目标

- 让用户在任何发布副作用前，看清“什么内容、哪个账号、哪种体裁、什么动作、什么时间”。
- 区分原始作品、平台变体、预览、已批准版本和 Adapter 实际回读内容。
- 对部分成功、审核中、需人工处理、设备离线和未知结果给出准确、可恢复的界面。
- 将白底精排 HTML 作为默认阅读与下载交付，MD 作为同一安全草稿/冻结 revision 确定性派生的可下载备份。
- 让编辑、审批、运营、安全和审计角色看到各自必要信息，不暴露 Cookie、token 或无关敏感数据。

### 2.2 非目标

- 不用一个通用“发布”按钮隐藏不同平台、体裁和动作的差异。
- 不追求平台后台的像素级复刻；预览展示可批准的规范内容和已验证字段语义。
- 不用视觉美化遮蔽 `unverified`、`partial`、`unknown` 或风险警告。
- 不将深色模式作为首版工作项；系统深色偏好下仍保持白底。
- 不依赖远程字体、远程 CSS、远程脚本或跟踪像素。

## 三、角色与核心任务

| 角色 | 首要任务 | 不得默认拥有的能力 |
|---|---|---|
| 编辑 | 导入、改稿、管理素材、制作平台变体、查看 diff | 最终发布批准 |
| 运营 | 选择账号/体裁/时间，准备批次，跟踪结果 | 绕过审批或修改已冻结 payload |
| 批准人 | 查看确切变体和风险，使用强身份一次性批准 | 在不产生新 revision 的情况下改稿 |
| 审计/安全 | 查看批准绑定、状态历史、脱敏证据和异常 | 看到平台 Cookie、密码、短信码或原始 token |
| 管理员 | 配置组织、角色、官方 connector 和 Edge 设备策略 | 代替业务批准人默认发布 |

## 四、信息架构与路由

### 4.1 主导航

1. 工作台
2. 内容
3. 发布批次
4. 任务与结果
5. 账号与能力
6. 审计与证据
7. 设置与 Edge

### 4.2 页面路由表

| 路由 | 页面 | 核心信息 | 主操作 |
|---|---|---|---|
| `/app` | 工作台 | 待编辑、待审批、执行中、需人工处理、最近结果 | 继续工作、处理异常 |
| `/app/works` | 内容列表 | 作品、revision、作者、修改时间、冻结状态 | 新建、导入、打开 |
| `/app/works/:workId/edit` | 内容编辑 | 标题、正文、素材、来源/披露、HTML/MD | 保存 revision、冻结 |
| `/app/works/:workId/variants` | 平台变体 | 账号 + 体裁、字段差异、能力、缺失项、相似度 | 生成、编辑、重新校验 |
| `/app/works/:workId/preview` | 预览与 diff | 冻结版、变体、Adapter 回读差异 | 接受新 revision、返回修改 |
| `/app/batches/new` | 批次准备 | 账号、体裁、动作、时间、风险和可发布性 | 创建批次 |
| `/app/batches/:batchId/review` | 审批 | 确切变体、绑定哈希、声明、目标集合 | 批准、拒绝、返回修改 |
| `/app/batches/:batchId` | 批次结果 | 总体 outcome 和单项状态/证据 | 对账、安全重试、人工接管 |
| `/app/accounts` | 账号与能力 | 账号指纹、内容类型、操作、配额、verifiedAt、Edge | 连接、刷新能力、禁用 |
| `/app/audit` | 审计与证据 | 批准人、哈希、执行器、脱敏证据、状态历史 | 筛选、导出 |
| `/app/settings/edge` | Edge 设备 | 设备指纹、版本、在线状态、可用平台 | 配对、撤销、升级 |

### 4.3 核心流程

~~~mermaid
flowchart LR
  A["导入/编辑内容"] --> B["冻结 ContentRevision"]
  B --> C["生成平台变体"]
  C --> D["预览、校验与 diff"]
  D --> E["创建发布批次"]
  E --> F["强身份审批"]
  F --> G["执行与单项对账"]
  G --> H["结果、证据与人工接管"]
  D -->|"有可见修改"| C
  F -->|"返回修改"| C
~~~

“一键发布”的 UI 语义是“对已预览的多个独立 item 做一次批准，然后并行执行”，不是跳过变体和审批的首页危险按钮。

## 五、页面级设计

### 5.1 工作台

- 顶部只显示工作区、当前身份和 Edge 总体在线状态，不把平台 token 或账号私密字段暴露给前端。
- 待办按可行动分组：继续编辑、待审批、需登录/验证、需对账。
- “最近成功”与“需人工处理”不得混在一个绿色统计卡中。
- 首页不提供跳过审批的“立即发布所有”。

### 5.2 内容编辑

宽屏为三区布局：

| 区域 | 建议宽度 | 内容 |
|---|---:|---|
| 左侧导航/结构 | 224–240 px | 文档结构、素材、来源、版本 |
| 中间编辑主区 | min 640 px | 标题、摘要、Markdown 正文、图片/图注 |
| 右侧检查/预览 | 360–420 px | 原创、来源、披露、HTML 预览、平台缺失项 |

编辑器工具栏使用粘性定位，但不得遮挡 H1 或手机端键盘。首版 fixture 使用受控 Markdown 文本区和确定性 AST 渲染管线，不冒充已实施 Tiptap；服务端协作编辑如后续需要，应另行论证 ArticleDoc/ProseMirror 数据模型与迁移。导入外部 HTML 时先清洗并明确显示“HTML 已清洗”；不在后台静默改写可见正文。

本地导入首版约束：

- 接受 `.md/.markdown` 与 `.html/.htm`，单文件不超过 256 KiB；另设同步复杂度预算（300000 work units、8192 个结构标记、4096 个换行），过密结构导入会拒绝、编辑会暂停实时预览。浏览器只读文件内容，不上传、不保存本地绝对路径、不写 localStorage/sessionStorage。
- 导入后回填标题、导语和正文，立即同步右侧 HTML 成品预览；UI 不新增 Markdown 预览页签，避免把“导入格式”误解为“两套成品预览”。
- 导入、编辑、保存本页会话草稿都不等于生成或冻结 revision；刷新后允许丢失，界面必须如实标示。
- 正文格式工具必须产生真实 Markdown 变换并同步预览，不得使用无动作的装饰按钮。

### 5.3 平台变体

- 左侧为“平台账号 + 内容类型”列表，例如“微博 A / 普通微博”和“微博 A / 长博文”是两个独立项。
- 每项同时显示 capability、verifiedAt、可执行动作和当前风险，不只显示“已连接”。
- 中间显示该体裁的真实字段，右侧显示规范预览和差异。
- 对同一头条账号的 article/micro_post 高相似风险使用阻断面板，不用可轻易略过的 toast。

### 5.4 审批与批次

审批页顶部显示不可变摘要：

- 作品/revision；
- 账号和账号指纹；
- 平台内容类型；
- 动作（草稿、立即发布、定时、群发）；
- 计划时间和时区；
- 预览/验证/素材哈希；
- 原创、AI、商业、信息来源等声明。

批次中每个 item 可单独排除，但变更目标集合必须产生新 batch revision 和新目标哈希。“保存草稿”和“最终发布”使用不同动作层级与确认文案。

### 5.5 任务与结果

- 批次显示 phase 和 outcome 两个维度，例如 `terminal / partial`。
- 每个 item 显示平台、账号、体裁、动作、当前状态、最后观察时间、远端 ID/URL 和证据。
- `unknown` 只提供“先对账”，不提供盲目再发。
- `action_required` 显示需要用户做什么、在哪台设备做、完成后如何继续；不暴露验证码本身。
- `published` 必须附真实远端证据；单纯“按钮已点击”不能呈现为成功。

### 5.6 账号与 Edge

平台账号列表必须下钻到内容类型和操作：

- 微博：普通微博、长博文、视频微博分别显示。
- 头条：文章、微头条、小视频、中视频分别显示。
- 大鱼号：文章、视频、故事会投稿分别显示；UC 是下游分发结果，不默认生成第二条任务。
- 简书：明确“可保存远端草稿”和“最终发布未验证”的差异。

Edge 设备页只显示脱敏设备指纹、扩展/适配器版本、最后心跳、支持的平台 origin 和可恢复错误；不提供 Cookie 查看/导出 UI。

## 六、白底视觉系统

### 6.1 颜色令牌

| Token | 基线值 | 与白底对比度 | 用途 |
|---|---|---:|---|
| `color.canvas` | `#FFFFFF` | — | 整页背景 |
| `color.surface` | `#FFFFFF` | — | 工作区、编辑画布、文章、弹窗主表面 |
| `color.navigation` | `#F5F7FA` | — | 主导航/移动抽屉浅灰底，与纯白工作区分层 |
| `color.subtle` | `#F8FAFC` | — | 小范围表头、禁用区和分隔带 |
| `color.text` | `#0F172A` | 17.85:1 | 主文字 |
| `color.textMuted` | `#475569` | 7.58:1 | 次要文字 |
| `color.border` | `#E2E8F0` | — | 边框和分割线，不承载文字语义 |
| `color.controlBorder` | `#8795A8` | 3.05:1 | 仅用于普通模式下必须可识别的输入/选择/编辑区域边界 |
| `color.primary` | `#1769E0` | 5.08:1 | 主操作、链接、焦点 |
| `color.success` | `#15803D` | 5.02:1 | 成功文字/图标 |
| `color.warning` | `#B45309` | 5.02:1 | 警告文字/图标 |
| `color.danger` | `#B42318` | 6.57:1 | 危险操作和错误 |

主 canvas、编辑画布、文章、预览和弹窗主表面必须显式使用 `#FFFFFF`；导航使用 `#F5F7FA`，卡片/禁用区使用 `#F8FAFC` 或语义浅色面。浅灰只承担分组，不得形成深色主题或压过正文。上述颜色是首版无障碍基线，不冒充 Acosmi 已发布的品牌规范；后续如有官方令牌，必须版本化替换并重跑对比度与截图验收。

### 6.2 排版

UI 字体栈：

`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`

| 层级 | 字号/行高 | 字重 | 用途 |
|---|---|---:|---|
| Display | 32/40 px | 650 | 主工作台标题，尽量少用 |
| Page title | 24/32 px | 650 | 页面主标题 |
| Section title | 18/28 px | 600 | 区块标题 |
| Body | 14/22 px | 400 | 控制台正文和表格 |
| Small | 12/18 px | 400/500 | 辅助、时间、状态说明 |

数值、哈希和状态 ID 可使用等宽字体，但长 ID 默认中间截断，通过显式“复制”操作获取全值。

### 6.3 间距、尺寸与层级

- 间距系统：4、8、12、16、24、32、48 px。
- 主操作按钮高度：40 px；紧凑表格操作不低于 32 px；主流程触控目标不低于 40×40 px。
- 圆角：输入/按钮 8 px，卡片/弹窗 12 px；状态 chip 可使用完全圆角。
- 常态主层次优先使用“浅灰面 + 纯白面 + 留白”，卡片、胶囊、导航和次级按钮不使用装饰性描边；仅焦点环、强制颜色模式以及确有交互识别必要的控件边界可以保留线条。
- 侧栏/移动导航使用 `color.navigation`，工作区、编辑画布和文章正文保持纯白；嵌套内容用白色小面置于浅灰卡片中，不靠边框切割。
- 不使用装饰性大面积渐变、发光或会干扰长文阅读的背景纹理。

### 6.4 图标与状态

图标使用同一套可审计的 SVG 图标库或本地资产，不从 CDN 加载。状态必须由“文字 + 图标 + 说明”共同表达，不得只用红黄绿点。

## 七、文章与平台预览

### 7.1 白底文章排版

- 文章预览主栏宽度 680–720 px，居中展示。
- 正文桌面端 17 px/1.75，移动端 16 px/1.75。
- H1 桌面端 32/40 px，移动端 26/34 px；H2 24/34 px；H3 20/30 px。
- 段间距 1em–1.25em；列表缩进、引用、表格、图片和图注使用一致垂直节奏。
- 使用单一 H1 和 H2–H4 合法层级；不用放大普通段落伪装标题。
- html、body、article 和打印页主表面显式使用 `#FFFFFF`。
- 图片必须保持比例，默认不超出正文宽度；图注与替代文本是可见 QA 项。
- A4/Letter 打印不得出现标题孤行、图片溢出、表格水平截断或不必要的导航。

### 7.2 预览不冒充平台实页

预览顶部必须显示“规范预览”、Adapter 版本和 capability verifiedAt。除非有固定浏览器实页截图和回读证据，不宣称像素级还原。

| 平台内容类型 | 预览必显字段 |
|---|---|
| `weibo.status` | 短文、话题、图片顺序、字符/素材规则 |
| `weibo.long_article` | 标题、导语、封面、正文和 wrapperText |
| `toutiao.article` | 标题、正文、封面、分类、信息来源和声明 |
| `toutiao.micro_post` | 短文、图片、话题和与文章的相似度风险 |
| `dayu.article` | 标题、正文、封面、来源、原创声明和 UC 下游分发说明 |
| `dayu.video` | 视频、横/竖封面、标题、描述、标签、来源和审核状态 |
| `jianshu.article` | 标题、正文图、文集/笔记本、草稿 URL 和最终发布验证状态 |

### 7.3 HTML 与 MD

HTML 是默认用户呈现，MD 是同一安全草稿或冻结 revision 的可下载备份。UI 不提供两个互不相关的文本编辑器，也不因支持 `.html`/`.md` 导入而新增双预览页签。当前本地 fixture 以 `EditorDraft`（标题、导语、规范化安全 Markdown 正文、作者/来源/披露状态）为唯一交互事实源，HTML 和 MD 由同一次 artifact 生成确定性派生；未来若引入 ArticleDoc/Tiptap JSON，必须提供明确迁移与等价性测试。

安全对等规则：原始导入件不等于 MD 备份。原始 HTML、危险协议、远程图片和可执行结构在进入 `EditorDraft` 前被移除；安全 HTTP(S) 链接降级为可见 URL 文本，图片只保留可见替代文字。HTML 与 MD 必须对这些规范化后的可见文本、标题层级、列表、表格、作者、来源和披露保持对等，不承诺保留被安全策略拒绝的主动链接或远程媒体。

## 八、组件系统

| 组件 | 必要状态 | 关键约束 |
|---|---|---|
| Button | default、hover、focus、disabled、loading、danger | loading 不能丢失原动作名；危险动作不伪装成主色普通操作 |
| Input/Textarea | empty、filled、focus、error、disabled、read-only | 错误与字段绑定，不只有页顶 toast |
| Select/Combobox | loading、empty、results、error、disabled | 键盘可用，账号显示脱敏标识和体裁能力 |
| Tabs | default、active、focus、overflow | 不将关键错误只放在未选中 tab 内 |
| Table | loading、empty、partial data、error、pagination | 小屏转 card/list，不依赖水平拖动完成主任务 |
| StatusBadge | 全部业务状态 | 文字 + 图标 + 说明，不只用颜色 |
| Stepper | complete、current、blocked、stale | 明确告知返回修改会使哪些步骤失效 |
| Dialog | info、confirm、danger、async | 焦点陷阱、Escape 策略、返回焦点；发布批准不用普通 confirm 代替强身份 |
| Drawer | preview、evidence、action required | 小屏为全屏，保留返回点 |
| DiffViewer | unchanged、added、removed、changed、large doc | 支持可见文本和字段级 diff；颜色外增加符号/文字 |
| EvidencePanel | no evidence、available、redacted、expired | 不显示敏感原图；展示脱敏标识、哈希、采集时间和 Adapter 版本 |
| RichEditor | pristine、dirty、saving、saved、conflict、read-only | 自动保存不等于冻结；冲突不静默覆盖 |

默认组件外观遵循无装饰描边策略：状态胶囊使用“图标 + 文字 + 浅语义色面”，卡片使用浅灰/白面和间距，禁用发布项使用持续可见的浅灰面。焦点可见性和 forced-colors 下的实体边框不受该视觉偏好削弱。

## 九、状态语义与文案

状态不得混成一张枚举。实现真源为 `packages/domain/src/status.ts`，UI 只通过五个 presentation accessor 取得 `{ label, description, tone, terminal, allowedActions }`；不得在页面里另写一套终态判断。

### 9.1 账号能力

| 状态 | 中文主文案 | UI 行为 |
|---|---|---|
| `unverified` | 能力未验证 | 禁用真实提交，只允许刷新与查看证据 |
| `stale` | 能力证据已过期 | 重新取证前保持关闭 |
| `disabled` | 能力已停用 | 只允许有权角色重新启用 |
| `verified` | 能力已验证 | 仍须受动作、审批和 intent 约束 |

### 9.2 批次阶段

`draft → review → approved → queued → executing → terminal`；`cancelled` 是另一终态。阶段为 `terminal` 只代表流程结束，不能据此显示成功，必须读取独立 outcome。

### 9.3 批次结果

| 状态 | 中文主文案 | 关键约束 |
|---|---|---|
| `pending` | 结果待定 | 非终态，继续查看单项进度 |
| `success` | 全部成功 | 每个 item 均须有可核验证据 |
| `partial` | 部分完成 | 展示逐项结果，不用总体绿色覆盖 |
| `failed` | 执行失败 | 只允许查看证据和安全创建新意图 |
| `cancelled` | 结果已取消 | 已发生的外部副作用不伪回滚 |
| `unknown` | 结果待核对 | 非终态，只允许先对账，禁止盲目重发 |

### 9.4 审批

`pending / approved / rejected / stale_approval / expired` 独立于发布结果。`stale_approval` 显示使批准失效的变更，要求重新预览与强身份审批。

### 9.5 单项发布

| 状态 | 中文主文案 | 关键约束 |
|---|---|---|
| `prepared_local` | 已在本地页面准备 | 关闭页面可能丢失，不称为远端草稿 |
| `remote_draft` | 已保存远端草稿 | 展示 draft ID/URL 或回读证据 |
| `waiting_for_edge` | 等待发布设备上线 | 显示设备、心跳和安全取消 |
| `action_required` | 需要你在发布设备处理 | 不绕过登录、扫码、短信或验证码 |
| `blocked` | 任务已阻断 | 阻塞条件可证明改变后才允许新尝试 |
| `retry_wait` | 等待安全重试 | 沿用原 intent/幂等键并等待窗口 |
| `submitted` | 已提交平台 | 非终态，不显示“已发布” |
| `under_review` | 平台审核中 | 非终态，继续对账 |
| `published` | 已发布 | 终态且必须有远端证据 |
| `rejected` | 平台已拒绝 | 终态；原意图不能继续提交 |
| `failed` | 发布失败 | 终态；再次执行必须创建受控新意图 |
| `cancelled` | 发布项已取消 | 终态；已发生副作用不伪回滚 |
| `unknown` | 结果待核对 | 非终态，只允许对账和查看证据 |

所有成功、警告和错误信息必须在对应页面内留有持久状态，toast 只能用于短暂操作回执，不是业务真源。

## 十、响应式与视口

| 视口 | 布局策略 | 必验任务 |
|---|---|---|
| ≥ 1440 px | 左导航 + 主区 + 右检查/预览 | 编辑、变体 diff、审批和批次结果 |
| 1024–1439 px | 左导航可收窄，右侧为抽屉 | 列表、编辑、预览往返和审批 |
| 768–1023 px | 单主区 + 全屏预览/检查层；固定验收 820×1180 | 审批查看、任务处理和账号能力 |
| 390–767 px | 用于内容预览、待办处理和结果查看；固定验收 390×844 | 文章预览、状态、人工接管和安全取消 |
| 320–389 px | WCAG reflow / 400% 等价 CSS 视口，不保留桌面三栏 | 主导航、状态、结果卡片、关闭与对账 |

所有视口不得依赖水平滚动才能找到主操作。小屏的长文编辑可限制为辅助修改，但必须保留预览、审批查看和安全停止能力。

## 十一、无障碍与键盘

- 目标基线为 WCAG 2.2 AA。
- 所有主流程可用键盘完成；焦点顺序与可见布局一致。
- 焦点环在白底和所有状态背景上可见；不使用 `outline: none` 且无等价替代。
- 弹窗/抽屉有正确标题、焦点陷阱、Escape 策略和关闭后焦点返回点。
- 表单提示和错误与字段建立程序化关联；不用 placeholder 代替 label。
- 状态和 diff 不只依赖颜色；图表、进度和平台标识具备文本等价。
- 动画遵守 `prefers-reduced-motion`；不使用闪烁、自动轮播或会遮挡内容的长时间动效。
- 实施验收同时使用 axe 自动化和人工键盘/屏幕阅读复核；自动零错误不等于人工验收通过。

## 十二、前端安全与隐私

- 用户输入 HTML 按 allowlist 清洗，禁止 script、事件属性、危险 URL、任意 iframe 和远端 CSS。
- Markdown 原始 HTML、危险协议与远程图片在规范化 AST 中移除；HTML 导入先清洗完整 HAST，再从清洗树选择 `main/article/body` 并通过维护中的 `hast-util-to-mdast` 转换。脚本、样式、表单、iframe、SVG、事件属性和远程媒体不得穿透。导入文件只在浏览器内存读取，受 256 KiB 与同步复杂度双预算约束，不上传、不持久化内容或路径。
- 导入文稿不得继承固定 fixture 的作者、来源数或 AI 披露；固定稿一旦编辑也立即失效。这些字段进入 `EditorDraft`，变更后默认 `pending_review`，UI 明示“未通过冻结门”。标题/导语统一执行 64/160 UTF-16 字符约束。
- 实时 artifact 生成使用 250 ms 防抖与 generation token；新导入、保存、换页会取消旧计时器。每次草稿导航替换 iframe 节点，只有该节点自身的 opaque iframe `load` 后才能显示“HTML 成品与 MD 备份已同步”。
- 预览使用无权限、opaque-origin 的 `iframe sandbox=""`；禁止增加 `allow-scripts`、`allow-same-origin`、表单、弹窗或顶层导航权限。规范文章由本地构建产物 `/article-preview.html` 提供；本页会话草稿由可撤销的 Blob URL 提供，并在更新/换页时撤销旧 URL。两者都不使用 `srcdoc`，预览文档独立使用 `default-src 'none'`、`style-src 'unsafe-inline'`、`img-src data:`、`connect/frame/object/form/base none` 的 CSP，配合 `referrerPolicy=no-referrer`。父页 `frame-src` 仅开放 `'self' blob:`，不开放远程 frame。
- 首版预览不使用 `postMessage`。未来确需通信时，上位安全方案必须先冻结消息 schema、来源/目标 origin、nonce 与负向测试，UI 文档不得自行放宽。
- 前端不接收、存储、打印或导出平台 Cookie、localStorage、密码、短信码或原始 refresh token。
- 截图、trace 和 EvidencePanel 只使用脱敏资产，显示采集时间、哈希、Adapter 版本和脱敏状态。
- 所有可发生副作用的前端请求都使用后端绑定的 intent/approval/idempotency，不接受自由正文和 `confirmed: true`。
- 未授权、身份过期、审批失效或哈希不匹配时 fail closed，界面不提供隐藏绕过入口。

## 十三、设计到实现交付物

编码前交付：

- 信息架构与路由表；
- 内容、变体、预览、审批、执行、对账线框图；
- 设计令牌 JSON 和可读规范；
- 组件/状态矩阵；
- 桌面、窄屏和移动预览高保真页面；
- 安全、无障碍与状态文案复核记录。

实施产物（`0.1.0` 已落地）：

~~~text
plugins/crabcode-media-publisher/
├── packages/ui/
│   ├── design-tokens.json
│   └── src/tokens.css
├── packages/domain/src/status.ts
├── apps/publisher-app/
│   └── src/{app,routes,components,styles}.ts
└── tests/
    ├── unit/
    ├── security/
    └── browser/{ui.pw.ts,snapshots/}
~~~

不另建 `docs/design/hub-ui-spec.md`，避免形成第三份 UI 真源；本文件是规范，代码中的 domain/tokens 是可执行契约。

实施阶段：

1. UI-0：信息架构、文案和状态语义评审。
2. UI-1：线框、令牌和组件状态冻结。
3. UI-2：高保真主流程与固定 fixture。
4. UI-3：设计系统、页面和前后端真实状态实现。
5. UI-4：固定截图、axe、Nu、键盘、屏幕阅读和人工视觉验收。

每个阶段完成后更新 designVersion；可见设计变更必须更新截图基线并记录变更原因，不得用无审核的“更新快照”消除回归。

## 十四、固定截图与视觉验收

### 14.1 固定环境

- 固定 Google Chrome `150.0.7871.116`（macOS arm64）、Playwright `1.61.1`、axe `4.12.1`、Nu `26.7.15 (7eee590)`。
- 固定系统字体可用性、DPR、locale（`zh-CN`）、timezone 和动画禁用策略。
- 固定 fixture、图片、视频封面、账号脱敏标识、时间和随机数。
- 禁止远程网络资产影响截图；浏览器测试拦截除 `127.0.0.1` 以外的全部请求。
- 基线存放在 `tests/browser/snapshots/chrome-150-macos/`；仅设计变更时通过 `test:browser:update` 更新，更新后必须再用 `test:browser`（`--update-snapshots=none`）独立复验。
- 截图比较阈值固定为单像素色差 `0.1`、全图差异比例不超过 `0.2%`；首版不允许动态遮罩。

### 14.2 截图矩阵

| 页面/状态 | 1440×900 | 820×1180 | 390×844 / 320×568 | 打印 |
|---|---:|---:|---:|---:|
| 工作台默认/需人工处理 | 是 | 是 | 是 | 否 |
| 内容编辑与白底 HTML 预览 | 是 | 是 | 预览 | A4 固定截图；Letter/PDF 人工待验 |
| 平台变体与高相似阻断 | 是 | 是 | 查看 | 否 |
| 审批页与 stale approval | 是 | 是 | 是 | 否 |
| 批次 partial/unknown/action_required | 是 | 是 | 是 | 否 |
| 账号能力 unverified/disabled/ready | 是 | 是 | 是 | 否 |
| Edge 离线与配对 | 是 | 是 | 是 | 否 |
| 审计证据脱敏 | 是 | 是 | 查看 | 导出样式 |
| 未授权/会话过期/哈希不匹配/编辑冲突 | 是 | 查看 | 查看 | 否 |
| blocked/retry_wait/rejected/failed/cancelled | 是 | 查看 | 查看 | 否 |

### 14.3 验收门

- 页面不存在水平溢出、主操作遮挡、文字截断、错位、图片变形或不可达焦点。
- html/body/article、Hub canvas、编辑与预览主面均为 `#FFFFFF`；导航保持 `#F5F7FA`，卡片保持约定浅色面；系统深色偏好下不变黑、不反转。
- Nu HTML Checker、axe 和前端单测通过；无障碍人工复核通过。
- 预览可见字节与批准 revision 一致；Adapter 回读差异不被视觉层隐藏。
- 所有业务状态使用文字和图标；红黄绿不是唯一识别方式。
- 定时、动态时间、随机 ID、动画和网络图片不造成截图漂移。
- 任何基线更新均绑定设计变更记录和人工视觉复核，不得仅因 CI 失败而全量覆盖。

## 十五、发布门

Hub UI 进入 production 前必须同时满足：

1. UI-0 至 UI-4 交付完整。
2. 页面路由、角色权限和上位方案一致。
3. 白底、响应式、状态矩阵、Nu、axe、固定截图和人工视觉验收通过。
4. 审批、部分成功、未知结果、Edge 离线和人工接管可用真实后端状态完整演练。
5. 前端资产无远端代码、跟踪像素和未审计第三方依赖；敏感信息扫描通过。
6. 产品、编辑、安全和无障碍四角度共同审核。

未通过时可用于本地编辑和受控内测，但不得将“一键发布”作为对外可用能力。

## 十六、决策与待确认项

| 问题 | 当前决策 | 复审条件 |
|---|---|---|
| Hub 是否保持白底主题 | 是；工作区纯白、导航固定浅灰、卡片用浅色面分组 | 如未来引入深色模式，需新的对比度、截图和 HTML 交付隔离方案 |
| 品牌主色是否已确认 | 否；当前使用无障碍基线色 | 项目方提供正式品牌令牌后版本化替换 |
| 是否复制每个平台 UI | 否 | 仅在官方资料和固定实页回归能持续验证时提升拟真度 |
| 手机是否支持完整长文编辑 | 首版不作硬承诺，优先保证预览、审批查看、结果和人工接管 | 用户研究证明存在高频手机长文编辑需求 |
| UI 是否嵌入 CrabCode 主窗口 | 首版不修改 CrabCode，使用 Hub Web UI | 出现已论证的内嵌硬需求后另立架构与安全方案 |
| 正式 Hub URL 是什么 | 当前未分配/未部署 | 服务器、DNS/TLS、反向代理、OIDC 和安装态验收完成后固化 |

## 十七、`0.1.0` 实施与验收记录

### 17.1 已完成

- 独立插件：`plugins/crabcode-media-publisher/`，未修改 `CrabCode` 仓库，也未启用任何真实发布副作用。
- 本地 Hub：11 个业务/QA 页面（13 个静态路由文档，含兼容别名）、白底系统、HTML/Markdown 本地导入、单一草稿派生 HTML 成品与 MD 备份、真实格式工具、会话草稿状态、平台变体、批次、审批、结果、账号能力、审计、Edge 和敌意状态页。
- 可执行契约：46 个代码设计令牌；侧栏浅灰、工作区纯白、卡片/胶囊无装饰描边，输入/选择/编辑区域保留 3:1 必要边界；五维领域状态及其不可变 presentation/allowed-actions 映射。
- 安全：本地文件仅内存读取、Markdown 原始 HTML 关闭、HTML allowlist 清洗、独立本地/Blob HTML 产物 + opaque sandbox 预览、预览/父页分离 CSP、旧 Blob URL 撤销、Host allowlist、方法限制、无远程 runtime 资产、无浏览器凭据存储、固定 fixture、真实批准与平台提交 fail closed。
- 自动化：25 个 unit/domain/security 测试；Nu 对 15 份实际构建 HTML 零错误；11 路由 axe、opaque iframe 独立 axe、HTML/Markdown 敌意导入、格式工具、键盘/live-region/移动导航、dark-preference 白底、200%/400% 等价 reflow 和 forced-colors 必要边界恢复。
- 视觉：30 张 Chrome `150.0.7871.116` 固定基线，覆盖 1440、820、390、320、高风险状态、专业编辑器、实际嵌入文章 iframe 和 A4 print media；最终禁止更新基线的独立复验为 39/39 通过。

截图基线路径：`plugins/crabcode-media-publisher/tests/browser/snapshots/chrome-150-macos/`。

### 17.2 Figma 交付边界

Figma 文件已创建，并成功写入 4 个变量集合、58 个变量和 10 个 SF Pro 文本样式。当前 Starter/View 席位无法导入 macOS 27 远程库，且在创建 effect styles 时到达 Figma MCP Starter 调用上限；依插件规则停止继续调用。因此 effect styles、组件和 8 个高保真画板尚未写入 Figma，不能声称已完成 Figma 画布交付。用户随后确认的“浅灰导航 + 纯白工作区 + 无装饰描边”代码细化也尚未回写 Figma；续作状态与恢复顺序以仓库内 [figma-state.json](../../plugins/crabcode-media-publisher/docs/design/figma-state.json) 为准。额度刷新或升级后应沿现有 file key 续作，不新建重复文件。

### 17.3 仍阻止 production 的真实残余

- 本轮是固定脱敏 fixture，没有接入 Hub API、OIDC/WebAuthn、审批签名、intent/idempotency、MCP、Edge 配对或平台 Adapter；界面中的发布证据是明确标注的演示数据。
- VoiceOver/NVDA/JAWS 等真人读屏、400% 浏览器原生缩放、A4/Letter 打印 PDF 人工比较尚需在固定验收机签字；现有自动 reflow/axe 与 A4 print-media PNG 不冒充人工/PDF 验收。
- 正式服务器、`acosmi.com` 子域名、TLS、反向代理、数据库、队列与灾备尚未部署；loopback `4197` 只用于 Playwright，默认本地预览仍为 `4173`。
- Figma 高保真页面未因额度限制完成。上述任一项不得通过更新截图或改文案伪造成已满足。
