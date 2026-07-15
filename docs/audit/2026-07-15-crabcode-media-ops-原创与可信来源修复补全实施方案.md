# crabcode-media-ops 原创与可信来源修复补全实施方案

- 文档日期：2026-07-15
- 审计对象：plugins/crabcode-media-ops
- 审计范围：第三方参考材料使用、联网研究、事实核验、原创风险复核、默认交付格式、HTML 排版与视觉一致性、发布门禁、评测与版本发布
- 文档状态：实施前方案存档（已增补 HTML 主交付与 Markdown 备份约束）
- 建议目标版本：0.4.0

## 一、执行摘要

本次审计确认，用户遇到的“把其他作者文章轻微改写后作为原创稿交付”和“未联网补充可信、可核验来源”不是偶发模型问题，而是 crabcode-media-ops 0.3.x 编辑完整性链路存在结构性缺口。

当前主要风险为：

1. 未区分用户自有稿、获授权样稿、第三方作品和事实来源，第三方全文可能直接成为写作底稿。
2. 单篇公众号创作可绕过研究流程，直接进入写作阶段。
3. 原创复核状态可以由调用方自行提交，未绑定扫描证据和稿件版本。
4. 当前扫描器只检查固定长度的精确文字重合，容易被同义替换和结构复刻绕过。
5. 事实核验只要求存在 URL，没有验证网页是否可访问、是否独立、是否真正支持对应主张。
6. 旧评测没有真实参考文章、真实文章输出、正式评分和旧版基线，无法发现上述问题。
7. 仓库版本、运行时版本与实际安装版本存在漂移，修复后若不刷新安装缓存，用户仍可能运行旧版本。
8. 当前虽会同时生成 Markdown 和 HTML，但没有“HTML 主交付、Markdown 备份”的明确契约；HTML 只是未经视觉审核的极简预览，也未与最终审批哈希绑定。

本问题建议按 P0 编辑完整性缺陷处理，并以 0.4.0 作为行为和数据契约升级版本。修复不能局限于提示词，应同时覆盖技能规则、研究流程、数据结构、工具门禁、原创扫描、HTML 主交付、双格式一致性、视觉验收、真实评测和版本发布。

用户默认获取的应是可直接打开的精致白底 `article.html`；`article.md` 作为同一内容版本的可追溯备份一并保存，但不再将 Markdown 正文作为默认展示层。HTML 不得人工独立维护，必须从同一内容 revision 确定性渲染，并通过内容对等、安全、语义、可访问性和视觉回归。

系统不得再承诺“符合原创标准”或输出缺乏依据的“原创率”。推荐表述为：

> 针对已提供的对照材料，未发现明显高风险复写迹象。

该结论只是技术风险评估，不构成平台原创认证、版权归属判断或法律意见。

## 二、审计发现

### 2.1 P0：缺少参考材料权利与用途分类

当前单篇公众号任务可以直接路由到 wechat-original-opinion，系统没有在写作前要求判断参考材料属于：

- 用户自有稿；
- 获授权改写材料；
- 第三方作品；
- 事实或数据来源；
- 仅用于抽象风格学习的样本。

现有规则只笼统要求“不模仿标志性表达”，没有禁止继续沿用：

- 标题骨架；
- 章节顺序；
- 段落映射；
- 案例组合；
- 独特比喻；
- 论证路径；
- 结论推进顺序。

这使智能体可能把第三方文章理解为“需要做同义改写的底稿”。

相关文件：

- plugins/crabcode-media-ops/media-core/skills/media-ops/SKILL.md
- plugins/crabcode-media-ops/editorial/skills/wechat-original-opinion/SKILL.md
- plugins/crabcode-media-ops/media-core/PRACTICE.md
- plugins/crabcode-media-ops/editorial/PRACTICE.md

### 2.2 P0：联网研究不是成稿前置条件

当前 media-draft 命令没有联网工具，单篇写作路径没有强制调用 trend-researcher 或 fact-checker。

内容保存工具允许从初始状态直接保存为 drafted，未要求先完成 researched。实测在没有引用、研究记录或来源台账的情况下，可以成功创建 drafted 内容。

来源发现模块默认能力也不足以代表完整的事实研究；即使趋势来源获取失败，当前流程仍可能只返回警告而继续。

相关文件：

- plugins/crabcode-media-ops/editorial/commands/media-draft.md
- plugins/crabcode-media-ops/editorial/agents/draft-writer.md
- plugins/crabcode-media-ops/editorial/agents/trend-researcher.md
- plugins/crabcode-media-ops/editorial/agents/fact-checker.md
- plugins/crabcode-media-ops/src/tools/content.ts
- plugins/crabcode-media-ops/src/tools/trends.ts
- plugins/crabcode-media-ops/src/sources/index.ts

### 2.3 P0：原创门禁依赖自报状态

OriginalityReviewSchema 当前只有状态、审核者、时间、结论和备注，没有：

- 被审核稿件哈希；
- 对照材料哈希；
- 扫描编号；
- 算法版本；
- 策略版本；
- 最长连续命中；
- 覆盖率；
- 命中原文位置；
- 结构相似风险；
- 人工复核记录。

readiness 只检查原创审核是否标记为 completed 和 publishable，没有验证结论是否由可信工具产生，也没有验证审核是否对应当前稿件版本。

实测空备注配合自报 publishable 可以进入 ready。

相关文件：

- plugins/crabcode-media-ops/src/domain.ts
- plugins/crabcode-media-ops/src/tools/content.ts
- plugins/crabcode-media-ops/src/tools/readiness.ts
- plugins/crabcode-media-ops/tests/helpers.ts
- plugins/crabcode-media-ops/tests/readiness.test.ts

### 2.4 P0：现有扫描器容易被同义替换绕过

现有 originality_scan.py 仅对规范化文本生成固定 12 字 shingle，并统计精确交集。它没有检测：

- 最长连续重合；
- 稿件和参考文双向覆盖率；
- 局部段落挪用；
- 同义改写；
- 标题结构；
- 章节次序；
- 段落对齐；
- 案例、比喻和论证路径复刻。

实测在观点、句序和论证结构保持一致，仅连续替换同义词后，扫描结果可返回 matchCount=0。

相关文件：

- plugins/crabcode-media-ops/editorial/scripts/originality_scan.py
- plugins/crabcode-media-ops/editorial/skills/media-originality-review/SKILL.md
- plugins/crabcode-media-ops/editorial/references/originality-review.md

### 2.5 P1：来源存在不等于事实已核验

当前 ClaimSchema 只有一个可选 sourceUrl，citations 也主要是 URL 和标题，缺少：

- 发布者和作者；
- 发布时间和访问时间；
- 来源层级；
- 是否一手来源；
- 独立来源组；
- 网页访问状态；
- 最终跳转 URL；
- 内容哈希或快照；
- 支持主张的具体片段；
- 证据局限；
- 反证；
- 来源与主张之间的多对多关系。

当前 readiness 只检查 verified 主张是否带 URL，没有真正打开网页并判断来源是否支持该主张。同一新闻稿被多个站点转载，也可能被错误当成多条独立来源。

相关文件：

- plugins/crabcode-media-ops/src/domain.ts
- plugins/crabcode-media-ops/src/tools/readiness.ts
- plugins/crabcode-media-ops/editorial/agents/fact-checker.md
- plugins/crabcode-media-ops/editorial/references/research-standard.md

### 2.6 P1：迁移压缩造成关键能力退化

插件内嵌版本相较原独立 wechat-original-opinion 技能被显著压缩：

- 主技能约 156 行压缩为 23 行；
- 研究规范约 87 行压缩为 20 行；
- 原创规范约 98 行压缩为 14 行；
- 扫描脚本约 306 行压缩为 37 行。

