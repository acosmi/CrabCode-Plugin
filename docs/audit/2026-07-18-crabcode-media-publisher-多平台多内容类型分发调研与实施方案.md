# CrabCode 多平台多内容类型分发调研与实施方案

- 文档日期：2026-07-18
- 调研截止：2026-07-18（平台能力会变化，实施时必须重新探测）
- 文档状态：完整调研与实施方案；`0.1.0` 独立本地 UI fixture 与自动化基线已实施，Gate B 真实服务/账号/发布链路尚未实施
- 目标能力：编辑、预览、审批并向微信公众号、微博、今日头条、百家号、搜狐号、网易号、大鱼号（UC 分发）和简书等渠道分发
- 建议组件名：CrabPublish Hub + CrabPublish Edge（插件名建议为 crabcode-media-publisher）
- 建议实施仓库：`CrabCode-Plugin`，新建 `plugins/crabcode-media-publisher/`；不在 `CrabCode` 主仓库或现有 `plugins/crabcode-media-ops/` 内实施
- 部署决策：内测可本地运行；对外生产版采用“服务器 Hub + 用户本地 Edge”混合部署
- Hub UI 独立方案：[《CrabPublish Hub UI 白底设计系统与验收方案》](./2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md)
- 域名现状：`acosmi.com` 是项目方确认的基础域名，但目前未部署 CrabPublish Hub，也未分配或验证正式 MCP 入口；当前不存在可写入配置的托管 MCP URL
- 与现有版本关系：crabcode-media-ops 0.4.0 继续承担 Gate A 内容生产、核验、原创复核、白底 HTML 交付与冻结；本方案是新的 Gate B 发布层，不应伪装成 0.4.0 的小修补
- 本次仓库动作：新增并修订方案文档，在 `CrabCode-Plugin/plugins/crabcode-media-publisher/` 实现 `0.1.0` 本地 UI fixture、领域状态、设计令牌与自动化验收；未修改 CrabCode 下游仓库，未安装宿主入口、部署 Hub、连接真实账号或启用真实发布副作用

## 一、结论先行

用户指出的问题成立，且会改变此前“按平台接一个发布器”的设计。

微博不能只写成一个 weibo 渠道，至少应拆为：

1. weibo.status：普通微博，承载短文字、图片、话题等。
2. weibo.long_article：微博头条文章/长博文，承载标题、导语、封面和富文本正文。
3. weibo.video：视频微博，素材上传、处理和审核流程与前两者不同，建议第二阶段接入。

今日头条也不能只写成一个 toutiao 渠道，至少应拆为：

1. toutiao.article：头条号后台“图文”入口实际发布的是文章；长图文与文章先按同一内容类型建模。
2. toutiao.micro_post：微头条，属于短内容社交形态，可带图片和话题。
3. toutiao.short_video：小视频/短视频；当前官方 OpenAPI 文档明确覆盖这一类，但需要应用审核、用户 OAuth 和 toutiao.video.create 权限。
4. toutiao.medium_video：中视频；本轮未找到同等明确的公开投稿 OpenAPI，先由真实账号和浏览器 Edge 验证。

本轮没有证据支持把“今日头条图文”再拆成独立于文章和微头条的第四种通用类型。图片是文章或微头条的素材能力，不自动构成一个新发布面。只有真实控制台或官方接口明确出现独立画册/图集能力时，才启用预留的 toutiao.gallery。

技术路线的最终建议是：

> MCP 做受控编排和统一业务接口；官方 API/MCP 做首选连接器；本地浏览器扩展做无公开投稿 API 平台的执行边缘；服务器部署编辑器、审批、任务、审计和对账中心。

这不是“纯 MCP”或“纯浏览器扩展”的二选一：

- MCP 本身只是控制协议，不能凭空获得平台发布权限。
- 微博已经有官方 CLI/Agent 能力，并提供官方 MCP 接入手册，应优先接官方能力。
- 微信公众号优先使用官方接口。
- 本轮未找到今日头条文章/图文和微头条的公开写入 API，二者当前更适合浏览器 Edge；官方公开文档则明确提供小视频 OpenAPI，但权限默认状态存在文档口径差异，必须以真实应用和账号实测为准。
- 百家号、搜狐号、网易号等先逐账号探测官方/合作方能力；没有可靠官方接口时，走本地浏览器 Edge。
- 大鱼号可纳入：官方当前确认文章和视频创作，UC 浏览器是大鱼号“一点生产、多端分发”的下游之一，不应再创建一份 uc.article 重复任务；本轮未找到普通创作者公开写入 API，先走 Edge。
- 简书可纳入：首期只支持 jianshu.article。当前写作入口仍在，但本轮未找到公开开发者写入 API；开源实现只能证明登录态 Web 内部接口可创建/更新草稿，最终发布必须另验。

“一键发布”的准确含义应是“一次查看和批准，创建多个彼此独立、可对账的目标任务”，而不是假装跨平台事务能原子成功。任何一项失败都必须保留其他项的真实结果，不能全部显示成功，也不能自动删除已经发布的内容做伪回滚。

## 二、本轮独立审计与根因

### 2.1 当前能力边界

现有 crabcode-media-ops 已完成 Gate A，但明确没有真实发布能力：

- plugins/crabcode-media-ops/src/tools/capabilities.ts:27 返回 publish: false。
- plugins/crabcode-media-ops/commands/media-publish.md:17 明确说明真实平台发布和浏览器最终点击仍属 Gate B。
- plugins/crabcode-media-ops/src/tools/capabilities.ts:48-49 已把 HTML 设为默认交付、Markdown 设为备份。

现有数据模型也不足以直接承载本方案：

- plugins/crabcode-media-ops/src/platforms/registry.ts:9 只有 article 和 image_note 两种格式。
- 同一文件的平台枚举只有 wechat、xhs、toutiao，没有微博及其他渠道。
- plugins/crabcode-media-ops/src/domain.ts:367 的 AssetSchema 只接受 PNG/JPEG/GIF/WebP，不能承载视频、音频、字幕、转码和封面派生物。
- plugins/crabcode-media-ops/src/domain.ts:452 的 ArticleDocSchema 是长文章模型，不适合直接冒充普通微博、微头条或视频稿。

因此，本方案不能通过在现有 registry 中再加几个字符串完成。那会让普通微博和长博文共用 payload，让文章和微头条共用审批、幂等键和结果语义，最终产生错投、重复投递和假成功。

### 2.2 第一性根因

第一性根因是把五个不同概念混成了“平台”：

1. 平台：微博、今日头条、微信公众号等。
2. 平台账号：同一平台下的具体账号及其权益、登录态和身份指纹。
3. 内容类型/发布面：普通微博、长博文、微头条、文章、视频等。
4. 操作：预填、保存草稿、立即发布、定时发布、群发等。
5. 传输方式：官方 API、官方 MCP/CLI、本地浏览器扩展或人工接力。

正确的最小目标键应是：

> 目标平台账号 + 平台内容类型 + 操作 + 确切的不可变变体版本

不能设计一个通用 send(content, platform)。一个账号可能只有普通微博发布权而没有长博文能力；同一篇头条文章可以修改，但微头条电脑端可能不能修改；视频还会经历上传、转码、审核等异步状态。这些都要求独立能力、字段和状态机。

### 2.3 影响面

若不修正模型，至少会出现以下问题：

- 把长文章正文截断后直接当普通微博发布，用户没有看见真正的短帖变体。
- 发布微博长博文后又额外发一条相同导语的普通微博，造成重复。
- 把同一篇内容同时投为头条文章和微头条，触发平台的跨体裁重复内容限制。
- 视频上传按钮被点击即报告“发布成功”，但平台仍在处理或审核。
- 浏览器页面只是填好内容，却被系统标成“云端草稿已保存”。
- 换账号、换体裁、换发布时间后仍复用旧审批。
- 某一平台成功、另一平台失败时，批次被错误归类为全成功或全失败。
- 平台 UI 变更后脚本点击了错误入口，仍因“脚本没有抛错”被记为成功。

## 三、官方资料核验

### 3.1 微博：普通发布与长博文必须拆开

微博开放平台当前官方 CLI 页面明确写出“发布：图文 / 长博文”，并在“社交内容发布”中列出文字、图文和长博文。页面也把能力定位为可接入 Agent 的运营动作，说明“通过 MCP/CLI 接入微博”已经不是纯浏览器猜测方案。

普通微博还存在官方 REST 文档：statuses/update 用于纯文字微博，statuses/upload 用于上传图片并发布微博，statuses/share 用于分享链接微博。这些接口要求 OAuth access_token、受应用权限和频率约束，且并不等于长博文接口。实现时可在 weibo.status 下同时提供 REST 与官方 MCP 两个候选 transport，按账号实测选择。

官方来源：

- 微博开放平台 CLI 首页：https://open.weibo.com/cli/index
- 微博官方 MCP 使用手册入口：https://open.weibo.com/cli/manual/mcp
- 微博官方 MCP 端点：https://cli.weibo.com/mcp
- 纯文字微博 REST：https://open.weibo.com/wiki/2/statuses/update
- 图片微博 REST：https://open.weibo.com/wiki/2/statuses/upload
- 分享微博 REST：https://open.weibo.com/wiki/2/statuses/share

调研时直接访问官方 MCP 端点会返回缺少令牌的未授权响应，说明它是受认证保护的真实端点，不是匿名公开接口。正式接入仍需要开发者认证、订阅/额度、API Key，以及已登录账号的能力探测。不能仅凭宣传页假定每个账号都支持草稿、定时发布或所有写操作。

建议实现 WeiboOfficialMcpConnector，并在账号连接时执行工具/命令能力发现，保存工具 schema 快照、账号身份指纹、额度、操作范围和验证时间。发布命令名称、字段和权益以认证后 tools/list 或官方 CLI 的 commands list --available 结果为准，不能在代码里永久写死。

