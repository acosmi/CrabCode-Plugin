# crabcode-media-ops 0.4.1

可审计的新媒体运营插件：参考材料防火墙、联网可信来源研究、独立原创风险复核、创作者风格管理、精排白底 HTML 交付、可信身份约束的审批，以及冻结发布包。

## 0.4.1 变更（MCP 可用性修复）

- **生命周期声明**：manifest 增加 `requiredMcpServers: ["mediaops"]`，CrabCode ≥1.0.16 安装后自动激活本地 sidecar；用户显式 disable 始终优先。旧宿主上退化为 inactive，不崩溃。
- **自包含发行物**：`.mcp.json` 直接执行入库的 `dist/server.js`（`bun --no-env-file`），启动不再执行任何安装步骤，离线冷启动实测亚秒到 2 秒完成 initialize/tools/list。Playwright/axe/vnu 为交付 QA 的惰性可选依赖，缺失时基础 MCP 全量可用、`delivery.verify` full 模式返回 `DEPENDENCY_NOT_READY`（static 模式始终可用）。`bun run check:distribution` 校验发行物新鲜度并做清洁目录冷启动 smoke。
- **身份模式**：`mcp_oauth`（team-governed，多真人主体）之外新增 `MEDIAOPS_IDENTITY_MODE=local-editorial`——单一可信本地用户（`local_editorial` 低保证），确定性机器操作（`originality.scan`、`delivery.render`、`content.save` 的 `serviceImport:true` 机械 intake 导入）由 `mediaops-server:service`（`service_account`）执行；`originality.review`、`editorial.review`、`approval.decide`、`profile.confirm` 等第二真人门禁保持 pending，绝不伪造多人治理。env 配置角色出现 `*` 通配将被直接拒绝。
- **运行前预检**：`media-core/PRACTICE.md` 定义统一 preflight 与停止码（`MCP_INACTIVE`/`MCP_START_FAILED`/`MCP_TOOL_UNDISCOVERABLE`/`AUTHENTICATION_REQUIRED`/`ROLE_REQUIRED`/`DEPENDENCY_NOT_READY`/`GATE_NOT_EXECUTED`）；`mediaops.capabilities` 报告身份模式与停止码清单，`mediaops.doctor` 报告发行物、重依赖探测与逐工具阶段 readiness。报告中显示已完成的阶段必须附服务端权威 ID/哈希。
- **编排边界**：子代理只返回结构化数据，全部 `mediaops.*` 状态调用由主线程执行并由 validator 强制（agents 文档不得直接引用 mediaops 工具）。
- **文件稿导入链**：本地 Markdown 经 `content.save`(intake) → `reference.register` → `research.capture/complete` → drafted → `originality.scan(contentId)` 进入治理；扫描不接受文件路径。
- 存储 schema 不变（SQLite 结构与 `SCHEMA_VERSION=2` 均未动）；assurance 枚举为加法扩宽，0.4.0 回退对新身份模式记录 fail-closed，不会把未完成门禁显示为完成。

## 0.4 核心能力

- 第三方参考先分类角色、权利和允许用途；原文留在受保护集合，写作者只获得结构化研究包与不可复制清单。
- 首版只能是 `intake`，内容每次最多推进一级；`content.save` 不接受调用方自报的事实、原创、法律或“可发布”结论。
- `research.capture` 在每次请求和跳转前解析全部地址，只允许公网地址，并直接拨号已核验的数字地址，同时保留原 Host/SNI；页面响应形成带地址、字节和文本哈希的服务端快照。
- `research.complete` 不接受调用方直接填写 `sourceTier`、`isPrimary` 或 `originPublisher`。每个来源必须提交与快照片段绑定的 `assessment`，服务端据此推导来源等级，并按组织域、责任发布者、同页、相同快照和近似内容合并独立来源组。
- `editorial.review` 对标题、摘要、正文、引文元数据、图片 alt/图注和披露中的全部可见句子建立确定性 statement ledger；逐项分类为 `verified_fact`、`author_inference`、`opinion` 或 `non_claim`。事实/推论必须映射已核验主张并确认方向，推论还必须带显式标记；观点和非主张不得伪挂事实证据。
- 原创工具绑定最终正文与参考字节，结合多尺度字面、覆盖率、段落和结构风险；高重合不可人工覆盖，第三方样本必须独立复核语义与结构。
- 统一 ArticleDoc 同时生成精排白底 HTML 主产物、Markdown 备份和微信富文本档案；只允许冻结本地图片，不加载远程字体、脚本或跟踪图。
- `delivery.verify` 对确切 HTML 字节自动执行 Nu Html Checker、Playwright/Chromium、axe-core、多视口浅色/深色、文本间距、200% 字号及 A4/Letter 打印检查；报告、截图和 PDF 均以 SHA-256 绑定到 DeliveryManifest。自动检查之外仍要求独立视觉复核人确认可读性。
- 审批发生在交付物生成和验证之后，同时绑定 content、ArticleDoc、DeliveryManifest、HTML/Markdown/平台产物、QA 证据及素材字节哈希；package 只复制冻结候选，不重渲染。
- 工作流与审计记录使用 SQLite WAL 事务、`FULL` 同步、哈希链、实体 CAS 和短期租约；旧 JSONL 只有在整链验证通过后才会一次性导入，坏行、断链或尾部截断均 fail-closed。
- 随包生成 CycloneDX 1.5 `docs/legal/SBOM.cdx.json`；`bun run validate` 检查其与锁文件、直接依赖和安全固定版本同步。