原技能中以下关键约束在插件版中大多丢失：

- 联网核验是成稿流程的一部分；
- 不得逐段换词；
- 建立核心主张台账；
- 优先一手来源或双源交叉；
- 主动寻找反证；
- 有参考稿必须运行原创风险扫描；
- 不能用技术扫描结果承诺法律原创性。

迁移修复应以恢复并升级这些行为契约为目标，不能只恢复文件长度。

### 2.7 P2：旧评测没有覆盖真实创作行为

当前测试、类型检查和专用校验均可通过，但关键缺陷仍能稳定复现，说明现有测试主要验证工程结构和状态接口，没有验证创作行为。

主要缺口：

- evals.json 中写作和原创用例没有真实参考文件；
- 没有“给其他作者文章后要求参考创作”的用例；
- 审阅 HTML 中 grading 为 null；
- 没有真实文章、当前版基线、正式评分或人工盲评；
- 技能触发测试只统计用例数量，没有执行实际路由；
- 来源测试只检查 JSON 映射，没有访问网络或核验引用内容。

相关文件：

- plugins/crabcode-media-ops/evals/evals.json
- plugins/crabcode-media-ops/evals/trigger-evals.json
- plugins/crabcode-media-ops/tests/skills.test.ts
- plugins/crabcode-media-ops/tests/sources.test.ts
- docs/audit/2026-07-12-crabcode-media-ops-评测审阅.html

### 2.8 P2：版本校验与安装版本漂移

审计时发现：

- manifest、package 和 marketplace 为 0.3.1；
- src/domain.ts 中运行时 VERSION 为 0.3.0；
- src/tools/package.ts 仍包含 0.3.0；
- README 仍显示 0.3.0；
- 实际安装记录指向 0.3.0。

当前校验器只比较部分表面版本，因此仍会报告版本一致。修复发布必须同时更新所有版本源、缓存和安装记录。

### 2.9 P1：HTML 主交付、精致排版和双格式一致性缺少统一契约

当前发布包已会生成 `article.md` 和 `article.html`，`mediaops.preview.create` 也会生成本地 HTML 预览。这说明工程已有可复用起点，但还不能满足“Markdown 仅作备份、HTML 作为默认用户交付”的要求。

实际缺口包括：

1. 没有声明主交付物和备份交付物，工具响应也没有保证先向用户提供 HTML。
2. `src/markdown.ts` 明确是一个“minimal”正则渲染器，只支持基础标题、段落、列表、链接和图片，嵌套列表、引用、表格、代码块、脚注、图注和复杂链接可能失真。
3. 完整页仍使用 `lang="en"`，没有 `main/article/header/footer/figure/figcaption/time/cite` 等文章语义结构。
4. 页面未对 `html`、`body` 和文章容器显式声明 `#FFFFFF` 白底，也没有系统暗色偏好、移动端、打印和富文本粘贴验收。
5. 标题字段和 Markdown 中的一级标题可能重复生成多个 `h1`；标题层级、段距、行宽、图注、引用和来源区均没有可机器验证的规范。
6. 链接和图片 URL 没有协议白名单。实测 `[危险链接](javascript:alert%281%29)` 会被渲染为带 `javascript:` 的 `href`；远程图片也可能成为跟踪像素。这部分应按 P0 安全子项修复。
7. HTML 在打包时临时重新渲染，审批只绑定内容哈希，没有绑定 HTML 哈希、渲染器版本、模板版本、样式策略版本和净化策略版本。
8. 没有校验 HTML 与 Markdown 在标题、段落、引用、图片、图注和来源顺序上是否对等，也没有 HTML 合法性、可访问性或视觉回归测试。

相关文件：

- plugins/crabcode-media-ops/src/markdown.ts
- plugins/crabcode-media-ops/src/tools/preview.ts
- plugins/crabcode-media-ops/src/tools/package.ts
- plugins/crabcode-media-ops/tests/markdown.test.ts
- plugins/crabcode-media-ops/tests/preview.test.ts
- plugins/crabcode-media-ops/tests/package.test.ts
- plugins/crabcode-media-ops/platform-delivery/references/publish-runbook.md

该项整体列为 P1，但必须成为 0.4.0 正式发布的阻断验收项；其中危险 URL、HTML 注入和远程资源跟踪属于 P0 安全修复。

## 三、开源项目调研结论

截至 2026-07-15，没有发现一个可信开源项目可以同时解决：

- 第三方参考稿防轻改；
- 强制联网取证；
- 主张级事实核验；
- 原创风险门禁；
- 精确版本审批；
- HTML 主交付、Markdown 备份与可复现的精致排版；
- 多渠道可靠发布。

建议组合吸收不同项目的机制，而不是整体移植某个产品。

### 3.1 Meedan Check

- 官方仓库：https://github.com/meedan/check
- 许可证参考：https://github.com/meedan/check-api/blob/develop/LICENSE
- 推荐吸收：主张、证据、状态、注释、审核历史和人工裁决的数据模型。
- 具体应用：将事实相似和表达相似拆成两套结论；人工豁免绑定 claimId、revisionId、审核人、理由和时间。
- 边界：整个平台技术栈过重，聚类或相似结果不能自动等同于事实裁决。

### 3.2 GPT Researcher

- 官方仓库：https://github.com/assafelovic/gpt-researcher
- 官方架构：https://docs.gptr.dev/docs/gpt-researcher/getting-started/introduction
- 指定来源与补充研究：https://docs.gptr.dev/docs/gpt-researcher/context/tailored-research
- 许可证：Apache-2.0
- 推荐吸收：研究问题规划、独立检索、来源跟踪、相关性过滤、证据缺口复核。
- 具体应用：用户参考文章仅作为 seedSource，默认必须补充独立联网来源。
- 边界：不建议引入完整 Python 服务、搜索 API、爬虫和向量库依赖；有引用不代表引用支持结论。

### 3.3 Wagtail

- 官方仓库：https://github.com/wagtail/wagtail
- 自定义任务：https://docs.wagtail.org/en/stable-7.4.x/extending/custom_tasks.html
- 审计日志：https://docs.wagtail.org/en/stable-7.4.x/extending/audit_log.html
- 许可证：BSD-3-Clause
- 推荐吸收：可串联审核任务、退回修改、组审批、任务状态和审计事件。
- 具体应用：把参考权利检查、研究证据检查、原创扫描和人工编辑复核建成独立任务，全部通过才允许发布。
- 边界：不引入完整 Django CMS，只实现等价状态机；修改后重审必须在本插件内强制执行。

### 3.4 Decap CMS

- 官方仓库：https://github.com/decaporg/decap-cms
- 编辑工作流：https://decapcms.org/docs/editorial-workflows/
- 部署预览：https://decapcms.org/docs/deploy-preview-links/
- 许可证：MIT
- 推荐吸收：不可变 revision、精确版本审批、内容 diff 和发布预览。
- 具体应用：研究包、参考文哈希和扫描结果必须与获批 revision 一起保存。
- 边界：基础状态不能替代研究和原创门禁；不应让 Git 分支暴露敏感未发布稿件。

### 3.5 datasketch

- 官方仓库：https://github.com/ekzhu/datasketch
- 许可证：https://github.com/ekzhu/datasketch/blob/master/LICENSE
- 推荐吸收：MinHash、LSH 和 containment 候选召回。
- 具体应用：从参考文章和历史稿库中发现局部挪用候选，再计算精确重合位置、覆盖率和最长连续匹配。
- 边界：MinHash 是概率算法，只能用于候选召回，不能单独构成发布门禁或法律判断。

### 3.6 Sentence Transformers