微博长文章还有一个容易遗漏的产品语义：官方《微博头条文章使用手册》描述的发布流程是先完成文章，再编辑随文章一同发布的微博内容。也就是说，一次长文章发布可能同时产生“文章”和“承载该文章的微博状态”。虽然该手册较旧，只能用于理解产品语义，不能用来断言 2026 年的字段限制，但它足以说明长文章结果不能被当成单一 status ID。

为避免与字节跳动的“今日头条文章”混淆，产品 UI 建议统一显示“微博长博文（微博头条文章）”；内部 ID 始终使用 weibo.long_article。

官方手册：https://js.t.sinajs.cn/t6/article/publish/dist/js/static/faq.pdf

因此 weibo.long_article 应是一个复合发布意图，至少记录：

- articleId / articleUrl；
- wrapperStatusId / wrapperStatusUrl；
- wrapperText；
- 封面、导语和正文的确切哈希；
- 文章与承载微博的关联关系。

系统不得在长文章成功后再自动创建一条“宣传微博”，除非用户明确选择，且对账证明官方长文章动作没有生成承载微博。否则很容易一键产生两条近似微博。

### 3.2 今日头条：文章、微头条、视频是不同体裁

今日头条官方创作者帮助中心把“图文、音频、合集、微头条、中视频、小视频”列为全体裁创作入口。

“图文创作”页进一步说明：在头条号发布图文时，手动流程是“发布文章”，电脑端入口是“创作 - 图文”，手机端入口是“写文章”。所以产品 UI 的“图文”应映射为 toutiao.article，而不是凭名称再造一个 toutiao.image_text。

“微头条创作”页则把微头条定义为短内容社交形态，并说明 App、头条号后台和网页版都可以发布，可附图片和话题。该页还显示电脑端与手机端的修改能力不同，进一步证明能力需要按内容类型和执行端探测。

官方来源：

- 今日头条创作者帮助中心：https://baike.toutiao.com/
- 图文创作：https://baike.toutiao.com/detail/211/212/214?enter_from=left_navigation
- 微头条创作：https://baike.toutiao.com/detail/211/212/215?enter_from=left_navigation
- 内容创作规则：https://baike.toutiao.com/detail/211/212/570?enter_from=left_navigation

官方 2026-05 更新的内容创作规则还明确表示：不鼓励同一作品在不同体裁重复发布，审核中的作品也不应换体裁重发；只做词语、段落或核心观点的小改动仍会被视为相似作品风险。

这对“一键分发”有直接约束：

- 同一头条账号默认不能同时选择 toutiao.article 与 toutiao.micro_post 发布近似内容。
- 文章转微头条必须产生真正独立的短帖变体，重新预览、原创/事实复核和审批。
- prepare 阶段要对同一账号的已发布、审核中和当前批次内容做跨体裁语义指纹检查。
- 高相似时默认阻断，不用一个普通确认框轻易绕过。
- 文章仍在审核中时，不允许系统自动用微头条重试。

本轮未找到今日头条文章/图文或微头条的公开写入 OpenAPI，但当前抖音开放平台官方文档明确提供“发布视频到头条”的 POST /toutiao/video/create/，范围限定为 300MB、1 分钟以内的小视频/短视频，发布后仍需平台审核。接口要求应用审核、用户 OAuth 和 toutiao.video.create 权限，重复 video_id 不生成新视频，可作为提供方幂等能力的一部分。

需要特别记录官方资料的时间差与口径差异：2023 年官方公告曾宣布旧头条视频投稿与数据接口下线；当前官方文档又重新列出头条小视频发布方案和接口。当前“解决方案”页写审核通过应用默认开放，而最新权限矩阵将头条视频发布列为默认关闭、需在管理中心申请。工程上不能选一份静态文档当永久真相，应采用更严格口径：连接时实时检查 scope，并在 P0 用真实应用完成一次上传、创建、审核和状态回查。

官方来源：

- 当前头条内容发布接入方案：https://open.douyin.com/platform/resource/docs/ability/content-management/toutiao-publish-solution/
- 当前发布视频接口：https://open.douyin.com/platform/resource/docs/openapi/video-management/toutiao/create-video/publish-video/
- 头条账号 OAuth 2.0：https://open.douyin.com/platform/resource/docs/develop/permission/toutiao-or-xigua/OAuth2.0/
- 当前应用类型与权限矩阵：https://open.douyin.com/platform/resource/docs/accession-guide/type-and-permission
- 2023 年旧接口下线公告：https://developer.open-douyin.com/forum/bulletin/post/65437c6341dcfdfb21a9d9ce

准确对外表述应是：“官方公开发布 API 当前明确覆盖今日头条小视频；本轮未找到文章/图文和微头条的公开写入 API，也未找到中视频由该公开 API 投稿的同等明确证据。”不能声称今日头条绝对没有文章接口，因为仍可能存在合作方、内容源同步或白名单能力。

头条官方帮助页提到“内容源同步”，但这是一项需按账号资格验证的平台功能，不等同于可供 CrabCode 任意调用的通用发布 API。实施时应把它作为 capability 候选，而不是默认通道。

### 3.3 大鱼号（UC）：支持文章与视频，但 UC 是下游分发面

大鱼号官方“关于平台”页面把自身定义为阿里集团内的综合型媒体内容生产运营平台，提供“一点生产、多端分发”，并明确把 UC、优酷等列为可能的内容分发业务。准确建模应是用户向大鱼号账号提交作品，平台再按自身规则分发到 UC 等终端；不能默认再创建一个独立 uc.article 任务，否则可能让同一作品重复投稿。

官方服务手册当前分别描述文章和视频的提交、审核、标签与推荐，并在账号权益说明中直接使用“写文章或者发视频”的表述。因此首批平台内容类型建议为：

- dayu.article：大鱼号图文文章；
- dayu.video：大鱼号视频；
- dayu.story_submission：UC 故事会的特殊投稿入口，只在账号出现该权益且用户明确选择时启用，不属于普通文章的默认分发。

本轮在大鱼号官方公开站点中未找到面向普通创作者的 OAuth/REST 写入 API 或公开 MCP。实施建议以 Browser Edge 为主，真实账号先验证文章/视频编辑入口、草稿语义、封面、原创声明、信息来源、定时、审核和作品 URL。官方页面展示的标题长度、发文量等运营建议不能直接硬编码成永久限制，应进入账号级 capability snapshot。

官方来源：

- 关于大鱼号平台：https://mp.dayu.com/about.html
- 大鱼号首页：https://mp.dayu.com/index.html
- 文章/视频推荐和审核语义：https://mp.dayu.com/service-manual?categoryid=2
- 账号权益与“写文章/发视频”：https://mp.dayu.com/service-manual?categoryid=5
- 后台使用与作品发布课程入口：https://mp.dayu.com/edu/tutorials
- UC 故事会投稿说明：https://dayu-h5.uc.cn/contact.html

### 3.4 简书：可做文章草稿同步，公开写入 API 未找到

简书当前仍提供 https://www.jianshu.com/writer 写文章入口。结合开源适配器源码，可以验证登录态网页会使用 notebook/note 和图片上传相关 Web 内部接口创建、更新文章草稿；但这些不是有公开开发者契约、OAuth scope、版本承诺和服务等级的 OpenAPI。

因此简书首期只建 jianshu.article：

- 规范模型为 ArticleDoc；
- 首选通道为 Browser Edge；
- Adapter 可先创建/更新远端草稿，取得 noteId 和写作页 URL 后标为 remote_draft；
- 最终发布按钮、公开 URL、文集/专题选择、付费/版权等字段必须在真实账号中另行验证；
- 不建立未经证实的 jianshu.status 或 jianshu.video。

本轮未找到简书面向普通创作者的公开写入 API 文档。对外只能表述为“支持登录态浏览器草稿同步，正式发布待真实账号验收”，不能把未文档化的 /author/notes 请求包装成“简书官方开放 API”。

官方写作入口：https://www.jianshu.com/writer

## 四、目标平台与内容类型矩阵

以下是产品级初始矩阵。所有数值限制、草稿能力、定时能力和账号权益都必须动态探测，表格不作为永久平台常量。

