# Platform Delivery Practice

先读取 `../media-core/PRACTICE.md`。平台适配和发布技能只能处理已存储的内容 manifest。

- 规则分为硬限制、平台动态规则和编辑建议；逐条保留来源、核验日期与适用范围。
- 规则过期时停止并要求重新核验，不声称“符合最新规则”。
- 平台变体必须保留来源、事实核查、原创复核、法律路由和 AI 披露字段。
- 先以同一 ArticleDoc 调用 `mediaops.delivery.render` 生成精排白底 HTML 主产物、Markdown 备份和平台档案，再用 `mediaops.delivery.verify` 验证字节、语义、安全、多视口和打印。
- 审批必须绑定 content/articleDoc/render manifest/全部 artifact 哈希；`mediaops.publish.package` 只复制获批的冻结候选，禁止审批后重渲染或回读原素材路径。
- 当前只生成可移动发布包；真实 API、浏览器最终点击和自动评论都属于 Gate B。