- 官方仓库：https://github.com/huggingface/sentence-transformers
- 官方用法：https://www.sbert.net/docs/sentence_transformer/usage/usage.html
- 许可证：框架为 Apache-2.0
- 推荐吸收：句子和段落级语义相似、复述检测和候选重排。
- 具体应用：检测措辞变化但语义和段落映射高度一致的情况。
- 边界：模型权重和训练数据许可证需逐个核验；语义高相似只能触发人工复核；默认不应将未发布稿件发送给外部 embedding 服务。

### 3.7 Zotero

- 官方仓库：https://github.com/zotero/zotero
- API：https://www.zotero.org/support/dev/web_api/v3/basics
- 许可证：AGPLv3
- 推荐吸收：来源元数据、访问日期、网页快照、版本控制、重复来源识别和冲突处理。
- 具体应用：建立 SourceRecord 和 ClaimEvidenceLink，保存 canonical URL、作者、发布者、时间、快照哈希和支持片段。
- 边界：建议吸收数据模型或做可选 API 集成，不直接复制 AGPL 代码；网页快照需处理版权、隐私和存储期限。

### 3.8 Mixpost 与 Postiz

- Mixpost：https://github.com/inovector/mixpost
- Mixpost MCP：https://docs.mixpost.app/mcp/
- Postiz：https://github.com/gitroomhq/postiz-app
- Postiz 架构：https://docs.postiz.com/howitworks
- 推荐吸收：needs_approval、渠道版本、ProviderAdapter、最小权限令牌、幂等发布、失败重试和平台回执。
- 具体应用：一个获批母稿派生平台版本，保存 parentDraftHash 和 channelDiff；外部写操作必须再次人工批准。
- 边界：这两类能力属于发布执行层，不能替代研究和原创门禁；Mixpost 存在开源版与商业版边界，Postiz 为 AGPL。

### 3.9 C2PA / c2pa-rs

- 官方仓库：https://github.com/contentauth/c2pa-rs
- 官方说明：https://spec.c2pa.org/specifications/specifications/2.2/explainer/Explainer.html
- 许可证：MIT / Apache-2.0 双许可
- 推荐吸收：为图片、视频、音频和导出文档建立可验证的资产加工来源链。
- 边界：放在后续阶段，不阻塞本轮文字原创与联网核验修复；C2PA 不能证明事实真实、内容准确或法律原创性。

### 3.10 暂不优先

- Ghost：版本恢复、操作历史和多端预览值得参考，但不是事实核验或原创门禁。
- changedetection.io：适合后续做来源变化和证据过期监控。
- RSSHub：可以借鉴来源适配器思路，但 AGPL 和大量非官方抓取路由带来许可证、反爬和站点条款风险，不建议嵌入。

### 3.11 HTML 渲染、中文排版和交付质量专项调研

本次新增约束不建议继续扩写现有正则渲染器，也不建议用一份 HTML/CSS 强行覆盖浏览器、微信富文本、邮件和打印等不同渠道。建议吸收以下官方项目和规范的优点。

#### 3.11.1 unified / remark / rehype

- 官方项目：https://github.com/unifiedjs/unified
- Markdown 转 HTML AST：https://github.com/remarkjs/remark-rehype
- HTML AST 净化：https://github.com/rehypejs/rehype-sanitize
- 许可证：MIT
- 推荐吸收：使用 Markdown AST 和 HTML AST 做标题层级、图片、引用、脚注、来源和平台差异变换，避免正则替换造成语义丢失。
- 安全要点：`allowDangerousHtml` 默认为 `false`，不接受模型或参考网页携带的原始 HTML；`rehype-sanitize` 必须放在最后一个不可信变换之后。
- 适配性：以 ESM/TypeScript 为主，与当前 Bun 插件技术栈相符，但仍必须在目标 Bun 版本上做安装、导入、渲染和恶意样本实测。

#### 3.11.2 doocs/md、WordPress theme.json 与 Ghost 内容渲染

- doocs/md：https://github.com/doocs/md
- WordPress 全局样式：https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/
- Ghost 内容标记：https://docs.ghost.org/themes/content
- 推荐吸收：
  - 借鉴 doocs/md 的“Markdown 即时渲染为简洁微信图文、主题与导出分离”产品思路；
  - 借鉴 WordPress `theme.json` 的单一设计令牌源，让预览与导出共用同一份字号、行高、内容宽度、颜色和间距定义；
  - 借鉴 Ghost 的 `figure/figcaption`、图片宽高、`srcset/sizes` 和受控布局变体。
- 边界：doocs/md 使用非常规 WTFPL，WordPress 主体为 GPL；本轮只吸收产品与数据结构思路，不引入完整应用代码、主题素材或第三方样式。

#### 3.11.3 Juice 与渠道内联样式

- 官方项目：https://github.com/Automattic/juice
- 最终字符串净化候选：https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html
- 许可证：MIT
- 推荐吸收：将版本化、受信任的 CSS 转换为行内样式，用于 `wechat-richtext` 等会过滤 `<style>` 或需要粘贴的富文本渲染档案。
- 安全边界：只调用不获取远程资源的本地转换路径；不允许作者或模型传入任意 CSS；Juice 改写 HTML 后再执行一次最终字符串白名单净化和安全断言。`sanitize-html` 的默认标签和 URL 规则不可直接照搬，必须使用本插件的更严格白名单。
- 依赖安全：`sanitize-html` 2.17.3 曾有已公开的严重 XSS 绕过，官方修复版为 2.17.4：https://github.com/advisories/GHSA-rpr9-rxv7-x643。如选用该组件，必须锁定已修复版本、执行恶意回归样本和持续安全升级，不得将“已使用 sanitizer”视为一次性安全保证。
- 选型边界：普通浏览器主交付物保留页面级受信任样式；仅对平台富文本版本做 CSS inlining，不让一份内联 HTML 取代所有渲染档案。

#### 3.11.4 标准与自动验收工具

- CommonMark：https://spec.commonmark.org/0.31.2/
- WHATWG HTML 语义结构：https://html.spec.whatwg.org/multipage/
- W3C 中文排版需求：https://www.w3.org/TR/clreq/
- WCAG 2.2：https://www.w3.org/TR/WCAG22/
- OWASP XSS Prevention：https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Nu HTML Checker：https://github.com/validator/validator
- Playwright 视觉对比：https://playwright.dev/docs/test-snapshots
- axe-core：https://github.com/dequelabs/axe-core

建议将这些规范落为可自动执行的门禁：HTML 合法性错误为 0；一个文档恰好一个 `h1`；标题层级不跳级；图片有替代文本；正文对比度不低于 4.5:1；320 CSS px 下无整页水平滚动；用户放大文本或调整行段间距后不遮挡、不丢失。axe-core 只能自动发现部分可访问性问题，不能取代人工视觉审核。

本项最终选型建议为：

~~~text
受约束的写作输出
→ 规范化 ArticleDoc
→ remark / GFM 解析与 AST 校验
→ remark-rehype（禁止原始 HTML）
→ 引用、图片、来源和语义结构变换
→ rehype-sanitize
→ web 白底完整页或平台富文本档案
→ 富文本档案可选 Juice 内联样式
→ 最终白名单净化与安全断言
→ HTML/Markdown 双产物哈希、对等检查和视觉回归
~~~

## 四、目标工作流

建议目标链路：

~~~text
参考材料登记与权利分类
  → 提取事实线索和禁止复现特征
  → 独立联网研究
  → 建立主张—证据矩阵
  → 研究证据缺口检查
  → 写作者仅依据结构化研究包独立立论和成稿
  → 字面近重复扫描
  → 语义转述与结构复刻预警
  → 人工编辑复核
  → 规范化 ArticleDoc
  → 生成精致白底 HTML 主交付物和 Markdown 备份
  → 内容对等、安全、语义、可访问性和视觉验证
  → 审批绑定 contentHash + renderManifestHash
  → 渠道适配与预览
  → 人工批准外部写操作
  → 幂等发布与回执留存