## 技能与确定性工具

九个技能：`media-ops`、`media-topic-research`、`media-human-editor`、`wechat-original-opinion`、`media-originality-review`、`media-style-intake`、`media-style-manager`、`media-platform-adapter`、`media-publish-gate`。

0.4 的关键工具：

- `mediaops.reference.register/get_metadata`
- `mediaops.research.capture/complete/get`
- `mediaops.originality.scan/review`
- `mediaops.editorial.review`
- `mediaops.delivery.render/verify`

`media-ops` 负责完整、多阶段或多平台编排；单篇公众号观点稿由 `wechat-original-opinion` 路由，但同样必须遵守参考隔离、联网研究、陈述覆盖和原创门禁。

## 标准状态与发布顺序

```text
reference.register
  → intake → WebSearch → research.capture → research.complete → researched
  → fresh-context 写作 → drafted → 人工编辑
  → originality.scan（必要时 originality.review）
  → editorial.review（全可见句 statement ledger + 四类 coverage）→ reviewed
  → delivery.render → 自动 QA + 独立视觉确认 → delivery.verify
  → readiness → approval.request/decide → publish.package
```

默认向用户呈现 `article.html`：单一 H1、语义化 H2–H4、明确标题/摘要/正文/来源/披露层级、响应式排版、打印样式、系统字体和所有基础表面 `#FFFFFF`。`article.md` 是同一 ArticleDoc 的可追溯备份；`wechat-richtext.html` 是复制到微信编辑器的渠道档案，不能替代 HTML 主交付。

任何改稿、研究/参考变化、素材换字节、模板/依赖变化或交付物篡改都会使相应门禁失效。pending、rejected、revoked、stale、坏存储或完整性失败均返回明确停止码。

## 可信身份与角色分离

所有写入或状态变更工具都拒绝把 `savedBy`、`completedBy`、`reviewedBy`、`approvedBy` 等调用参数当成身份。服务端会用可信上下文中的 `issuer:principalId` 覆盖这些字段，并按工具要求检查角色；没有可信 principal 时返回 `AUTHENTICATION_REQUIRED`，角色不足时返回 `AUTHORIZATION_DENIED`。只读工具仍可在匿名上下文中使用。

支持两种身份来源：

1. `mcp_oauth`：宿主在 MCP `authInfo` 中提供未过期的 subject、issuer，以及 scopes 或 roles。这是多用户部署的首选模式。
2. `host_principal`：受信宿主显式设置 `MEDIAOPS_IDENTITY_MODE=host-principal`、`MEDIAOPS_TRUSTED_PRINCIPAL_ID`、`MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER` 和 `MEDIAOPS_TRUSTED_PRINCIPAL_ROLES`。这是宿主配置断言，不是插件自行完成的登录或强身份认证。

默认 `.mcp.json` 只配置数据目录，不伪造 principal，因此没有宿主身份注入时所有变更操作会安全失败。请求人与批准人、作者与独立核查人等隔离比较的是可信 `issuer:principalId`；一个 host principal 即使拥有多个角色，也不能充当需要不同人的两端。正式多人审批应使用能为每位用户注入不同 subject 的 MCP OAuth 或等价宿主认证。