| 平台内容类型 ID | 用户界面名称 | 规范内容模型 | 首选通道 | MVP | 关键边界 |
|---|---|---|---|---|---|
| wechat.official_article | 微信公众号文章 | ArticleDoc | 官方 API | 是 | 草稿、发布、群发不是同一操作；真实账号回归 |
| weibo.status | 发微博/普通图文微博 | ShortPostDoc / GalleryDoc | 微博官方 REST 或 MCP/CLI | 是 | 文字、图片、话题；按账号发现 OAuth、配额和写权限 |
| weibo.long_article | 头条文章/长博文 | ArticleDoc | 微博官方 MCP/CLI | 是 | 可能同时生成文章与承载微博，记录两个远端对象 |
| weibo.video | 视频微博 | VideoDoc | 官方能力优先，Edge 备选 | 第二阶段 | 上传、处理、审核异步，不能把点击上传当发布 |
| toutiao.article | 图文/文章 | ArticleDoc | Browser Edge；合资格内容源同步备选 | 是 | “图文”按官方帮助映射文章，不额外造 image_text |
| toutiao.micro_post | 微头条 | ShortPostDoc / GalleryDoc | Browser Edge | 是 | 与文章跨体裁消重；电脑端编辑能力受限 |
| toutiao.short_video | 小视频/短视频 | VideoDoc | 当前官方 OpenAPI | 第二阶段 | 仅小视频；应用审核、OAuth、scope 和平台审核；真实调用验权 |
| toutiao.medium_video | 中视频 | VideoDoc | Browser Edge / 合作能力探测 | 后续 | 不用小视频 API 冒充；入口、限制和远端状态独立验证 |
| baijiahao.article | 百家号文章 | ArticleDoc | 官方/合作能力探测，Edge 兜底 | 是 | 先做草稿或预填；真实账号确认最终发布与回执 |
| baijiahao.dynamic | 百家号动态 | ShortPostDoc | Browser Edge | 后续 | 不与文章共用 payload |
| baijiahao.video | 百家号视频 | VideoDoc | Browser Edge/合资格 API | 后续 | 独立上传和审核状态 |
| sohu.article | 搜狐号文章 | ArticleDoc | Browser Edge | 是 | UI 易变，要求回读与作品列表对账 |
| sohu.dynamic | 搜狐号动态 | ShortPostDoc | 按账号探测 | 后续 | 未经实测不标 supported |
| netease.article | 网易号文章 | ArticleDoc | Browser Edge | 是 | 草稿和最终发布语义需实测 |
| netease.video | 网易号视频 | VideoDoc | 按账号探测 | 后续 | 不能由文章适配器兼任 |
| dayu.article | 大鱼号图文文章 | ArticleDoc | Browser Edge | 是 | UC 是平台下游分发面；草稿、原创/来源字段和远端 URL 实测 |
| dayu.video | 大鱼号视频 | VideoDoc | Browser Edge | 第二阶段 | 开源代码只证实预填/上传，不证实最终提交；横竖封面和审核独立 |
| dayu.story_submission | UC 故事会投稿 | ArticleDoc + 专用投稿字段 | Browser Edge / 人工接力 | 后续 | 特殊权益与投稿审核，不并入普通文章 |
| jianshu.article | 简书文章 | ArticleDoc | Browser Edge（登录态 Web 内部草稿接口） | 是 | 只承诺草稿同步；最终发布、文集和公开 URL 真实验收 |
| zhihu.article | 知乎文章 | ArticleDoc | Browser Edge | 第二阶段 | 与回答、想法应是独立类型 |
| zhihu.answer | 知乎回答 | ArticleDoc | Browser Edge | 后续 | 必须绑定问题 ID，不是通用文章 |
| zhihu.pin | 知乎想法 | ShortPostDoc | Browser Edge | 后续 | 短内容独立 schema |
| juejin.article | 掘金文章 | ArticleDoc | Browser Edge | 第二阶段 | 分类、标签、封面等平台字段独立 |
| cnblogs.article | 博客园文章 | ArticleDoc | API/Edge 能力探测 | 第二阶段 | 账号级 API 能力与编辑器格式需核验 |
| wordpress.article | WordPress 文章 | ArticleDoc | 官方 REST API | 可选 | 站点级认证、状态和 taxonomy |

“支持平台”在产品界面中必须显示到内容类型和动作，例如：

- 微博：普通微博“可发布”，长博文“需订阅权益”，视频“未验证”。
- 今日头条：文章“可预填”，微头条“可预填/可发布（按 Edge 实测）”，小视频“需申请 OpenAPI 权限”，中视频“未验证”。
- 大鱼号：文章“可预填/待草稿验收”，视频“实验性”，UC“由大鱼号平台分发、非独立连接”。
- 简书：文章“可保存远端草稿”，最终发布“未验证”。

不能只显示一个绿色的“微博已连接”或“头条已支持”。

## 五、推荐总体架构

~~~mermaid
flowchart LR
  A["crabcode-media-ops Gate A<br/>研究、原创、事实、编辑、HTML/MD、冻结"] --> B["CrabPublish Hub<br/>Web 编辑器、变体、审批、任务、审计、对账"]
  C["CrabCode Agent"] <-->|"业务 MCP"| B
  B --> D["Connector Policy Gateway"]
  D --> E["官方 API<br/>微信公众号等"]
  D --> F["官方 MCP/CLI<br/>微博"]
  D --> G["CrabPublish Edge<br/>本地浏览器扩展"]
  G --> H["已登录创作者后台<br/>头条、百家、搜狐、网易等"]
  B --> I["PostgreSQL / 对象存储<br/>不可变版本、任务与证据"]
~~~

### 5.1 代码仓库与运行位置

本方案的首版实施仓库明确为：

`/Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabcode-media-publisher/`

这是 `CrabCode-Plugin` 官方插件市场仓库下的新插件，与 `crabcode-media-ops` 独立版本、独立权限和独立部署。建议目录为：

~~~text
plugins/crabcode-media-publisher/
├── .crabcode-plugin/plugin.json
├── .mcp.json
├── apps/
│   ├── publisher-app/       # Web 编辑器、REST、业务 MCP、审批和控制台
│   ├── worker/              # 发布、重试、对账和定时任务进程
│   └── edge-extension/      # 用户本地 Chrome/Edge Manifest V3 扩展
├── packages/
│   ├── domain/              # 内容、变体、审批和发布状态模型
│   ├── connector-sdk/       # 平台连接器统一契约
│   ├── connectors/          # 微信、微博、头条等独立连接器
│   ├── policy-gateway/      # 审批、幂等、限流、熔断和审计
│   └── mcp-server/          # CrabCode 只调用这一层业务 MCP
├── migrations/                   # PostgreSQL 迁移
├── deploy/                       # 本地与生产部署配置
└── tests/
~~~

仓库与运行边界如下：

- `plugins/crabcode-media-ops/` 保持 Gate A，只交付冻结的 HTML、MD、ArticleDoc、素材和 manifest，不增加真实发布权限。
- `plugins/crabcode-media-publisher/` 实现 Gate B 的 Hub、Edge、连接器、审批、任务和对账。
- `/Users/fushihua/Desktop/CrabCode` 主仓库首版不修改。已独立核验其 `src/services/mcp/types.ts` 支持 stdio、HTTP/SSE/WebSocket MCP 以及 HTTP MCP OAuth，足以连接本地或托管 Hub。
- `/Users/fushihua/Desktop/crabcode-agent-browser` 只可作为通用浏览器运行时、协议和测试参考；微博、头条、百家号等平台业务 Adapter 必须留在 publisher 插件内，不污染通用浏览器内核。

### 5.2 CrabPublish Hub（服务器）

Hub 建议作为一个受认证的 Web 服务部署，提供：

- Tiptap/ProseMirror 编辑器和白底 HTML 预览；
- Markdown 导入/导出与 ArticleDoc 规范化；
- 普通短帖、长文章、图集、视频四类内容模型；
- 平台变体编辑和逐体裁预览；
- 账号及能力快照管理；
- Gate A 导入、Gate B 审批和一次性发布授权；
- 批次、单项任务、重试、取消、对账和部分成功展示；
- 审计日志、证据截图、远端 ID/URL 和错误分类；
- 对外业务 MCP 服务。

生产建议使用 PostgreSQL 保存权威状态，使用兼容 S3 的对象存储保存已哈希的图片、视频、HTML、Markdown、截图和 trace。MVP 可用数据库任务队列，不引入 Kafka；只有真实吞吐证明需要时再拆消息基础设施。

### 5.3 CrabPublish Edge（用户本地）

Edge 是 Manifest V3 浏览器扩展，运行在用户已经登录的平台浏览器中。它只接收已批准、字段受 schema 约束的任务，在目标页面执行：

- 检查 origin、账号指纹和内容类型入口；
- 填充标题、正文、图片、封面、话题等；
- 反向读取页面中的规范化字段并与批准版本比对；
- 按授权动作只做预填、保存草稿或提交；
- 截取脱敏证据并回传远端 ID、URL 和状态；
- 遇到扫码、短信、验证码或风控时转为 action_required，由用户接管。

浏览器 Cookie、localStorage、密码和短信码不得上传到 Hub、传给模型、进入 MCP 参数或日志。优先使用 Native Messaging；若必须使用 127.0.0.1，则要求随机高熵会话、严格 Host/Origin、CSRF 防护、短时令牌和 DNS rebinding 防护。

### 5.4 Connector Policy Gateway

所有官方 API、官方 MCP 和 Edge 动作都必须经过统一策略网关，不能把微博官方 MCP 的原始写工具直接暴露给模型。网关负责：

- 账号与内容类型能力发现；
- payload schema 校验；
- 审批覆盖与哈希核对；
- 幂等键和副作用登记；
- 速率限制和熔断；
- 错误归类与对账；
- 脱敏审计。

官方微博 API Key 可加密保存在服务端秘密库；浏览器登录态只能留在 Edge。本地 Edge 也不能提供任意 selector、任意 JavaScript 或通用 click 工具给模型。

### 5.5 最小可部署拓扑

首个可用版本建议保持为“模块化单体 + 独立 Edge”，不要一开始拆成大量微服务：

| 部署单元 | 作用 | 网络边界 |
|---|---|---|
| publisher-app | Web 编辑器、REST、业务 MCP、审批、连接器策略和任务 worker | 仅经 TLS 反向代理暴露 Web/API/MCP；OIDC 保护 |
| PostgreSQL | revision、账号元数据、能力、任务、批准、回执、审计 | 仅 publisher-app 私网可达 |
| Object Storage | HTML、MD、图片、视频、截图、trace 和 manifest | 私有 bucket；短时签名 URL；对象哈希校验 |
| Secret Vault/KMS | 官方 API/MCP token、OAuth refresh token | 只向相应官方 connector 解封；审计访问 |
| CrabPublish Edge | 运行在用户浏览器，持有本地登录态并执行网页动作 | 只主动连 Hub；不开放公网入站，不上传 Cookie |

建议路径约定：

- /app：编辑器和批次控制台；
- /api/v1：Web 业务 API；
- /mcp：CrabCode 连接的 Streamable HTTP MCP；
- /edge/v1：设备配对、任务领取、结果/证据回传；
- /health/live 与 /health/ready：存活和依赖就绪；
- /metrics：仅内网监控。