~~~

建议状态机：

~~~text
INTAKE
→ RESEARCH_REQUIRED
→ RESEARCHED
→ DRAFTED
→ INTEGRITY_REVIEW
→ NEEDS_CHANGES / ORIGINALITY_BLOCKED
→ DELIVERY_RENDERING
→ DELIVERY_READY
→ APPROVED(contentHash + renderManifestHash)
→ CHANNEL_ADAPTED
→ SCHEDULED
→ PUBLISHED
~~~

### 4.1 默认交付产物模型

“主交付物”与“内容事实源”必须分开：

1. 规范化 `ArticleDoc` 是标题、正文区块、图片、图注、引用、来源和披露的唯一语义事实源。
2. `article.html` 是默认向用户展示和交付的主产物。
3. `article.md` 是从同一 `ArticleDoc` 导出的可读、可编辑、可移植备份，不另行维护第二份文案。
4. 为平滑迁移，现有 `bodyMarkdown` 在 0.4.x 可保留为写作输入和原始快照；保存时必须解析并验证为 `ArticleDoc`，最终 HTML 和备份 Markdown 都从 `ArticleDoc` 生成。
5. 禁止直接修改生成后的 HTML。任何文字、来源、图片或结构变更都必须先修改内容记录，然后重新渲染。

建议受控区块：

~~~text
paragraph
heading(level: 2 | 3 | 4)
blockquote
unordered-list
ordered-list
code-block
table
image
callout
divider
source-note
disclosure
~~~

文章标题只能来自 `ArticleDoc.title`，由渲染器生成唯一 `h1`；正文区块不得再出现一级标题。参考网页的 DOM、CSS、类名和行内样式不得进入 `ArticleDoc`。

建议新增交付数据契约：

#### DeliveryManifest

~~~text
deliveryId
contentId
revisionId
contentHash
articleDocHash
primaryArtifactId
backupArtifactId
renderProfiles
rendererVersion
templateId
templateVersion
stylePolicyVersion
sanitizationPolicyVersion
dependencyLockHash
assetMapHash
parityStatus
securityStatus
semanticStatus
accessibilityStatus
visualReviewStatus
renderManifestHash
generatedAt
generatedBy
~~~

#### DeliveryArtifact

~~~text
artifactId
role: primary | backup | channel_variant
format: html | markdown
mediaType
relativePath
artifactHash
byteSize
sourceContentHash
renderProfile
~~~

硬性规则：

1. `primaryArtifact` 必须是 `text/html; charset=utf-8`，`backupArtifact` 必须是 `text/markdown; charset=utf-8`。
2. HTML 和 Markdown 必须绑定同一 `contentId`、`revisionId`、`contentHash` 和 `articleDocHash`。
3. 标题、副标题或导语、段落顺序、标题层级、列表、引用、图片、图注、来源和披露必须语义对等；样式差异不等于内容差异。
4. 发布包固定包含 `article.html`、`article.md`、`render-manifest.json` 和已登记的 `assets/`。
5. 默认工具响应首先返回 HTML 产物及可打开的安全预览，Markdown 路径只作为标记为“备份”的次级字段返回；除非用户明确索要，不把 Markdown 正文当作默认成稿展示。
6. 对话或客户端呈现层应渲染经验证的 HTML，或以 HTML 文件/沙箱预览的方式交付；不得把原始 HTML 源码包在 Markdown 代码块中冒充“HTML 呈现”，也不得把未信任 HTML 直接注入宿主 DOM。
7. 若 HTML 生成、净化、对等或视觉验证失败，可保留 Markdown 备份供排障，但不得将其降级冒充为已完成最终交付。
8. “统一白底”保证范围为插件生成的完整 HTML、本地预览和发布包产物；微信、小红书等第三方平台的原生界面或二次清洗结果不在可绝对控制的承诺范围内。

## 五、分阶段实施方案

### 阶段 0：建立真实基线和评测材料

目标：在改动实现前保存当前行为基线，避免修复后只能凭感觉判断效果。

工作项：

1. 保存实际安装版 0.3.0 和仓库版 0.3.1 快照。
2. 建立带真实输入文件的评测夹具。
3. 当前版和新版在同一轮评测中生成真实文章。
4. 保存运行输出、时间、正式评分、断言和人工盲评。
5. 评测报告必须展示完整产物和失败原因，不能只写“通过”。
6. 为当前渲染器保存 HTML、Markdown、320/375/768/1440px 截图、暗色系统偏好截图、打印预览和恶意 URL 实际输出，作为呈现层基线。

必须加入的用例：

- 第三方文章轻改；
- 措辞不同但标题和段落结构一致；
- 相同案例、比喻和结论路径复刻；
- 用户自有稿件正常润色；
- 获授权材料改写；
- 规范引用并注明作者和作品；
- 虚假 URL、404、登录墙和无关网页；
- 来源支持不足或互相冲突；
- 用户要求不联网；
- 搜索零结果；
- 多家媒体转载同一新闻稿；
- 相同主题但独立观点和结构，验证误报率。
- 同时含标题、导语、H2/H3、段落、引用、嵌套列表、表格、代码、图片、图注、脚注、来源和披露的中文长文；
- 超长标题、长 URL、长英文单词、中英数字混排和连续中文标点；
- 空图片 alt、缺失图注、无表头表格、跳级标题和重复 H1；
- `script`、事件属性、`javascript:`、恶意 SVG/MathML、`iframe/srcdoc`、DOM clobbering、CSS `url()`/`@import` 和远程跟踪像素；
- 亮/暗系统偏好、320px reflow、200% 缩放、文本间距覆盖和 A4/Letter 打印。

验收：

- 当前版和新版都有真实输出；
- 关键行为断言可自动判定；
- 有正式 grading 和 benchmark；
- 人工盲评无法通过文件名识别版本。
- 呈现层基线包含实际 HTML/Markdown 产物、固定视口截图和可重复的视觉评分标准。

### 阶段 1：建立参考材料防火墙

目标：阻断“第三方全文直接进入写作者上下文并逐段改写”的路径。

新增参考材料类型：

~~~text
user_owned_draft
authorized_sample
third_party_reference
factual_source
~~~

新增权利与使用字段：

~~~text
referenceId
role
rightsStatus
allowedUses
title
url
contentHash
eligibleAsEvidence
doNotCopyFeatures
~~~

规则：

1. 权利未知的外部文章默认归类为 third_party_reference。
2. third_party_reference 只能用于事实线索、待核验主张和禁止复现对照语料。
3. 禁止沿用标题骨架、章节顺序、段落映射、案例组合、独特比喻、论证路径和结论顺序。
4. 研究智能体可读取第三方全文，写作智能体只接收结构化研究包、独立来源和禁止复现清单。
5. 用户自有稿或获授权材料可以进行改写，但仍需核验其中的外部事实。
6. 未完成参考角色和权利分类时不得进入写作。

建议停止码：

~~~text
REFERENCE_ROLE_UNCLASSIFIED
REFERENCE_RIGHTS_REQUIRED
REFERENCE_USAGE_NOT_ALLOWED
~~~

主要修改文件：

- media-core/PRACTICE.md
- editorial/PRACTICE.md
- editorial/skills/wechat-original-opinion/SKILL.md
- editorial/skills/media-topic-research/SKILL.md
- editorial/skills/media-human-editor/SKILL.md
- editorial/skills/media-originality-review/SKILL.md
- editorial/commands/media-draft.md
- editorial/commands/media-review.md
- editorial/agents/draft-writer.md
- editorial/agents/trend-researcher.md
- editorial/agents/fact-checker.md
- editorial/references/humanize-rules.md

### 阶段 2：强制联网研究和主张级证据