角色按职责最小授权：`author`、`reference_curator`、`researcher`、`fact_checker`、`originality_scanner`、`originality_reviewer`、`editorial_reviewer`、`renderer`、`delivery_reviewer`、`profile_editor`、`profile_approver`、`approval_requester`、`approver`、`publisher`。服务端也识别 `mediaops:<role>`、`mediaops:*` 和 `*`，但多人生产环境不应以通配角色代替职责隔离。

## 来源与陈述台账输入

`mediaops.research.complete` 的每个来源都需要：

```json
{
  "sourceKey": "regulator-notice",
  "captureId": "服务端生成的 UUID",
  "title": "页面标题",
  "publisher": "责任发布者",
  "assessment": {
    "publisherType": "government",
    "sourceFunction": "original_record",
    "originRelationship": "original",
    "basisExcerpt": "能在 capture 快照中定位的发布者/文件性质依据",
    "classificationRationale": "说明为何该来源承担这一证据功能，至少二十个字符"
  }
}
```

等级与 `independenceGroup` 是输出，不是可自报输入。支持关系还会检查数字、增减方向、实体与动作是否与主张相容；同一组织、责任发布者或近似转载不会因换域名就自动变成独立证据。

一级/权威来源还要求可复验的发布者身份。政府、法院、学术站点只按内置机构域规则识别；其他确需信任的官方域由部署者用 `MEDIAOPS_TRUSTED_SOURCE_HOSTS` 配置逗号分隔的精确主机名或受限子域通配（如 `example.gov.cn`、`*.agency.example.cn`）。精确项不包含子域；通配项只匹配其子域、不匹配裸域，且不接受 `*.example.com` 这类过宽规则。输出保存实际命中的 `publisherIdentityRule`，配置型信任另保存规范化规则集的 SHA-256；错误或过宽配置会使研究保持 `action_required`。域名信任只证明部署者认可该主机，不证明页面内容本身正确，仍须快照、评估和独立证据。

`mediaops.research.complete` 成功后用公开只读工具 `mediaops.research.get(researchId)` 取回完整结构化研究包；写作者和核查者不得依赖进程内部 getter 或从日志猜测服务端生成的 `sourceId`。

`mediaops.editorial.review` 必须提交 `statementCoverage`。推荐先对当前 revision 提交完整 claims/法律/披露数据和空或不完整 coverage；工具以 `action_required` 返回服务端生成的 `statementLedgerHash`、`statements[]` 及每项 `statementId`。核查者为每项可见句选择一种分类：`verified_fact` 需映射状态为 `verified` 的 `claimIds` 并设置 `directionConfirmed: true`；`author_inference` 除此之外还必须提供正文中实际出现的 `inferenceMarker`；`opinion`/`non_claim` 必须保持空 `claimIds`，不得携带事实方向或推论标记。四类都要写具体 `rationale`。调用方不应复制内部哈希算法自行制造 ID；任何可见文本变化都会使 ledger 失效并需重新获取。

## 创作者风格与数据存储

`/media-style-collect --brand <brandId> --mode quick|full|incremental` 提供快速、完整、增量三种模式，并支持草稿、恢复、提交、冲突确认、版本历史和回滚。历史样本只以 referenceId、权利/允许用途和抽象特征进入表单/profile；原文不进入写作上下文。

运行时使用 `${CRABCODE_PLUGIN_DATA}`/`MEDIAOPS_DATA_DIR` 作为持久化根目录；工作流、审计和 profile 权威记录均位于 `mediaops.sqlite`。`profiles/<brandId>/versions/*.json` 与 `current.json` 是提交后原子物化的可移植派生副本，物化失败会告警但不会覆盖已提交的 SQLite 事实源；冻结交付物保留自身字节哈希。建议同时显式设置 `MEDIAOPS_ASSET_ROOT`；未设置数据目录时只使用临时目录并返回非持久化警告。

从 0.3/早期 0.4 候选版升级时，不要手工删除旧 JSONL：首次访问相应集合时会先完整验证旧哈希链并在事务中导入 SQLite。无哈希旧历史默认拒绝；只有已备份并人工接受“迁移前历史无法认证”时，才可为一次迁移临时设置精确值 `MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT=I_ACCEPT_UNVERIFIED_HISTORY`，导入完成立即取消。重建新链只证明导入后的字节连续性，不证明旧历史真实。详见 [`docs/0.4-migration.md`](docs/0.4-migration.md)。

## 自动 QA 与本地验收

