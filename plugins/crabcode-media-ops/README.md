# crabcode-media-ops 0.4.0-rc1

可审计的新媒体运营插件：参考材料防火墙、联网可信来源研究、独立原创风险复核、创作者风格管理、精排白底 HTML 交付、人工审批与冻结发布包。

## 0.4 核心修复

- 第三方参考先分类角色、权利和允许用途；原文留在受保护集合，写作者只获得结构化研究包与不可复制清单。
- 首版只能是 `intake`，内容每次最多推进一级；`content.save` 不再接受调用方自报的事实、原创、法律或“可发布”结论。
- 联网研究先由 `research.capture` 真实打开页面并生成受限、哈希绑定的服务端快照，再记录搜索日志、来源层级/独立组、主张—证据链接、反证与缺口；调用方自报 URL/HTTP 状态/快照无效，零结果保持 `action_required`。
- 原创工具绑定最终正文与参考字节，结合多尺度字面、覆盖率、段落和结构风险；高重合不可人工覆盖，第三方样本必须独立人工判断语义/结构。
- 统一 ArticleDoc 同时生成精排白底 HTML 主产物、Markdown 备份和微信富文本档案；只允许冻结本地图片，不加载远程字体、脚本或跟踪图。
- 审批发生在交付物生成和验证之后，同时绑定 content、ArticleDoc、DeliveryManifest、HTML/Markdown/平台产物及素材字节哈希；package 只复制冻结候选，不重渲染。
- JSONL 遇到坏行、断链或内容哈希不一致时 fail-closed，不再回退到较旧的 approved/稿件。
- 随包生成 CycloneDX 1.5 `docs/legal/SBOM.cdx.json`；`bun run validate` 会检查其与锁文件、直接依赖和 Hono 安全固定版本同步。

## 技能与确定性工具

九个技能保持不变：`media-ops`、`media-topic-research`、`media-human-editor`、`wechat-original-opinion`、`media-originality-review`、`media-style-intake`、`media-style-manager`、`media-platform-adapter`、`media-publish-gate`。

0.4 新增的关键工具：

- `mediaops.reference.register/get_metadata`
- `mediaops.research.capture/complete`
- `mediaops.originality.scan/review`
- `mediaops.editorial.review`
- `mediaops.delivery.render/verify`

`media-ops` 负责完整、多阶段或多平台编排；单篇公众号观点稿仍由 `wechat-original-opinion` 路由，但也必须遵守参考隔离、研究和原创门禁。

## 标准状态与发布顺序

```text
reference.register
  → intake → WebSearch → research.capture → research.complete → researched
  → fresh-context 写作 → drafted → 人工编辑
  → originality.scan（必要时 originality.review）
  → editorial.review → reviewed
  → delivery.render → 多视口/打印检查 → delivery.verify
  → readiness → approval.request/decide → publish.package
```

默认向用户呈现 `article.html`：单一 H1、语义化 H2–H4、明确标题/摘要/正文/来源/披露层级、响应式排版、打印样式、系统字体和所有表面 `#FFFFFF`。`article.md` 是同一 ArticleDoc 的可追溯备份；`wechat-richtext.html` 是平台档案，不能替代 HTML 主交付。

任何改稿、研究/参考变化、素材换字节、模板/依赖变化或交付物篡改都会使相应门禁失效。pending、rejected、revoked、stale、坏存储或完整性失败均返回明确停止码。

## 创作者风格表单

`/media-style-collect --brand <brandId> --mode quick|full|incremental` 提供快速、完整、增量三种模式，并支持草稿、恢复、提交、冲突确认、版本历史和回滚。历史样本只以 referenceId、权利/允许用途和抽象特征进入表单/profile；原文不进入写作上下文。

用户数据按 brandId 保存在 `${CRABCODE_PLUGIN_DATA}`。运行时建议显式设置 `MEDIAOPS_DATA_DIR` 和 `MEDIAOPS_ASSET_ROOT`；未设置数据目录时只使用不持久的临时目录并返回警告。

## AI 披露与平台边界

插件记录 `platform-native`、`body-label`、`file-metadata` 三种实际方式。AI 辅助内容必须确认至少一种方式和确认人，但不把固定正文句子描述为所有平台唯一法定形式。参见 `references/ai-labeling-compliance.md`。

本版本仍为 Gate A：本地研究证据、写作、审校、渲染、预览、审批和人工发布包可用；真实平台 API、浏览器最终发布、自动评论、全网查重和平台原创声明保证不提供。`0.4.0-rc1` 只有在真实安装目录和真实平台编辑器完成渠道回归后才应晋升正式版。

Gate A 的 `savedBy/completedBy/reviewedBy/approvedBy` 是经过规范化比较的具名声明，不是已认证账号；本地调用者仍可能冒用姓名。WebSearch 的查询和结果数是调用方记录，服务端可证明的是每个 `captureId` 对应页面确实在受限网络策略下打开并绑定了响应字节。`delivery.verify` 会自动复验字节、安全和语义断言，但多视口、打印和可读性结论来自具名视觉验收记录，并非运行时自动启动浏览器或完整 WCAG 认证。跨人强审批必须在 Gate B 由宿主注入不可伪造 principal/role。

已知残余边界：默认 `fetch` 不能把 DNS 解析结果钉死到连接地址，极端 DNS rebinding 仍需宿主代理/出站防火墙防护；RC 只采集文本/HTML/XML/JSON，不采集 PDF；近似改写的同源转载只能由人工继续识别；JSONL 与原子 head 文件处于同一本地信任域，多进程写入或具有完整文件改写权限的攻击者需要事务数据库和外部签名日志。

## 验证

```bash
bun install --frozen-lockfile
bun run validate
bun run typecheck
bun test
bun run build
```

根仓库还需运行其校验命令。许可证为 Apache-2.0；分发依赖和设计参考见 `docs/legal/THIRD_PARTY_NOTICES.md`。
