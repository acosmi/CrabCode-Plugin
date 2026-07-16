# 人工发布包运行手册

1. 最终稿通过工具生成的研究、原创和 editorial review 单步晋升 reviewed。
2. `mediaops.delivery.render` 冻结素材字节，从同一 ArticleDoc 生成精排白底 `article.html`（主）、`article.md`（备份）和平台档案。
3. 由与 `renderer` principal 不同、具备 `delivery_reviewer` 角色的可信 principal 提交覆盖 ≤375、≥768、≥1200、打印、白底、可读性和横向溢出的视觉确认，再调用 `mediaops.delivery.verify`。验证器同时对确切 HTML 自动执行 Nu、Playwright/Chromium、axe、320/375/768/1440 浅色/深色、文本间距、200% 字号以及 A4/Letter 打印检查；preview 只复用该 HTML。
4. readiness 复核事实、原创、法律、披露、profile、素材权利、规则时效、交付清单和真实产物字节。
5. `approval_requester` 请求同时绑定 content、ArticleDoc、DeliveryManifest、HTML/Markdown/平台产物及 QA 证据哈希；向批准者展示确切 HTML。请求与决定必须来自可信 principal，`approver` 的 `issuer:principalId` 必须与请求者不同。
6. approved 后，具备 publisher 角色的可信 principal 才能 package。package 只复制冻结候选与 QA 证据并校验复制前后字节，不重渲染、不回读原素材。包内默认打开 `article.html`，`article.md` 仅作备份。
7. 人工在平台后台再次核对动态规则、原生 AI 标识和素材后完成发布。

打包采用可恢复两阶段提交。只要目录中存在 `DO-NOT-PUBLISH.commit-pending`，就绝对不可发布；保留响应中的 operationId/packageId/路径并按 `retry.tool`、`retry.args` 由同一可信 principal 重试。成功结果用 `recoveryMode=new|resumed|idempotent` 表明首次、恢复或终态幂等复验。数据库已提交但标记清理失败仍返回 action_required；重试会复验并完成清理。审批/内容绑定在提交前变化会把操作转为 aborted，带标记目录应保留或隔离用于审计，随后创建新 revision/approval，不能恢复旧操作。已提交 package 的审批是终态，不允许撤销。

真平台 API、浏览器最终点击和自动评论属于 Gate B。不得伪造发布成功。

微信草稿/编辑器粘贴验收：本地先核验 `wechat-richtext.html` 字节与 manifest；真人浏览器登录公众号后台（非 agent）按 `docs/releases/wechat-draft-acceptance-checklist-0.4.0.md` 记录清洗效果。Agent 不得绕过安全策略打开 `mp.weixin.qq.com`。

`delivery.verify` 会自动复验冻结字节、重新渲染一致性、离线 CSP、单一 H1、白底 token 和主/备角色，并真实启动固定 Playwright/Chromium、Nu 与 axe 生成哈希绑定证据；缺工具、版本不符、axe 有 violation/incomplete、横向溢出、非白底或打印异常均 fail-closed。`verifiedBy` 仍是可信 principal 提交的人工视觉验收，不等于自动工具完成认知可读性判断，也不构成完整 WCAG 认证。

MCP OAuth subject 是多人审批首选；显式 `host_principal` 只是部署者信任的宿主断言。没有可信 principal 的变更操作会返回 `AUTHENTICATION_REQUIRED`，一个 host principal 不能在需要不同人的流程两端自批。