已验证的运行组合为 Bun 1.3.11、Java 17+（CI 使用 Java 21）、`vnu-jar` 26.7.15、Playwright 1.61.1、其捆绑 Chromium 149.0.7827.55 与 axe-core 4.12.1。缺少 Java、浏览器或版本不匹配时，`delivery.verify` 明确失败并保留报告，不会降级成手工“通过”。

```bash
bun install --frozen-lockfile
bunx playwright install chromium   # 本机尚无该固定版本浏览器时执行
bun run typecheck
bun run test          # 业务套件：MEDIAOPS_QA_MODE=static，不启 Chromium
bun run test:qa       # 完整 Nu/Playwright 集成测，单并发，timeout 180s
bun run build
bun run qa:release    # golden 夹具 + Playwright CLI workers=1
bun run validate
# 可选：bun run test:all  # test + test:qa + qa:release
```

| 脚本 | 行为 |
|------|------|
| `test` | 业务与门禁逻辑；`createReviewedContent` 默认只 render，需要 verified 的用例走 static 证据 |
| `test:qa` | `MEDIAOPS_QA_MODE=full` 的 1–2 个正向 delivery QA；勿多终端并行 |
| `qa:browser` / `qa:release` | 发布夹具与 golden 截图（darwin/linux 分目录） |

生产路径默认 `MEDIAOPS_QA_MODE` 未设置或为 `full` 时始终跑完整浏览器/Nu QA；仅测试可设 `static`（字节/CSP/H1，不启 Chromium）或 `off`（负例跳过自动 QA）。不要用无限加大 timeout 掩盖并发设计错误。

`bun run qa:release` 会重建固定夹具并与当前操作系统的零像素差 golden 截图比较；动态交付 QA 则为每份实际 HTML 生成 `qa/` 报告、八组视口/配色截图、压力测试截图和两种打印 PDF。安装到真实插件目录后，应在该安装目录运行 `bun run qa:installed`；脚本只认证自身安装根及其依赖，不能拿源码目录的成功冒充安装态成功。

## 平台与合规边界

插件记录 `platform-native`、`body-label`、`file-metadata` 三种实际 AI 披露方式。AI 辅助内容必须确认至少一种方式和确认人，但不把固定正文句子描述为所有平台唯一法定形式。参见 `references/ai-labeling-compliance.md`。

当前提供本地研究证据、写作编排、审校、渲染、自动 QA、可信身份约束的审批和人工发布包；不提供真实平台 API 发布、浏览器最终点击、自动评论、全网查重或平台原创声明保证。真实微信草稿/编辑器回归属于发布前渠道验收，不等于插件具备自动发布能力。

发布包采用可恢复两阶段提交。目录存在 `DO-NOT-PUBLISH.commit-pending` 时绝对不可发布；同一可信 principal 必须按 `action_required.retry` 原参数重试。成功响应的 `recoveryMode` 明确区分 `new`、`resumed`、`idempotent`。数据库已提交但标记清理失败时仍安全停止并可重试；审批/内容在提交前变化会把操作记为 `aborted`，保留或隔离带标记目录用于审计，必须创建新 revision/approval，不能复用。审批一旦绑定已提交 package 即为终态，不能撤销。

残余边界：

- 地址解析与连接已钉到同一核验公网 IP，并对每次跳转重做校验，关闭了实现内的 DNS validate/connect 重绑定窗口；它仍不能替代部署环境的出站代理、防火墙和审计策略。
- 网络采集只接受受限大小的纯文本、HTML/XHTML 和 JSON，不采集一般 XML 或 PDF；PDF 证据必须走另行受控提取流程，在此之前保持 `action_required`。
- 组织域、责任发布者和近似内容聚类降低“换域名转载”伪独立风险，但隐蔽媒体集团关系或大幅改写的同源通稿仍需事实核查者判断。
- SQLite 解决同机多进程事务、CAS 和尾部竞态；数据库、profile 文件和冻结产物仍处于同一本地信任域。拥有完整文件系统改写权限的攻击者不受外部签名日志约束，强对抗场景仍应增加只追加远端审计或签名存证。
- Nu 与 axe 是自动规则检查，不是完整 WCAG 认证；认知可读性、内容正确性、真实平台清洗效果和最终发布决定仍需人工验收。

许可证为 Apache-2.0；分发依赖和设计参考见 `docs/legal/THIRD_PARTY_NOTICES.md`。