目标：让联网研究和证据核验成为成稿前置条件，而不是建议步骤。

新增数据结构：

#### EvidenceSource

~~~text
sourceId
canonicalUrl
finalUrl
httpStatus
contentType
title
creator
publisher
publishedAt
accessedAt
sourceTier
isPrimary
independenceGroup
retrievalStatus
snapshotRef
snapshotHash
contentHash
rightsOrTerms
~~~

#### ClaimEvidenceLink

~~~text
claimId
sourceId
relation: supports | contradicts | contextualizes
supportType: direct | partial | contextual
locator
supportingExcerpt
sourceInterpretation
limitations
checkedAt
~~~

#### ResearchReview

~~~text
researchId
subjectHash
researchPlan
coreClaimIds
sourceIds
counterEvidenceIds
unresolvedGaps
reviewedAt
policyVersion
~~~

流程规则：

1. 严格执行 intake → researched → drafted → reviewed，禁止跳级。
2. 第三方参考文章和包含时效事实的稿件必须联网研究。
3. 核心时效性或争议性主张原则上要求一手来源加一条独立可信来源。
4. 找不到一手来源时至少使用两条独立来源，并降低结论强度。
5. 用户参考文章不能自动满足独立来源要求。
6. 必须打开网页，记录访问状态，并保存支持具体主张的片段和局限。
7. 同源转载、镜像和新闻稿分发按 independenceGroup 去重。
8. 主动搜索反证和时间边界。
9. 无联网能力、来源不足、搜索零结果或网页打不开时，只能输出待补证提纲，不得交付可发布稿。

建议停止码：

~~~text
RESEARCH_EVIDENCE_REQUIRED
INDEPENDENT_SOURCES_INSUFFICIENT
SOURCE_RETRIEVAL_FAILED
CLAIM_EVIDENCE_MISSING
CLAIM_CONTRADICTED
~~~

主要修改文件：

- src/domain.ts
- schemas 下相关 JSON Schema
- src/tools/content.ts
- src/tools/readiness.ts
- src/tools/trends.ts
- src/sources/index.ts
- src/server.ts
- capabilities 与相关工具说明
- tests 下来源、内容和 readiness 测试

### 阶段 3：重建原创风险扫描

目标：从可选的固定 shingle 脚本升级为工具生成、版本绑定、可复核的原创风险证据。

新增正式工具：

~~~text
mediaops.originality.scan
~~~

扫描证据字段：

~~~text
scanId
subjectHash
referenceHashes
algorithmVersion
policyVersion
modelRevision
parameters
exactMatches
longestNormalizedMatch
draftCoverage
referenceCoverage
paragraphAlignments
outlineSimilarity
semanticFlags
decision
reviewRequired
createdAt
~~~

检测层级：

1. 中文字符 4/8/12-gram 多尺度精确匹配。
2. 最长连续匹配和稿件、参考文双向覆盖率。
3. MinHash/LSH 候选召回和 containment 检测。
4. 标题、章节、段落次序和论证路径的 LCS 或对齐分析。
5. 可选句段级语义复述检测。
6. 人工区分“表达复用”和“相同事实导致的自然相似”。

门禁规则：

1. 只要存在第三方或获授权参考材料，必须运行扫描。
2. 扫描结果必须由工具产生，不能由调用者自行提交 publishable。
3. 稿件或参考材料内容发生变化，旧扫描立即失效。
4. 高字面重合进入阻断；高语义或结构相似进入人工复核。
5. 必要短引、公共术语和规范引用单独记录，不与未署名复用混为一类。
6. 阈值通过真实中文自媒体评测集校准，不将内部风险阈值描述为法律标准或平台原创率。

主要修改文件：

- editorial/scripts/originality_scan.py
- editorial/references/originality-review.md
- editorial/skills/media-originality-review/SKILL.md
- src/domain.ts
- src/server.ts
- src/tools 下新增 originality 工具
- schemas 下新增原创证据 Schema
- tests 下新增扫描器与 readiness 集成测试

### 阶段 4：完整性任务链和精确内容、渲染版本审批

目标：借鉴 Wagtail 和 Decap，将审核绑定到确切稿件版本和用户实际看到的确切 HTML 渲染版本。

任务链：

~~~text
reference-rights-check
→ research-evidence-check
→ originality-scan
→ human-editor-review
→ delivery-render
→ delivery-verify
→ approval(contentHash + renderManifestHash)
~~~

规则：

1. 所有任务都完成才允许 ready。
2. 最终审批同时绑定 `contentHash`、`articleDocHash`、`revisionId`、`renderManifestHash`、HTML 产物哈希、Markdown 产物哈希、渲染器版本、模板版本、样式策略版本和净化策略版本。
3. 任何内容修改使研究审核、原创扫描、双格式渲染、视觉验证和人工审批失效。
4. 内容版本与操作事件分开保存。
5. 操作事件记录 actor、时间、动作、输入参考哈希、工具或技能版本和证据摘要。
6. 发布只能使用最后获批 revision 及其对应的已验证渲染产物，`publish.package` 不得在审批后自由重新渲染。

失效矩阵：

| 变更类型 | 必须失效的结果 |
|---|---|
| 标题、正文、主张、引用或来源变化 | 研究复核、原创扫描、双格式渲染、视觉验证和审批 |
| 图片、图注或资产变化 | 资产权利检查、双格式渲染、视觉验证和审批 |
| 仅模板、CSS 或设计令牌变化 | HTML 渲染、视觉验证和审批；内容研究与原创扫描可保留 |
| renderer、render profile 或净化策略升级 | 旧 artifact 标记 stale，重新渲染、安全验证和审批 |

### 阶段 5：HTML 主交付、Markdown 备份与白底视觉门禁

目标：将“默认给用户精致 HTML，同时留存 Markdown 备份”从文件命名偏好升级为数据契约、工具行为和发布门禁。

新增正式工具：

~~~text
mediaops.delivery.render
mediaops.delivery.verify
~~~

`mediaops.delivery.render` 仅接收已保存的 `contentId/revisionId`，不接收临时正文字符串；该工具将同一 `ArticleDoc` 同时渲染为 HTML 主产物和 Markdown 备份。`mediaops.delivery.verify` 检查双产物对等性、安全、HTML 合法性、语义、可访问性、白底和视觉回归，并产生可审计报告。

#### 5.1 渲染流水线

~~~text
ArticleDoc / 受约束 Markdown 输入
→ UTF-8 + LF + Unicode NFC 规范化
→ remark-parse + remark-gfm
→ AST 结构校验（禁止正文 h1 和原始 HTML）
→ remark-rehype（allowDangerousHtml: false）
→ 注入受信任的文章语义、图注、引用、来源和披露
→ rehype-sanitize 自定义白名单
→ web 完整页渲染
→ 可选 wechat-richtext 受信任 CSS inlining
→ 最终标签、属性、URL 协议和 CSS 属性白名单验证
→ 语义对等检查
→ 写入 HTML、Markdown、render manifest 和资产映射
~~~

安全规则：

1. 默认不允许 Markdown 内嵌原始 HTML，不引入 `rehype-raw`。
2. 链接只允许 `https:`、`http:` 和明确允许的 `mailto:`；拒绝 `javascript:`、`vbscript:`、协议相对 URL 和非白名单 `data:`。
3. 图片只允许已登记、已确认权利且经 MIME 校验的包内本地资产，或经明确策略允许的 HTTPS 资产；默认不加载远程跟踪像素、临时签名 URL 或未验证 SVG。
4. 禁止 `script`、事件属性、`iframe`、`object`、`embed`、`form`、`meta refresh`、远程 CSS、`@import`、远程字体和未经允许的 CSS `url()`。
5. 完整页不包含脚本；使用严格 CSP 或等价本地安全策略，资产尽量包内化，不依赖网络即可阅读。
6. 插件不得把 HTML 直接注入 Codex 或其他主应用的非沙箱 DOM；默认以可打开的本地 HTML 产物或沙箱预览向用户呈现。