备份必须同时覆盖 PostgreSQL、对象存储 manifest 和 KMS/秘密恢复流程。多进程任务状态不得落在 JSONL；任务领取、lease、幂等和 approval consumption 使用数据库事务完成。MVP worker 可以与 Web 进程同镜像但独立进程启动，真实负载出现后再水平扩展。

### 5.6 本地与托管模式

#### 本地内测模式

P0/P1 能力取证和单用户内测不强制部署公网服务器。`publisher-app`、worker、PostgreSQL 和对象存储可在开发机或专用发布工作站本地运行，Edge 仍安装在拥有平台登录态的浏览器。本地 MCP 只允许绑定 loopback，配置形式为：

`http://127.0.0.1:<实际配置端口>/mcp`

端口必须由安装态配置或运行时分配产生，不得为了文档方便虚构一个可能冲突的固定端口。如官方 OAuth 要求公网 HTTPS 回调，仍需使用项目方实际控制并已备案/配置的回调域名，不能使用示例地址代替。

#### 正式托管模式

对外生产版需要服务器 Hub，用于强身份、团队权限、编辑审批、定时任务、官方 API/OAuth、幂等、审计和对账。但浏览器 Edge 仍必须运行在用户登录设备上，不得为了“纯服务器自动化”而将 Cookie 集中上传。无官方 API 的平台在 Edge 离线时必须显示 `waiting_for_edge`，不得伪报已发布。

项目方已确认基础域名为 `acosmi.com`，但域名只是可供未来分配 DNS 和 TLS 身份的命名空间，不是服务。当前 `acosmi.com` 上没有部署 CrabPublish Hub，也没有已验证的 `/mcp` 路由，因此：

- 当前正式托管 MCP 端点为“未分配/未部署”。
- `https://acosmi.com/mcp` 不是已存在或可用的项目地址，不得写入安装包、`.mcp.json`、默认配置或对外文案。
- 基础域名现阶段的唯一作用是保留项目方可控的未来命名空间；它不提供编辑、发布、存储、认证或 MCP 连接能力。

正式托管 URL 必须在真正决定部署后，再由项目方显式选择“根域名路径”或“专用子域名”：

- 根域名路径方案：只有将 CrabPublish Hub 真实部署到 `acosmi.com` 的入口层，并明确分配 `/mcp` 路由后，才可使用对应 URL。
- 专用子域名方案：必须由项目方另行确认具体主机名，不得由实施人员或代码自行猜测。

无论选择哪种入口，在将最终 URL 写入安装包、`.mcp.json` 或对外文案前，必须完成：

1. 最终主机名的 DNS 与 TLS 证书链验证。
2. 反向代理将最终 MCP 路径精确路由到 CrabPublish Hub，且不与现有上游业务路由冲突。
3. Streamable HTTP MCP 初始化、协议版本、身份认证、超时和重连验收。
4. OIDC/OAuth 发现、回调白名单、发布用户 subject 绑定和未授权拒绝验收。
5. CrabCode 安装态从新插件连接该 URL 的真实回归。

不得自行派生任何 `acosmi.com` 子域名，除非项目方后续明确分配并完成同等验收。不得使用任何与项目无关的示例或第三方域名。上述验收未通过时，托管模式必须保持“未就绪”并 fail closed。

因此首版的完整运行形态是：服务器 Hub 处理可持久、可审计的业务状态；官方 API 连接器在 Hub 运行；浏览器平台由本地 Edge 执行。纯 MCP、纯服务器或纯扩展均不足以独立满足全部需求。

### 5.7 Hub 服务器部署环节

Hub 部署是独立实施环节，不是“代码写完后顺手上传”。实施分为三个环境，上一环境未验收不得晋级：

| 环境 | 用途 | 入口 | 允许的副作用 |
|---|---|---|---|
| local | 开发、单测、编辑器和本地 Edge 联调 | 仅 loopback | 默认只允许 fixture/模拟连接器；真实账号必须单独开关 |
| staging | 安装态、认证、数据库迁移、Edge 配对和专用测试账号回归 | 项目方明确分配的受控 HTTPS 入口 | 只允许白名单测试账号，发布开关默认关闭 |
| production | 对外编辑、审批、任务、官方 API 发布和 Edge 调度 | 通过完整验收的正式 HTTPS 入口 | 只对通过平台/体裁真实回归的 connector 逐项开放 |

首发用一个可版本化的 `publisher-app` 镜像和同镜像独立 worker 进程，不拆微服务。`deploy/` 至少交付：

- 本地 Docker Compose 和生产部署模板；
- PostgreSQL 迁移、向前/向后兼容策略与迁移前备份；
- 对象存储 bucket、对象保留、哈希校验和恢复流程；
- OIDC/OAuth、Secret Vault/KMS、最小权限服务账号和密钥轮换；
- TLS 反向代理、Host/Origin 白名单、CSRF、CORS、限流和请求大小限制；
- `/health/live`、`/health/ready`、结构化脱敏日志、metrics 和审计告警；
- 经签名的镜像、SBOM、依赖/容器扫描、发布 manifest 和版本回执；
- 灰度发布、数据库兼容门、应用回滚和备份恢复演练。

部署门要求：新版必须先通过 migration dry-run、空库启动、旧版数据升级、就绪检查、MCP 握手、Edge 重连、备份恢复和回滚演练。部署成功不等于发布权限自动开放；每个平台内容类型仍由独立 feature flag 和 capability evidence 控制。

## 六、内容、变体与发布意图模型

### 6.1 作品到发布的四层模型

1. ContentWork：逻辑作品，不绑定平台。
2. ContentRevision：不可变的内容事实源。
3. PlatformVariantRevision：面向某个平台内容类型的可见变体。
4. PublicationIntent：绑定具体账号、操作和时间的可批准发布意图。

建议判别式内容模型：

~~~ts
type CanonicalDoc =
  | ArticleDocV2
  | ShortPostDocV1
  | GalleryDocV1
  | VideoDocV1

type PlatformContentType =
  | 'wechat.official_article'
  | 'weibo.status'
  | 'weibo.long_article'
  | 'weibo.video'
  | 'toutiao.article'
  | 'toutiao.micro_post'
  | 'toutiao.short_video'
  | 'toutiao.medium_video'
  | 'dayu.article'
  | 'dayu.video'
  | 'dayu.story_submission'
  | 'jianshu.article'
  | 'baijiahao.article'
  | 'sohu.article'
  | 'netease.article'
  | string

type PublicationOperation =
  | 'fill_only'
  | 'save_draft'
  | 'publish_now'
  | 'schedule'
  | 'mass_send'
~~~

普通微博与微头条使用 ShortPostDoc，至少有 text、topics、orderedAttachmentIds 和 disclosures。长文章使用 ArticleDoc，至少有 title、summary/lead、richTextBody、citations、cover、inline assets 和 disclosures。VideoDoc 必须有真实 videoAssetId、coverAssetId、description、字幕/转录信息，不能把一篇文章文本直接当成“视频已就绪”。

### 6.2 素材与派生物

MediaAsset 应支持 image、video、audio、subtitle、document，并保存 SHA-256、字节数、媒体类型、权利状态和探测报告。视频还要保存容器、编解码器、时长、尺寸、帧率和码率。

平台转码、缩略图、封面和字幕作为 AssetRendition 单独登记。任何改变用户可见/可听内容的转码、剪辑、封面或字幕变化都使审批失效；仅把已批准字节上传后替换成平台 remoteMediaId，不必重新审批，但要保存 asset hash 到 remoteMediaId 的证明映射。

### 6.3 平台变体

PlatformVariantRevision 至少保存：

- sourceRevisionId / sourceDocHash；
- platformContentTypeId；
- variantDoc / variantHash；
- assetManifestHash；
- transformSpecId、版本和哈希；
- adapterId、版本和平台规则版本；
- validationReportHash 与 previewArtifactHash；
- editing、reviewed、frozen、superseded 状态。

任何标题改写、摘要改写、正文删改、图注变化或文章转短帖都必须在提交前成为新变体并重新走 Gate A。Adapter 的 submit 阶段只能做确定性机械转换，禁止临时调用模型改写正文。

### 6.4 发布意图与审批哈希

PublicationIntent 绑定：

- 确切 variant revision/hash；
- 目标账号稳定 ID 和账号指纹；
- 平台内容类型；
- 操作、定时时间和时区；
- 可见性、分类、标签、话题、封面；
- 原创声明、AI/商业披露、评论设置；
- adapter/version、capabilityPolicyHash、platformRuleVersion；
- logicalPayloadHash、assetManifestHash、previewHash 和 validationHash。

跨进程哈希建议采用 RFC 8785 JSON Canonicalization Scheme + SHA-256：https://www.rfc-editor.org/rfc/rfc8785.html

改正文、换账号、普通微博改长博文、草稿改正式发布、改变计划时间或声明，均使原审批失效。只刷新 capability 的观察时间而规则哈希不变时，不应无意义地强制重批。

## 七、编辑器、HTML 主交付与 Markdown 备份

### 7.1 统一事实源

编辑器使用 Tiptap/ProseMirror 结构化 JSON 作为交互事实源，导入 crabcode-media-ops 冻结的 ArticleDoc。不得分别手工维护 HTML 和 Markdown；两者必须从同一不可变 revision 确定性生成。

默认用户交付：

- article.html：主交付与默认预览。
- article.md：同 revision 的备份与可移植源文件。
- platform-variants/：各平台内容类型的精确变体、预览和字段清单。
- manifest.json：内容、素材、渲染器、变体、审批和 QA 哈希。

### 7.2 白底精排要求

Hub 默认预览和下载的 HTML 必须：

