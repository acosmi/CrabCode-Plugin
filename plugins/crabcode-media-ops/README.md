# crabcode-media-ops 0.3.0

可审计的新媒体运营插件：可信来源研究、公众号原创观点、创作者风格采集、审稿、平台适配、人工审批与本地发布包。

## 核心变化

- 内容采用不可变 revision、`contentHash` 与统一 manifest；
- 事实核查、原创复核、法律路由、AI 披露和资源权利进入确定性 Media Gate；
- 审批支持 pending/approved/rejected/revoked，并绑定平台、revisionId 与 hash；
- 发布包只接受 contentId + approvalId，打包前再次复核并复制实际资源；
- 创作者风格提供快速、完整、增量三种表单，支持草稿、恢复、提交、冲突确认、版本历史和回滚；
- 平台规则带来源、核验日期、适用范围和规则类型；中文热点采用字符 n-gram 聚类。

## 九个技能

媒体底座：`media-ops`、`media-topic-research`。

编辑创作：`media-human-editor`、`wechat-original-opinion`、`media-originality-review`、`media-style-intake`、`media-style-manager`。

平台交付：`media-platform-adapter`、`media-publish-gate`。

`media-ops` 只编排完整、多阶段或多平台流程；单篇微信公众号原创观点稿由 `wechat-original-opinion` 负责，避免入口冲突。

## 创作者风格表单

`/media-style-collect --brand <brandId> --mode quick|full|incremental` 会生成本地可视表单。确定性工具链：

- `mediaops.style.form.template/save_draft/get/submit`；
- `mediaops.profile.propose/confirm/history/rollback`。

表单和历史作品观察冲突时必须逐项确认。用户数据按 brandId 保存到 `${CRABCODE_PLUGIN_DATA}`；插件安装目录不存风格记忆，外部样本全文也不进入 profile。

## 发布门禁

标准顺序：

1. 保存 stage=reviewed 的 content manifest；
2. `mediaops.readiness.inspect(contentId)`；
3. `mediaops.approval.request`；
4. 人工明确决定后 `mediaops.approval.decide`；
5. `mediaops.publish.package(contentId, approvalId, packagedBy)`。

未审、未完成原创/法律路由、披露不完整、规则过期、审批未通过、审批后改稿或输入不匹配都会返回明确停止码。

## AI 披露口径

插件记录 `platform-native`、`body-label`、`file-metadata` 三种实际方式。AI 辅助内容必须确认至少一种方式和确认人，但不把某句固定正文文案描述成所有平台唯一法定形式。参见 `references/ai-labeling-compliance.md`。

## Gate A / Gate B

0.3.0 仍是 Gate A：研究、写作、存储、校验、预览、审批和人工发布包均可用，零平台凭证。

真实平台 API、浏览器最终发布、自动评论、非官方爬虫、全网查重和平台原创声明保证仍属于 Gate B 或明确不提供。

## 验证

```bash
bun run typecheck
bun test
```

根仓库另运行 `bun run validate`。许可证为 Apache-2.0；第三方参考见 `docs/legal/THIRD_PARTY_NOTICES.md`。