#### 5.2 渲染档案

| 档案 | 用途 | 硬性边界 |
|---|---|---|
| `web@1` | 默认 `article.html` 主交付和本地预览 | 完整 HTML5 语义页，嵌入受信任样式，无脚本、无远程字体、明确白底 |
| `wechat-richtext@1` | 微信富文本复制或草稿接口的正文片段 | 关键样式内联，仅保留平台允许标签/属性，图片先上传并替换为平台可用 URL；不取代 web 主交付物 |
| `print@1` | 浏览器打印/PDF | 白底黑字，移除阴影和操作元素，控制标题、图片、引用和表格分页 |
| `markdown-backup@1` | `article.md` 备份 | 保留标题、段落、层级、引用、列表、图片 alt/图注、来源和披露；不要求视觉布局与 HTML 一致 |

0.4.0 首先实施 `web@1`、`wechat-richtext@1` 和 `markdown-backup@1`；邮件应使用独立渲染器，不将普通网页 HTML 直接冒充为邮件模板。

#### 5.3 `editorial-white@1` 白底编辑主题

0.4.0 只发布一个默认主题 `editorial-white@1`。页面、文章、标题区、引用区、来源区和打印背景均使用 `#FFFFFF`；不提供暗色主题，不使用大面积渐变、背景图或彩色卡片。层级主要通过字号、字重、留白、细分隔线和单一强调色建立。

建议设计令牌：

| 令牌 | 建议值 | 用途 |
|---|---:|---|
| `pageBackground` / `surfaceBackground` | `#FFFFFF` | `html/body/main/article` 及各内容区的唯一基础底色 |
| `textPrimary` | `#262626` | 正文，对白底对比度约 15.13:1 |
| `textSecondary` | `#57606A` | 摘要、图注和次要信息，对比度约 6.39:1 |
| `accent` | `#0F766E` | H2 边线、引用边线和少量强调，对比度约 5.47:1 |
| `link` | `#0B57D0` | 链接，对比度约 6.39:1，同时保留下划线 |
| `borderStrong` | `#8A94A3` | 承担语义分隔时使用，对白底约 3.07:1 |
| `contentMaxWidth` | `680px` | 桌面端约 40 个 17px 全角汉字一行 |
| `bodyFont` | `17px / 1.85` | 桌面正文；移动端可降为 `16px / 1.8` |
| `title` | `32px / 1.25 / 700` | 唯一 H1；移动端 `28px` |
| `heading2` | `24px / 1.4 / 700` | 主章节；移动端 `22px` |
| `heading3` | `20px / 1.5 / 650` | 子章节 |
| `paragraphGap` | `1.25em` | 数字阅读使用段间距，默认不做首行缩进 |
| `spaceScale` | `4/8/12/16/24/32/48/64px` | 所有外边距和内边距只从该阶梯取值 |

字体栈使用本地系统字体：

~~~css
-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
"Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif
~~~

不从网络加载字体，避免隐私、断网、许可证和排版漂移问题。任何品牌强调色覆盖都必须先通过对比度校验，且不得改变白底约束。

#### 5.4 标题、段落与内容元素排版规则

1. 页面使用 `lang="zh-CN"`，若内容语言不同则从 `contentLanguage` 正确渲染，不得硬编码为英文。
2. 使用 `main > article > header + article-body + footer` 语义骨架；每篇文章恰好一个 H1，正文只使用 H2–H4，不跳级。
3. 标题区可包含栏目、H1、副标题/导语、作者和 `time[datetime]`；未有数据的元素不伪造、不留空占位。
4. 正文左对齐，不强制两端对齐；使用 `line-break: strict`、`word-break: normal` 和针对长 URL/代码的受控 `overflow-wrap`，避免中文标点和长链接破坏页面。
5. 段落之间使用稳定段距，不通过连续 `<br>` 或空段落撑开间距。
6. `blockquote` 保持白底，使用强调色左边线、缩进和明确 `cite`；不依靠斜体表达引用层级。
7. 有序/无序列表保留语义标记和稳定项间距；不使用手工符号冒充列表。
8. 表格必须有表头；移动端只允许表格容器局部水平滚动，不允许整页溢出。
9. 代码块使用白底、可见边框和局部滚动；默认不引入重型高亮引擎，仅在代码型文章中按需开启。
10. 图片使用 `figure > img/picture + figcaption`；非装饰图必须有有意义的 `alt`、固有宽高和来源/图注，图片 `max-width: 100%`、`height: auto`。
11. 正文中的证据标记与页尾“信息来源”有序列表双向关联；来源区至少显示标题、发布者、日期和安全链接，不只堆砌裸 URL。
12. 商业合作、AI 辅助或其他要求的披露放在语义化页尾，不使用低对比度小字隐藏。

建议 HTML 骨架：

~~~html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>文章标题</title>
  <style>/* editorial-white@1 受信任样式 */</style>
</head>
<body>
  <main class="article-shell">
    <article class="media-article" data-content-id="..." data-revision-id="...">
      <header class="article-header">
        <h1>文章标题</h1>
        <p class="article-deck">副标题或导语</p>
        <p class="article-meta"><time datetime="2026-07-15">2026年7月15日</time></p>
      </header>
      <div class="article-body"><!-- 受控内容区块 --></div>
      <footer class="article-footer">
        <section class="article-sources" aria-labelledby="sources-title">
          <h2 id="sources-title">信息来源</h2>
          <ol><!-- 结构化来源 --></ol>
        </section>
      </footer>
    </article>
  </main>
</body>
</html>
~~~

#### 5.5 确定性、对等性和视觉验证

1. 相同 `ArticleDoc`、资产映射、渲染档案、主题、渲染器版本和依赖锁必须产生字节级一致 HTML。
2. HTML 正文中不写入随机 UUID、当前时间、环境绝对路径或远程响应内容；这些审计信息放入外层 render manifest。
3. 标题 ID、脚注 ID、来源编号、属性顺序和 CSS 声明顺序稳定生成。
4. HTML 和 Markdown 都回解为规范化语义树，对比标题、段落、层级、引用、列表、图片、图注、来源和披露顺序，而不是粗暴比较纯文本字节。
5. 使用 Nu HTML Checker 做 HTML 合法性检查，使用 axe-core 做可自动化的 WCAG 2.2 A/AA 检查，并保留人工可读性与中文排版审核。
6. 使用 Playwright 在 320、375、768 和 1440 CSS px 视口保存 golden screenshots；像素级快照固定 Chromium 版本、操作系统镜像和测试字体，macOS/Linux 另做真实系统字体栈下的布局冒烟测试。所有环境中整页均不得水平溢出，文字不得裁切或重叠。
7. 分别以系统亮色和暗色偏好渲染，`html/body/main/article` 计算背景色均必须为 `rgb(255, 255, 255)`；不使用 `forced-color-adjust: none` 破坏用户的高对比度辅助模式。
8. 注入 WCAG 文本间距测试样式（行高 1.5 倍、段后 2 倍字号、字距 0.12em、词距 0.16em）后，内容不得丢失、重叠或裁切。
9. A4/Letter 打印预览保持白底、无外壳阴影、无孤立页底标题，可容纳的图片、引用和表格不被不合理拆分。
10. 同一输入连续渲染 100 次必须字节一致；在目标 Bun 版本及 macOS/Linux 上执行确定性、布局冒烟和恶意样本测试，不要求不同系统字体的像素图必须完全一致。

建议停止码：