- html、body、主文章容器和卡片基础表面统一显式使用 #FFFFFF；系统深色模式也不得自动变黑。
- 使用单一 H1，并按 H2-H4 组织标题层级。
- 使用 article、header、main、section、figure、figcaption、time、cite、footer 等合适语义。
- 正文宽度、字号、行高、段间距、列表、引用、表格、图片和图注在桌面与移动端均清晰。
- 使用系统字体，不加载远程字体、脚本、跟踪像素或远程 CSS。
- 对用户输入 HTML 做 allowlist 清洗，禁止 script、事件属性、危险 URL 和任意 iframe。
- 提供 A4/Letter 打印样式，避免标题孤行、图片溢出和表格横向截断。
- 通过 Nu HTML Checker、axe 自动检查、固定 Chromium 多视口截图和人工视觉复核。

平台预览不能只展示一个“通用 HTML”：

- weibo.status 显示短文、话题、图片顺序和字符/素材规则。
- weibo.long_article 显示文章正文、封面、导语和承载微博 wrapperText。
- toutiao.article 显示文章标题、正文、封面、分类和声明。
- toutiao.micro_post 显示短文、图片和话题，并显示与头条文章的相似度风险。
- dayu.article 显示标题、正文、封面、信息来源、原创声明和预期的 UC 等下游分发说明。
- dayu.video 显示视频、横版/竖版封面、标题、描述、标签、信息来源和审核状态。
- jianshu.article 显示标题、正文图、文集/笔记本、草稿 URL，并明确最终发布是否尚需人工操作。
- video 显示实际视频、封面、标题、字幕和转码规格。

### 7.3 编辑与审批关系

用户在平台预览中做任何可见修改时，系统创建新 variant revision，旧预览、旧批准和旧幂等键全部变 stale。不能在浏览器页面里临时手工改完后继续沿用旧审批；若用户在平台页面接管并修改，Edge 必须回读差异并要求重新导入/审批，或将动作降级为纯人工且不宣称系统批准了最终字节。

### 7.4 Hub UI 独立方案索引

Hub 控制台的信息架构、页面路由、白底视觉令牌、组件、编辑器排版、交互状态、响应式、无障碍、安全和固定截图验收统一收口到：

> [《CrabPublish Hub UI 白底设计系统与验收方案》](./2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md)

文档边界：

- 本总方案是架构、权限、数据、连接器、部署和发布门的真源。
- UI 独立方案是 Hub 信息架构、视觉、组件、交互和视觉验收的真源。
- UI 不得降级本总方案的强身份、审批哈希、幂等、状态语义、证据、Cookie 本地化或 fail-closed 约束；冲突时安全与发布约束优先。
- Hub 采用白底主题：工作区、编辑、预览与弹窗主面为纯白，导航固定浅灰，卡片/胶囊以浅色面和留白分组；具体令牌与例外以 UI 独立方案为准。
- UI 设计冻结与固定截图验收是 P1-B 的必要交付，不是发布前可选的视觉润色。

## 八、账号级能力发现

每个账号保存 CapabilitySnapshot，不按平台全局硬编码：

~~~ts
interface ContentTypeCapability {
  accountId: string
  accountFingerprint: string
  platformContentTypeId: string
  operations: Record<PublicationOperation,
    'supported' | 'unsupported' | 'unverified' |
    'requires_entitlement' | 'temporarily_disabled'>
  transports: Array<'official_api' | 'official_mcp' |
    'browser_edge' | 'manual'>
  requiresUserPresence: boolean
  supportsProviderIdempotency: boolean
  supportsStatusQuery: boolean
  draftSemantics: 'remote_draft' | 'prepared_local' | 'none' | 'unverified'
  fieldRules: object
  mediaRules: object
  evidenceUrl?: string
  checkedAt: string
  expiresAt: string
  capabilityPolicyHash: string
}
~~~

重要语义：只有平台返回真实 draft ID/URL 时才叫 remote_draft。浏览器标签页只是填好内容但没有云端草稿记录，只能叫 prepared_local；关闭标签页可能丢失，UI 必须明确警告。

能力发现触发点：连接账号、过期、平台错误提示规则变化、适配器升级、每日 canary。规则变化导致 capabilityPolicyHash 改变时，所有受影响的 prepared intent 必须重新验证。

## 九、Adapter 契约

Adapter 不应只有 publish()：

~~~ts
interface PublisherAdapter {
  descriptor(): AdapterDescriptor
  discoverCapabilities(account: AccountRef): Promise<CapabilitySnapshot>
  verifyAccount(account: AccountRef): Promise<AccountFingerprint>
  validate(intent: PublicationIntent, capability: CapabilitySnapshot): Promise<ValidationReport>
  compile(intent: PublicationIntent): Promise<CompiledPayload>
  renderPreview(payload: CompiledPayload): Promise<PreviewEvidence>
  uploadAssets(payload: CompiledPayload, ctx: AttemptContext): Promise<RemoteAssetBindings>
  upsertDraft?(payload: CompiledPayload, bindings: RemoteAssetBindings, ctx: AttemptContext): Promise<RemoteRef>
  submit(payload: CompiledPayload, bindings: RemoteAssetBindings, approval: Authorization, ctx: AttemptContext): Promise<SubmitResult>
  reconcile(remote: RemoteRef | Fingerprint, ctx: AttemptContext): Promise<ObservedState>
  cancel?(remote: RemoteRef, ctx: AttemptContext): Promise<CancelResult>
}
~~~

统一结果必须区分：

- ok；
- action_required（扫码、登录、短信、验证码、账号确认）；
- retryable_error；
- permanent_error；
- ambiguous（外部副作用可能已发生，必须先 reconcile）。

浏览器 Adapter 在发生副作用前必须重新验证页面 origin、账号指纹、内容类型和批准哈希；填充后反向读取标题、正文和素材数量进行比对。按钮点击不是成功证据。published 至少需要远端 content ID/URL、作品列表可核验记录或平台状态查询证据。

## 十、MCP 业务接口

对 CrabCode 暴露的是高层业务工具，不是 token、Cookie、selector 或任意浏览器控制：

- publisher.accounts.list
- publisher.accounts.connect
- publisher.capabilities.get
- publisher.works.import
- publisher.variants.prepare
- publisher.variants.get
- publisher.batches.create
- publisher.batches.prepare
- publisher.batches.request_approval
- publisher.batches.submit
- publisher.batches.get
- publisher.items.reconcile
- publisher.items.retry
- publisher.actions.resume
- publisher.batches.cancel

submit 不接受自由正文或 confirmed: true。它只接受 batchId、approvalId、expected binding hash 和幂等键；服务端从冻结对象取真正 payload。

发布是长任务。若宿主完整支持 MCP 2025-11-25 的实验性 Tasks，可用 task handle 表示；否则立即返回 publicationJobId，并通过 get/reconcile 查询。不能把实验性 Tasks 作为首发硬依赖。

MCP Tasks 规范：https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks

## 十一、一键发布、状态机与幂等

### 11.1 批次模型

一个 PublicationBatch 可以包含多个作品、账号和体裁，但每个 PublicationItem 都是独立最小单元：

> 某个不可变变体，向某个确定账号，执行某个确定动作。

批次 phase 与 outcome 分开：

- phase：composing、preparing、awaiting_approval、dispatching、reconciling、terminal。
- outcome：none、succeeded、partial、failed、cancelled。

某项 published、某项 rejected、某项 needs_login 时，批次应是 terminal/partial，三项均可见。不能静默删掉失败目标后发布其余目标；如果用户选择“只发已就绪项”，必须生成新的批次 revision 和目标集合哈希并重新确认。

### 11.2 单项状态

建议同时保存操作状态与远端状态：

~~~text
queued → validating → transformed → uploading
  → prepared_local | remote_draft
  → awaiting_confirmation → submitting → reconciling
  → submitted → under_review → published

旁路：action_required / retry_wait / rejected / failed / cancelled / unknown
~~~

submitted 和 under_review 都不等于 published。取消只能停止尚未发生外部副作用的 item；已提交或已发布内容不能显示为“已回滚”。

### 11.3 幂等与未知结果

幂等键至少绑定 tenant、batch、item、operation 和 intentHash。第一次 dispatch 要原子登记 approval consumption；技术重试只能沿用同一意图和幂等键。

若平台已成功但本地断网，状态必须变为 ambiguous/unknown，先通过远端 ID、内容指纹、作品列表和时间窗口对账，不能直接再次提交。不要为补偿另一个平台失败而自动删除已经成功的平台内容。

同一平台账号、内容类型、意图哈希和失败阶段若连续三次得到同一失败，应自动熔断为 blocked，保存三次真实证据、根因假设和恢复条件后停止；不得无限重试触发平台风控。只有能力/登录态/适配器版本等阻塞条件发生可证明变化后，才允许新一轮尝试。

微博长文章的幂等判断必须同时检查 article 和 wrapper status；头条必须跨 article/micro_post 检查同一账号的语义指纹与审核中作品。

## 十二、安全与合规加固

### 12.1 身份与批准

- Hub 使用 OIDC/OAuth 或等价强身份，发布批准绑定不可伪造的用户 subject 和认证强度。
- 一次性授权回执绑定 batch revision、全部 target intent hashes、账号指纹、体裁、动作、过期时间和 jti。
- 请求者、批准者和执行者按部署政策隔离；自由填写姓名不是身份认证。
- 变体、目标账号、动作、素材或规则发生变化时回执立即失效。

### 12.2 秘密和浏览器权限

- 官方 token/key 只保存在加密秘密库，不进入正文、MCP 参数、截图或普通日志。
- Cookie、localStorage、扫码和短信码只留在本地浏览器信任域。
- 扩展使用按平台精确 host_permissions，禁止默认 all_urls。
- 禁止远程加载代码、任意 eval、任意 selector 和第三方云任务转发。
- 账号工作建议使用独立浏览器 profile，降低个人浏览数据暴露。

### 12.3 Edge 通信

- 优先 Native Messaging；远程任务由 Edge 主动建立受认证的出站连接。
- 若采用 loopback HTTP，必须校验 Host/Origin、使用 CSRF token、短 TTL、单次 nonce、严格 Content-Type，并防 DNS rebinding。
- 设备注册使用独立设备密钥，可吊销、轮换，并把任务绑定到 deviceId 与 account fingerprint。
- 所有 evidence 先脱敏；禁止截取 Cookie、密码、手机号、私信列表和无关页面区域。

### 12.4 平台风控

- 不绕过 CAPTCHA、短信、扫码、人脸或其他风控。
- 遇到平台限制时 fail closed 并转 action_required。
- 自动评论、批量私信、抢热点和高频发布不在首期范围。
- 正式发布必须遵守各平台服务条款、账号资质、广告/AI/原创声明和频率限制。

## 十三、开源项目深度核验与取舍

开源项目只用一手仓库和实际源码判断；README 声称“支持”不等于真实账号在 2026-07 可用。

本轮源码核验固定到以下提交，避免 main 分支随后变化导致证据漂移：MultiPost Extension 0f8dabc0ee773b420661c649200b1dd854211a10、Wechatsync a98e42865387285afcc027c61836488748f3b30f、COSE e70fa9e92a71cd2f10e0c883981f324a332162d4。

| 项目 | 许可证/边界 | 源码核验到的能力 | 可借鉴 | 不应直接照搬 |
|---|---|---|---|---|
| MultiPost Extension | Apache-2.0 | 分开实现 Dynamic、Article、Video；含普通微博、微博长文章、头条文章、微头条和头条视频适配器 | 内容类型 × 平台 Adapter 拆分、路由和素材处理 | all HTTPS 权限、固定等待/selector、isAutoPublish 布尔值、缺少统一回执和对账；部分代码自动勾原创，严禁照搬 |
| Wechatsync v2 | GPL-3.0；部分头条适配器在私有子模块 | 公开微博适配器只做长文章草稿；公开 MCP 只有 syncArticle，没有普通微博/微头条/视频 | 文章草稿、图片上传、适配器概念 | 不作为发布内核；GPL 义务、宽权限、私有适配器和远程 WebSocket 边界需法务/安全复核 |
| COSE | Apache-2.0 | 微博只填长文章草稿；头条只预填 /graphic/publish，未核验草稿或最终发布 | 富文本填充、轻量扩展结构 | 不能把“已打开并填充”报告为发布成功；权限过宽、缺少图片/封面和动态/视频 |
| Tiptap | MIT | ProseMirror 上的结构化富文本编辑器 | Hub 编辑器核心、扩展 schema、HTML/JSON 转换 | 平台清洗、审批和发布仍需自建 |
| doocs/md | WTFPL，分发前需法务确认 | 微信风格 Markdown 编辑与排版 | 白底排版、模板体验、Markdown 预览思路 | 不作为发布安全边界；许可证与第三方素材单独复核 |
| WxJava | Apache-2.0 | 微信 Java SDK | 微信官方 API 语义、错误处理和 token 管理参考 | 只覆盖微信，不解决浏览器平台和审批体系 |
| Postiz | AGPL-3.0 | 社媒调度、队列和多账号产品架构 | 任务、日历、调度、部分成功产品体验 | 不嵌入闭源分发内核；中国平台覆盖不是本方案证据 |
| Mixpost Lite | MIT，Pro 功能另有边界 | workspace、日历、团队发布体验 | Hub 工作区和日历信息架构 | 需核验 Lite/Pro 边界，不能借 README 推断平台能力 |
| Playwright MCP | Apache-2.0 | 浏览器自动化与 MCP 参考 | 固定浏览器测试、截图、故障复现和受控 fallback | 不作为生产账号的通用“万能点击器” |

### 13.1 用户关心体裁的源码覆盖

| 项目 | 普通微博 | 微博长博文 | 头条文章/图文 | 微头条 | 头条视频 | 结论 |
|---|---|---|---|---|---|---|
| Wechatsync v2 | 无 | 只保存长文章草稿 | 当前公开实现位于私有子模块，无法核验 | 无 | 无 | 本质仍是 Article 型同步器 |
| COSE | 无 | 长文章草稿预填/保存 | 只打开并预填，不等于草稿或发布成功 | 无 | 无 | 适合参考编辑器到浏览器的预填 |
| MultiPost Extension | 有，DOM 填充并可点发送 | 有，但源码主要创建草稿 | 有，可到预览/发布入口 | 有，可填图文并点发布 | 有浏览器 Adapter | 覆盖最全，但仍需重做权限、确认、回执和对账 |

三个项目都没有证据支持今日头条存在独立于“文章/图文”和“微头条带图”的第四种通用 image_text 类型。MultiPost 的长图文走 Article，短图文走 Dynamic/微头条；这与本方案的平台内容类型拆分一致。

### 13.2 大鱼号与简书的开源源码实证

MultiPost Extension 当前提交对两者都有代码，但成熟度差异很大：

- 大鱼号文章 Adapter 被源码明确标为 experimental，路由观察值为 https://mp.dayu.com/dashboard/article/write。它尝试写入标题和 iframe 富文本，并在 isAutoPublish 时点击按钮；没有封面/声明完整性、远端 ID、作品列表回查或最终公开 URL，不能据此标为“已发布并核验”。
- 大鱼号视频 Adapter 的路由观察值为 https://mp.dayu.com/dashboard/video/write。它尝试填写标题/描述、上传视频、横竖封面、标签和信息来源，但当前主流程没有执行最终发布按钮，却在末尾打印“发布流程完成”。这是本方案必须修正的典型假成功，最多只能标为 content_filled/media_uploaded。
- 简书 Adapter 通过登录态 Web 内部接口读取 /author/notebooks，POST /author/notes 创建文章，PUT /author/notes/{noteId} 更新正文并返回写作页 URL。它产生的是草稿，不执行最终发布；图片上传还依赖简书返回 token 后直传存储服务。这可作为 remote_draft 参考，但不是公开 API 稳定性承诺。

固定源码证据：

- MultiPost 大鱼号文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/dayuhao.ts
- MultiPost 大鱼号视频：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/video/dayu.ts
- MultiPost 简书文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/jianshu.ts
- MultiPost 文章路由表：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article.ts
- MultiPost 视频路由表：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/video.ts

Wechatsync v2 README 声称支持简书和大鱼号，且称简书支持 Markdown；但本轮公开仓库的相应平台实现不在可审计的公共 Adapter 集合中，不能从 README 升格为已验证能力。它只能作为候选产品证据，不能成为 CrabPublish 上线验收证据。

主要源码证据：

- MultiPost Extension：https://github.com/leaperone/MultiPost-Extension/tree/0f8dabc0ee773b420661c649200b1dd854211a10
- MultiPost 普通微博：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/dynamic/weibo.ts
- MultiPost 微博长文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/weibo.ts
- MultiPost 头条文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/toutiao.ts
- MultiPost 微头条：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/dynamic/toutiao.ts
- MultiPost 头条视频：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/video/toutiaohao.ts
- Wechatsync v2：https://github.com/wechatsync/Wechatsync/tree/a98e42865387285afcc027c61836488748f3b30f
- Wechatsync 微博适配器：https://github.com/wechatsync/Wechatsync/blob/a98e42865387285afcc027c61836488748f3b30f/packages/core/src/adapters/platforms/weibo.ts
- COSE：https://github.com/doocs/cose/tree/e70fa9e92a71cd2f10e0c883981f324a332162d4
- Tiptap：https://github.com/ueberdosis/tiptap
- doocs/md：https://github.com/doocs/md
- WxJava：https://github.com/Wechat-Group/WxJava
- Postiz：https://github.com/gitroomhq/postiz-app
- Mixpost：https://github.com/inovector/mixpost
- Playwright MCP：https://github.com/microsoft/playwright-mcp

### 13.3 最终开源选型

1. 编辑器：Tiptap/ProseMirror。
2. 浏览器 Adapter 主要 clean-room 参考：MultiPost Extension，保留 Apache-2.0 NOTICE，不复制其宽权限和成功语义。
3. 微信官方连接器：官方接口；如使用 Java 技术栈可参考 WxJava，否则按官方 schema 自建薄适配器。
4. 微博：优先官方 MCP/CLI，不以开源 DOM 脚本替代可用的官方通道。
5. 头条等浏览器平台：自建 Edge，吸收 MultiPost 的体裁拆分，但重新实现最小权限、回读、回执、幂等和对账。
6. 调度/日历：参考 Postiz/Mixpost 的产品结构，不直接嵌入 AGPL 内核。

## 十四、实施范围与阶段

### P0：真实能力证据（先做，未完成不得承诺一键发布）

- 准备专用测试账号，不使用个人主账号做自动化首测。
- 微博：完成开发者认证/订阅，连接官方 MCP/CLI，保存 tools/list 或 commands list --available 的 schema 快照。
- 微博：分别验证普通文字微博、图文微博、长博文；确认长博文返回的 article 与 wrapper status 关系。
- 头条文章/微头条/中视频：在真实账号确认入口、字段、草稿/预填语义、手机号验证和作品状态页。
- 头条小视频：创建并审核开放平台应用，申请/核对 toutiao.video.create，完成 OAuth、视频上传、创建、审核状态和最终 URL 的真实闭环；记录“解决方案页”与“权限矩阵”的口径差异。
- 百家号、搜狐号、网易号：逐账号记录真实入口、草稿、最终确认和远端 ID/URL 能力。
- 大鱼号：验证 article/video 两个入口、草稿/提交/审核/发布状态、原创与信息来源字段、横竖封面，以及平台向 UC 分发的结果语义；故事会作为独立资格探测。
- 简书：验证登录态创建/更新草稿、noteId/写作 URL、图片上传、文集/笔记本和最终发布/公开 URL；确认 Web 内部接口变化时的降级方式。
- 完成平台服务条款、自动化、账号共享和内容源同步资格审查。
- 建立 capability evidence 文档，任何未验证能力在 UI 中显示 unverified。