~~~text
DELIVERY_RENDER_REQUIRED
DELIVERY_RENDER_FAILED
DELIVERY_PARITY_FAILED
DELIVERY_SECURITY_BLOCKED
DELIVERY_HTML_INVALID
DELIVERY_SEMANTICS_INVALID
DELIVERY_ACCESSIBILITY_FAILED
DELIVERY_VISUAL_REVIEW_REQUIRED
DELIVERY_STYLE_POLICY_VIOLATION
DELIVERY_ARTIFACT_STALE
~~~

主要修改文件：

- src/domain.ts
- src/markdown.ts（替换极简正则渲染器）
- src/tools/preview.ts
- src/tools/package.ts
- src/tools/readiness.ts
- src/server.ts
- src/rendering 下新增 ArticleDoc、renderer、profile、sanitizer 和 parity 模块
- src/tools 下新增 delivery render/verify 工具
- schemas 下新增 ArticleDoc、DeliveryManifest 和 DeliveryArtifact Schema
- themes/editorial-white 下新增版本化设计令牌和样式
- tests 下新增渲染、安全、对等、响应式、可访问性和视觉回归测试
- platform-delivery/references/publish-runbook.md
- docs/legal/THIRD_PARTY_NOTICES.md 和 SBOM

### 阶段 6：渠道适配与可靠发布

目标：在编辑完整性门禁完成后，再增强多渠道运营能力。

建议 ProviderAdapter 契约：

~~~text
capabilities
payloadSchema
validate
preview
publish
refreshToken
fetchReceipt
~~~

规则：

1. 一个获批 `ArticleDoc + DeliveryManifest` 派生多个平台版本，不直接修改已批准 `article.html`。
2. 每个平台版本保存 `parentContentHash`、`parentRenderManifestHash`、`renderProfile` 和 `channelDiff`。
3. 平台适配不得改变核心事实或引入未经核验的新主张。
4. 浏览器完整页、微信富文本、邮件和打印使用独立 render profile；不承诺“同一份 HTML 跨渠道像素级一致”，只保证内容和关键层级不丢失。
5. 平台对 HTML/CSS 进行二次清洗时，应保存实际草稿 DOM 摘要和截图用于渠道回归，但不将平台返回内容反写为 canonical content。
6. 外部写操作必须有单独人工批准。
7. 使用幂等键、错误分类、指数退避和平台独立队列。
8. 保存平台 postId、响应、发布时间和最终回执。

### 阶段 7：测试、评测与版本发布

必须新增的自动化测试：

- 无研究记录不能保存为 drafted；
- 无引用和无原创证据不能 ready；
- 虚假 URL、404 和不支持结论的网页不能 verified；
- claim 与 citation 未关联不能通过；
- 来源镜像不能计作独立双源；
- 第三方参考材料缺少扫描证据不能通过；
- 修改一个字符后旧扫描和审批失效；
- 同义替换和结构复刻能够触发风险；
- 用户自有稿和规范引用可以通过；
- 相同主题但独立结构不会产生不可接受的误报；
- 联网失败和零结果返回 action_required，而不是 ok。
- 默认工具结果将 HTML 标记为 primary artifact，Markdown 标记为 backup artifact；
- HTML 和 Markdown 与同一 `ArticleDoc/contentHash/revisionId` 绑定，标题、段落、引用、列表、图片、图注、来源和披露语义对等；
- CommonMark/GFM 的嵌套列表、引用、表格、代码围栏、脚注、Emoji、转义和 CRLF 样本渲染不丢失语义；
- 正文恰好一个 H1，标题层级不跳级，`lang`、`main/article`、`figure/figcaption`、`time[datetime]` 等结构正确；
- `script`、事件属性、危险 URL、恶意 SVG/MathML、`iframe/srcdoc`、DOM clobbering、CSS `url()`/`@import` 和畸形标签样本被阻断；
- Nu HTML Checker 错误为 0，axe-core WCAG 2.2 A/AA 自动规则无未处理 violation；
- 亮色和暗色系统偏好下，`html/body/main/article` 计算背景均为 `#FFFFFF`；
- 320、375、768、1440 CSS px 下无整页水平滚动、文字裁切或重叠，表格和代码只在自身容器局部滚动；
- 文本间距覆盖、200% 缩放、A4/Letter 打印和图片响应式测试通过；
- 相同输入连续渲染 100 次字节一致，未出现随机 ID、当前时间或环境路径漂移；
- 修改正文、图片、模板、样式策略、renderer 或 sanitizer 后，相应的 artifact 和审批按失效矩阵正确失效；
- `publish.package` 只复用已验证、已获批的产物，不在审批后临时重新渲染。

行为评测：

1. 当前 0.3.0 与新版在同一轮生成真实产物。
2. 对事实准确性、来源支持、独立观点、表达复用、结构复刻、HTML 阅读质量、中文排版、白底一致性和移动端可读性分别评分。
3. 进行隐藏版本的人工盲评。
4. 保存 grading、benchmark、timing、eval metadata 和失败样本。
5. 所有反轻改、强制联网和 fail-closed 用例必须 100% 通过。
6. 每个渲染 fixture 保存 HTML、Markdown、render manifest、各视口截图、HTML/可访问性报告和人工视觉审核结果。
7. 微信富文本档案需在真实草稿或可等价的隔离测试环境中保存清洗后 DOM 摘要和截图，不仅测试本地 HTML。

版本发布：

1. 目标版本先发布为 0.4.0-rc1。
2. 统一更新 manifest、package、marketplace、运行时 VERSION、工具包版本、README 和 capabilities。capabilities 必须新增 `defaultDeliveryFormat=html`、`backupFormat=markdown`、`rendererVersion`、`renderProfiles`、`templateVersion`、`stylePolicyVersion` 和 `sanitizationPolicyVersion`。
3. 校验器必须比较所有实际版本源，而不是只比较三个清单。
4. 校验 Zod Schema 与 JSON Schema 一致性，并比对 ArticleDoc、DeliveryManifest、DeliveryArtifact 和渲染档案契约。
5. 刷新插件缓存并重新安装。
6. 验证 installed_plugins.json 已指向 0.4.0。
7. 在实际安装目录再次执行行为评测、HTML 安全测试和视觉回归，防止只验证工作区源码。
8. 将 renderer、主题、净化策略、开源依赖版本和许可证写入 SBOM 与 THIRD_PARTY_NOTICES。

## 六、验收矩阵