交付：能力矩阵、官方 schema 快照、固定浏览器截图、测试账号回归记录和风险接受记录。

### P1-A：Hub 领域、编辑器和不可变模型

- 在 `CrabCode-Plugin/plugins/crabcode-media-publisher/` 新建 crabcode-media-publisher，不改写 media-ops 0.4 的 Gate A 语义，不修改 CrabCode 主仓库。
- 实现 Work/Revision/Variant/Intent、媒体资产、账号和能力快照。
- 实现 Tiptap 编辑器、白底 HTML 主交付、MD 备份、平台预览和 diff。
- 实现 PostgreSQL 权威存储、对象存储、审计链、数据库任务队列。
- 实现 OIDC、角色、一次性发布授权和审批失效规则。
- 实现 MCP 只读/准备工具；提交工具先保持 feature flag 关闭。

### P1-B：Hub UI 设计冻结与服务器部署基线

- 完成 [《CrabPublish Hub UI 白底设计系统与验收方案》](./2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md) 的信息架构、线框、视觉令牌、组件状态和高保真页面冻结。
- 实现“纯白工作区 + 浅灰导航/分组面”的 Hub 布局，以及结构化编辑器、平台变体、预览/diff、审批、任务、账号能力和证据页面。
- 交付 local Docker Compose、可签名镜像、数据库迁移、对象存储、秘密管理、健康检查和可观测基线。
- 建立 local → staging → production 晋级门；当前没有正式托管端点，在项目方分配入口之前只验收 local，不伪造 URL。
- 完成空库/旧库迁移、备份恢复、应用回滚、MCP 握手、Edge 离线/重连和未授权拒绝验收。
- 所有真实发布 connector 继续保持 feature flag 关闭；部署完成不等于发布权限开放。

### P2：首批连接器与草稿/预填闭环

- 微信公众号官方草稿连接器。
- 微博官方 REST/MCP：weibo.status；官方 MCP：weibo.long_article。
- Edge：toutiao.article 与 toutiao.micro_post。
- 官方 OpenAPI 连接器骨架：toutiao.short_video；在 P0 scope 与真实发布闭环未通过前保持 feature flag 关闭。
- 实现 prepared_local 与 remote_draft 区分、回读、截图和账号指纹校验。
- 实现头条同账号跨体裁语义消重。
- 一键操作先默认“保存草稿/准备本地页面”，验证稳定后再开放最终提交。

### P3：最终提交与第二批文章平台

- 对通过真实账号回归的连接器逐个启用 publish_now，默认仍需一次强身份批准。
- 接入 baijiahao.article、sohu.article、netease.article、dayu.article、jianshu.article。
- 实现部分成功、unknown 对账、熔断、selector canary 和恢复流程。
- 支持定时任务，但平台原生定时与 Hub 延时提交必须在 UI 中区分。

### P4：视频与扩展体裁

- weibo.video、通过 P0 后的 toutiao.short_video、真实账号确认后的 toutiao.medium_video，以及 dayu.video。
- 视频断点续传、转码、处理/审核对账、封面和字幕版本管理。
- 逐步增加知乎文章/回答/想法、掘金、博客园及其他平台。

## 十五、测试与验收

### 15.1 通用验收

- 同 batch/item 连续双击 submit 只产生一个外部发布意图。
- 外部成功、本地断网时进入 unknown 并先对账，不二次发布。
- 更换账号、体裁、动作、时间、正文、封面或视频字节会使审批失效。
- 某项成功、某项被拒、某项需登录时，批次显示 partial 且每项证据完整。
- submitted/under_review 不得显示 published。
- 浏览器 origin、账号指纹、内容类型和字段回读任一不符即 fail closed。
- CAPTCHA/SMS/扫码变 action_required，不尝试绕过。
- 扩展无 all_urls、无远程代码、无 Cookie 上传、无任意脚本/selector 工具。
- 日志、截图和 trace 通过敏感信息扫描。

### 15.2 微博专项

- 普通文字微博与多图微博分别通过实际选定的官方 REST 或 MCP/CLI 通道做真实账号回归。
- 长博文标题、导语、封面、正文图和 wrapperText 均与批准预览一致。
- 长博文发布后准确记录 articleId 和 wrapperStatusId；系统不额外重复发宣传微博。
- 官方 MCP 额度不足、权限不足、token 过期和工具 schema 变化均有明确状态。
- 同一幂等键在断网/重试场景不产生第二条微博或第二篇文章。

### 15.3 今日头条专项

- toutiao.article、toutiao.micro_post、toutiao.short_video、toutiao.medium_video 在模型、入口、字段和状态上完全分离。
- “图文”映射文章；图片附着于文章或微头条，不出现未经证实的第四种 image_text 类型。
- 同一头条账号对相似 article/micro_post 的同批或历史重复 prepare 默认阻断。
- 文章审核中时，不允许自动改投微头条。
- 小视频 OpenAPI 必须验证应用审核、用户 OAuth、toutiao.video.create scope、重复 video_id 幂等、审核中仅自己可见和最终公开状态；中视频不得复用小视频的 supported 结论。
- 浏览器只填好但平台未保存时必须显示 prepared_local，关闭页面风险可见。
- 手机号验证、修改次数/端差异和平台 UI 更新会触发能力刷新或 action_required。

### 15.4 大鱼号与简书专项

- dayu.article 与 dayu.video 使用独立 schema、入口、素材规则和审核状态；UC 仅记录为平台下游分发结果，不额外重复提交同一作品。
- dayu.story_submission 只有账号能力快照明确支持、用户选择且特殊投稿字段齐全时才可启用。
- 大鱼号 Adapter 未取得远端作品 ID/URL 或作品管理页证据时，不得把“填充完成”“媒体上传完成”显示为 published。
- 大鱼号原创声明、信息来源和活动/定时选项均由已批准 intent 显式绑定，禁止照开源脚本默认勾选“原创”或“无需标注”。
- jianshu.article 创建草稿后必须记录 noteId、notebookId、写作 URL 和正文回读；这只证明 remote_draft。
- 简书最终发布必须取得公开文章 URL 或作品列表证据；若只创建/更新 /author/notes，则状态不得越过 remote_draft。
- 简书 Web 内部接口、图片 token 或登录态失效时转 action_required/temporarily_disabled，不把内部接口称为稳定官方 OpenAPI。

### 15.5 HTML 与编辑器专项

- article.html 为默认用户入口，article.md 为同 revision 备份。
- HTML/MD/ArticleDoc 可见文本、链接、图片、图注、来源和披露对等。
- html/body/article 在浅色和系统深色偏好下都保持 #FFFFFF 白底。
- Nu、axe、固定 Chromium 桌面/移动/打印截图和人工视觉复核全部绑定产物哈希。
- 平台变体预览与 Adapter 回读值一致；浏览器页面修改会使审批 stale。

### 15.6 真实发布证据

每个平台/体裁上线前必须保存：

- 固定浏览器和扩展版本；
- 测试账号指纹和权限快照；
- 准备、提交、审核、发布或拒绝全过程截图；
- 远端 draft/content/job ID 和 URL（如平台提供）；
- 请求/响应或 UI 回读的脱敏哈希证据；
- 重试、断网、验证码、账号切换和 selector 变化负例；
- verifiedAt、适配器版本和熔断开关。

Mock、README、按钮点击或本地 success 返回均不能代替真实账号证据。

### 15.7 Hub 部署专项

- Hub UI 的页面、白底、响应式、状态、键盘、无障碍和固定截图验收以 [《CrabPublish Hub UI 白底设计系统与验收方案》](./2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md) 为唯一详细验收真源，其未通过时不得进入 production。
- 新环境从空库可一键创建并通过 `/health/live` 与 `/health/ready`；重复执行数据库迁移幂等。
- 从上一发布版本升级、应用回滚和备份恢复演练都不丢失 revision、approval、job、receipt 和 audit 链。
- 日志、metrics、trace、截图和部署产物不含 token、Cookie、密码、手机号或未脱敏正文；Secret Vault/KMS 不可用普通环境变量文件替代。
- 未分配正式入口时，production 部署步骤必须 fail closed；不会回落到根域名、猜测子域名或无关示例地址。

## 十六、发布门槛与版本建议

建议把本能力作为独立组件 crabcode-media-publisher 0.1.0 内测，而不是把它塞进已经定义完成的 media-ops 0.4.0：

- media-ops 0.4.0：研究、写作、原创/事实/法律核验、HTML/MD、冻结与 Gate A 审批。
- media-publisher 0.1.0：Hub、Edge、账号能力、Gate B 审批、草稿/发布、状态与对账。
- 如未来必须合并为一个插件，因 schema、权限、依赖和安全边界均发生重大变化，应升级到 media-ops 0.5.0，而不是悄悄覆盖 0.4.0。

正式开放“发布”按钮必须同时满足：

1. P0 官方/真实账号能力证据完成。
2. 对应平台内容类型拥有独立 schema 和 capability snapshot。
3. 强身份、一次性批准、幂等和 unknown 对账通过故障注入测试。
4. 浏览器 Edge 最小权限和安全测试通过。
5. 固定浏览器截图与真实草稿/发布回归通过。
6. 远端 ID/URL 或状态查询可以证明最终结果。
7. 平台规则、服务条款和账号资格已有责任人复核。
8. selector/API schema 变化具备 canary、熔断和人工接力。

未满足时只能显示“预填/准备草稿”，不能营销为“自动一键发布”。