| 验收场景 | 预期结果 |
|---|---|
| 提供第三方文章并要求“照着改” | 默认归类为第三方参考；抽取线索后隔离原文；不得直接逐段改写 |
| 第三方参考未声明权利和用途 | 停止，返回 REFERENCE_RIGHTS_REQUIRED |
| 当前事件但无联网能力 | 只能输出待补证提纲，不得输出可发布稿 |
| 搜索零结果或来源打不开 | 返回 action_required，不得继续自报研究完成 |
| 核心主张只有用户参考文章一条来源 | 不满足独立来源要求 |
| URL 存在但内容不支持主张 | 主张不能标记为 verified |
| 两个网站转载同一新闻稿 | 只计为一个 independenceGroup |
| 同义替换但段落和论证路径一致 | 触发语义或结构风险，进入 changes_required |
| 大段精确重合且无规范引用 | 阻断发布 |
| 规范短引并注明作者和作品 | 记录为 attributed quotation，不按未署名复用处理 |
| 稿件修改后沿用旧扫描结果 | readiness 拒绝，要求重新扫描和审批 |
| 调用者自行提交 publishable | readiness 拒绝，必须存在工具生成的扫描证据 |
| 用户自有稿正常润色 | 在事实核验完成后允许通过，不被第三方防火墙误拦 |
| 相同主题但独立观点和结构 | 不应因主题相似直接判高风险 |
| 发布后需要追溯 | 能定位获批 revision、来源包、扫描结果、操作者和平台回执 |
| 用户只要求“给我成稿” | 首先交付可打开的 `article.html`，同时提供标记为备份的 `article.md` |
| HTML 与 Markdown 来自不同 revision 或内容哈希 | 返回 `DELIVERY_PARITY_FAILED`，不允许 `DELIVERY_READY` |
| HTML 中少了段落、来源、图注或披露 | 语义对等检查失败，阻断最终交付和审批 |
| Markdown 正文内再写一个 H1 | 规范化阶段拒绝或受控降级为 H2，最终 HTML 恰好一个 H1 |
| 输入原始 HTML、`javascript:` 链接或恶意 SVG | 原始 HTML 文本化或拒绝，危险协议/资产阻断，返回 `DELIVERY_SECURITY_BLOCKED` |
| 系统切换为暗色偏好 | 插件生成页面仍为明确 `#FFFFFF` 白底和高对比度正文 |
| 320/375px 手机视口 | 无整页水平滚动、遮挡、重叠或裁切；表格和代码可在自身容器滚动 |
| 文章含图片 | 使用 `figure/figcaption`，非装饰图有 alt、宽高、来源和资产哈希，不加载未批准远程跟踪图 |
| 模板/CSS 变化但正文未变 | 保留研究与原创结果，但 HTML artifact、视觉验证和最终审批失效 |
| renderer 或 sanitizer 版本变化 | 旧渲染产物标记 stale，重新渲染、安全验证和审批 |
| HTML 渲染失败 | 保留 Markdown 排障备份，但返回 action_required，不宣称最终交付完成 |
| 发布包移动到其他目录或断网打开 | HTML 仍能使用包内资产完整阅读，不依赖远程 CSS、字体或脚本 |
| 复制到微信富文本 | 使用 `wechat-richtext` 档案，标题、段落、列表、引用、链接、图片和来源层级在平台清洗后仍可读 |

## 七、实施优先级

### P0：立即实施

1. 真实评测基线。
2. 参考材料角色与权利分类。
3. clean-room 写作隔离。
4. 单篇创作强制联网研究。
5. 主张与证据绑定。
6. 工具生成的原创证据。
7. readiness fail-closed。
8. 修复 HTML 中的危险 URL、原始 HTML/CSS 注入、远程跟踪资源和非沙箱展示风险。

### P1：紧随 P0

1. MinHash/LSH 近重复候选召回。
2. 句段级语义相似和结构对齐。
3. Zotero 式来源记录、快照和去重。
4. 完整性任务链、精确 content + render 审批和审计日志。
5. `ArticleDoc`、HTML 主交付、Markdown 备份、DeliveryManifest 和语义对等检查。
6. `editorial-white@1` 白底主题、中文排版、响应式、可访问性、打印和视觉回归。
7. `web@1`、`wechat-richtext@1` 和 `markdown-backup@1` 渲染档案，并将内容哈希与渲染哈希共同绑定到审批。

上述 P1 呈现层工作是 0.4.0 正式版发布阻断项，不得以“已有一个能打开的 HTML 文件”代替。

### P2：后续增强

1. 多渠道 ProviderAdapter。
2. 持久化发布、幂等、重试和平台回执。
3. 来源变化监控和证据过期。
4. C2PA 资产来源凭证。
5. 邮件/MJML 等独立渲染档案和更多平台富文本实测适配。

## 八、许可证与安全边界

1. 优先直接采用 MIT、BSD-3-Clause 和 Apache-2.0 的轻量算法或组件，并建立 SBOM。
2. Zotero、Postiz、RSSHub 等 AGPL 项目原则上只借鉴机制或通过边界清晰的可选集成使用；复制或网络部署前应单独评估许可证义务。
3. Sentence Transformers 框架许可证不等于具体模型权重许可证，必须锁定模型 revision、哈希、推理参数和模型卡。
4. 未发布稿件和第三方参考全文默认不得发送至外部 embedding 服务。
5. 网页抓取需要防范 prompt injection、SSRF、恶意页面、登录凭据泄露和隐私问题。
6. 保存网页快照不代表取得内容再利用权，需定义存储期限、访问权限和删除机制。
7. 相似性算法只能产生风险证据，不能自动形成版权侵权或原创性的法律结论。
8. unified/remark/rehype、rehype-sanitize 和 Juice 可在许可证、Bun 兼容、依赖漏洞与 SBOM 复核后按需引入；不因顶层为 MIT 就跳过传递依赖审计。
9. doocs/md 使用非常规 WTFPL，WordPress 主体为 GPL；本轮只吸收即时预览、设计令牌和富文本档案思路，若后续复用代码或主题素材必须重新进行许可证与来源审查。
10. HTML 净化必须分别覆盖 HTML body、attribute、URL 和 CSS 上下文；不得只做字符转义后就认定安全。净化后若再经 CSS inlining 或其他 HTML 改写，必须重新进行最终白名单检查。
11. 参考文章的 HTML、CSS、图片热链、脚本、类名和嵌入物不得沿用到产出；参考材料先转为纯文本事实线索与禁止复现特征。
12. 主题 CSS 只能由版本化设计令牌编译产生，不接收模型或用户自由 CSS；禁止远程样式、字体、跟踪像素和可执行嵌入内容。
13. 本地 HTML 预览应无脚本、包内资产化并在沙箱或独立文档中打开；不将未信任 HTML 注入宿主应用 DOM。
14. 图片、字体和主题素材的权利记录与内容引用分开管理；“网页可访问”不等于“资产可打包或再发布”。
15. 白底是插件产物的设计策略，不应通过 `forced-color-adjust: none` 阻止操作系统的高对比度辅助模式。

## 九、推荐实施顺序

推荐按以下顺序执行：

~~~text
真实基线与失败样本
→ 参考材料防火墙
→ 强制联网研究
→ 主张—证据数据契约
→ 原创扫描工具与版本绑定
→ readiness 硬门禁
→ ArticleDoc 与双格式交付契约
→ 安全白底 HTML 渲染和 Markdown 备份
→ 内容对等、语义、可访问性和视觉回归
→ 精确 content + render 审批
→ 真实 A/B 与视觉评测
→ 0.4.0-rc1 安装验证
→ 0.4.0 正式发布
→ 多渠道运营增强
~~~

第一批实施应先封住用户已经遇到的风险路径，不应让排期、渠道扩展或图片来源能力延迟参考稿隔离、联网核验和原创证据门禁。在 P0 编辑完整性修复达标后，HTML 主交付、Markdown 备份、统一白底和视觉门禁必须在 0.4.0 正式发布前一并完成。

## 十、官方规范参考

- 《中华人民共和国著作权法》：https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html
- 国家版权局关于规范网络转载版权秩序的通知：https://www.ncac.gov.cn/xxfb/tzgg/201504/t20150422_50363.html
- 《互联网用户公众账号信息服务管理规定》：https://www.cac.gov.cn/2021-01/22/c_1612887880656609.htm
- CommonMark 0.31.2：https://spec.commonmark.org/0.31.2/
- WHATWG HTML Living Standard：https://html.spec.whatwg.org/multipage/
- W3C《中文排版需求》：https://www.w3.org/TR/clreq/
- W3C WCAG 2.2：https://www.w3.org/TR/WCAG22/
- W3C CSS Text Module Level 3：https://www.w3.org/TR/css-text-3/
- W3C CSS Color Adjustment Module Level 1：https://www.w3.org/TR/css-color-adjust-1/
- W3C CSS Paged Media Module Level 3：https://www.w3.org/TR/css-page-3/
- W3C Clipboard API：https://www.w3.org/TR/clipboard-apis/
- OWASP Cross Site Scripting Prevention Cheat Sheet：https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- 微信开放文档—新增草稿：https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add