## 十七、架构与范围决策记录

| 决策 | 结论 | 理由 | 风险/复发条件 |
|---|---|---|---|
| 是否按平台做一个 Adapter | 否，按平台内容类型 + 账号能力 | 微博与头条内部存在多种独立体裁 | 若再次加入通用 send，会复发错投和假成功 |
| 微博走 MCP 还是扩展 | 官方 MCP/CLI 优先，扩展仅兜底 | 已有官方 Agent 发布能力 | 账号权益、配额和真实工具 schema 仍需实测 |
| 头条“图文”是否单独建类型 | 暂不单列，映射 toutiao.article | 官方帮助把图文发布流程表述为发布文章 | 真实控制台出现独立画册能力时再通过 schema 版本新增 |
| 头条文章与微头条是否一稿双发 | 默认禁止 | 官方不鼓励同作品跨体裁重复发布 | 仅完全独立变体、重新审批并通过消重才可考虑 |
| 头条是否依赖公共投稿 API | 分体裁：文章/微头条走 Edge，小视频优先当前官方 OpenAPI | 当前 API 明确只覆盖小视频；文章/微头条未找到公开写入接口 | scope、文档口径或真实调用失败时 fail closed；中视频不得继承小视频结论 |
| UC 是否作为大鱼号之外的独立目标 | 默认否 | 大鱼号官方把 UC 描述为其多端分发下游 | 只有未来取得独立 UC 创作账号/API 证据才新增 target，避免重复稿 |
| 大鱼号/简书是否标官方 API | 否，首期均标 Browser Edge | 本轮未找到普通创作者公开写入契约；现有开源代码使用 DOM/Web 内部接口 | 页面或内部接口变化即熔断，真实回归前只开放预填/草稿 |
| Browser Edge 是否放服务器 | 否，运行在用户登录设备 | 避免集中托管 Cookie 和账号会话 | 无常驻设备时任务只能等待用户上线 |
| 是否需要服务器 | 内测可本地；对外生产版需要 Hub 服务器 | 强身份、定时、任务、审计、幂等和对账需可持久服务 | 不得因部署 Hub 而将浏览器 Cookie 迁入服务器 |
| 代码在哪个仓库实施 | `CrabCode-Plugin/plugins/crabcode-media-publisher/` | 新能力是独立 Gate B 插件，可与市场加载模型和 media-ops 交付契约衔接 | 若塞入 media-ops 0.4 或 CrabCode 内核，会混淆版本、权限与部署边界 |
| 正式 MCP 地址是什么 | 当前不存在；`acosmi.com` 只是已确认的基础域名 | 尚未部署 CrabPublish Hub，也未分配和验收 MCP 主机名/路由 | 不得把 `https://acosmi.com/mcp` 或自行猜测的子域名写入配置；须在真实部署和安全验收后另行固化 |
| 是否直接复用 MultiPost | 否，clean-room 参考 | 它最接近多体裁，但权限、成功语义、对账不足 | 复制其 isAutoPublish/宽权限会重现安全问题 |
| HTML 与 MD 谁是主交付 | HTML 主交付，MD 备份 | 与 media-ops 0.4 契约一致，用户获得精排结果 | 两份手工维护会漂移，必须同 revision 渲染 |
| 是否修改 CrabCode | 首版不修改，并作为实施约束 | CrabCode 已支持本地和远程 MCP；发布逻辑应保持为插件业务边界 | 只有未来出现已论证的内嵌 UI 硬需求时，才可另立方案；不得在本任务中附带修改 |

## 十八、明确不做

- 不在本次文档任务中修改 CrabCode 或接入真实账号。
- 不绕过登录、验证码、短信、扫码或平台风控。
- 不把 Cookie 交给服务器、模型或第三方同步服务。
- 不承诺所有平台都具有稳定公开 API。
- 不用一个 ArticleDoc 冒充所有短帖、图集和视频。
- 不把同一头条作品机械变形后跨体裁重复发布。
- 不以“脚本执行成功”“按钮已点击”“页面已填好”冒充平台已发布。
- 不在首期做自动评论、私信、批量关注、洗稿或高频营销机器人。
- 不把开源仓库的 README、星数或演示视频当作生产验收。

## 十九、最终实施建议

建议批准以下产品路线：

1. 保持 crabcode-media-ops 0.4.0 的 Gate A 边界不变。
2. 新建 CrabPublish Hub + Edge，Hub 暴露业务 MCP，Edge 执行登录态浏览器动作。
3. 首批完成微信公众号文章、微博普通微博/长博文、今日头条文章/微头条。
4. 微博普通微博优先官方 REST/MCP，长博文优先官方 MCP/CLI；今日头条文章/微头条先用本地 Edge，并做跨体裁消重。
5. 第二批增加百家号、搜狐号、网易号、大鱼号和简书文章；头条小视频官方 OpenAPI、大鱼号视频和其他视频能力仍按独立体裁验收。
6. 只在真实账号、固定浏览器、幂等、对账、安全和审批全部通过后开放最终一键发布。

这条路线既能让 CrabCode 通过 MCP 发起“一次批准、多平台执行”，又不会把平台 Cookie、任意浏览器控制和未经核验的最终点击直接交给智能体；也完整覆盖了微博普通微博/头条文章，以及今日头条文章/微头条/视频的差异。

## 二十、来源索引

### 官方与标准

- 微博开放平台 CLI：https://open.weibo.com/cli/index
- 微博 MCP 手册：https://open.weibo.com/cli/manual/mcp
- 微博官方 MCP 端点：https://cli.weibo.com/mcp
- 微博纯文字发布 REST：https://open.weibo.com/wiki/2/statuses/update
- 微博图片发布 REST：https://open.weibo.com/wiki/2/statuses/upload
- 微博分享发布 REST：https://open.weibo.com/wiki/2/statuses/share
- 微博头条文章使用手册：https://js.t.sinajs.cn/t6/article/publish/dist/js/static/faq.pdf
- 今日头条创作者帮助中心：https://baike.toutiao.com/
- 今日头条图文创作：https://baike.toutiao.com/detail/211/212/214?enter_from=left_navigation
- 今日头条微头条创作：https://baike.toutiao.com/detail/211/212/215?enter_from=left_navigation
- 今日头条内容创作规则：https://baike.toutiao.com/detail/211/212/570?enter_from=left_navigation
- 当前头条内容发布接入方案：https://open.douyin.com/platform/resource/docs/ability/content-management/toutiao-publish-solution/
- 当前头条小视频发布接口：https://open.douyin.com/platform/resource/docs/openapi/video-management/toutiao/create-video/publish-video/
- 头条账号 OAuth 2.0：https://open.douyin.com/platform/resource/docs/develop/permission/toutiao-or-xigua/OAuth2.0/
- 当前开放平台应用类型与权限矩阵：https://open.douyin.com/platform/resource/docs/accession-guide/type-and-permission
- 头条投稿接口服务下线通知：https://developer.open-douyin.com/forum/bulletin/post/65437c6341dcfdfb21a9d9ce
- 关于大鱼号平台与多端分发：https://mp.dayu.com/about.html
- 大鱼号文章/视频推荐和审核语义：https://mp.dayu.com/service-manual?categoryid=2
- 大鱼号账号权益与作品入口：https://mp.dayu.com/service-manual?categoryid=5
- UC 故事会投稿说明：https://dayu-h5.uc.cn/contact.html
- 简书写作入口：https://www.jianshu.com/writer
- MCP Tasks 2025-11-25：https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
- RFC 8785 JSON Canonicalization Scheme：https://www.rfc-editor.org/rfc/rfc8785.html

### 开源源码

- MultiPost Extension：https://github.com/leaperone/MultiPost-Extension
- MultiPost 大鱼号文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/dayuhao.ts
- MultiPost 大鱼号视频：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/video/dayu.ts
- MultiPost 简书文章：https://github.com/leaperone/MultiPost-Extension/blob/0f8dabc0ee773b420661c649200b1dd854211a10/src/sync/article/jianshu.ts
- Wechatsync v2：https://github.com/wechatsync/Wechatsync/tree/v2
- COSE：https://github.com/doocs/cose
- Tiptap：https://github.com/ueberdosis/tiptap
- doocs/md：https://github.com/doocs/md
- WxJava：https://github.com/Wechat-Group/WxJava
- Postiz：https://github.com/gitroomhq/postiz-app
- Mixpost：https://github.com/inovector/mixpost
- Playwright MCP：https://github.com/microsoft/playwright-mcp

## 二十一、证据边界声明

本方案对“官方页面明确说明的能力”“开源源码中存在的实现”和“仍需真实账号验证的推断”进行了区分：

- 微博官方页面足以证明官方 Agent/CLI 发布方向和图文/长博文分类；具体工具 schema、账号权益、草稿/定时/幂等仍属于 P0 实测项。
- 今日头条官方帮助足以证明文章、微头条、中视频、小视频等体裁及跨体裁重复风险；当前开放平台文档明确提供小视频投稿 API，但文章/微头条的公开写入 API 为“本轮未找到”，不能排除合作方或白名单能力。小视频权限文档自身存在“默认开放/默认关闭需申请”的口径差异，必须以实时 scope 和真实调用为准。
- 大鱼号官方页面足以证明文章、视频及“平台向 UC 等多端分发”的产品语义，但不足以证明存在普通创作者公开写入 API；简书官方写作入口足以证明当前网页创作面存在，公开 API 与最终发布自动化仍为“本轮未找到/待实测”。
- MultiPost、Wechatsync、COSE 的结论来自公开源码，但不等于其 selector 在 2026-07 的真实账号上仍然可用。
- 所有平台规则和页面路径都可能变化，CapabilitySnapshot、verifiedAt、canary 和熔断是上线后持续运行的必需品，不是文档附加项。
