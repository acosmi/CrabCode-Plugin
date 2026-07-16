---
name: 发布审批门禁
short-description: "校验发布条件、记录人工审批并生成发布包"
brand-color: "#B5652A"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 对最终媒体变体执行完整 Media Gate、请求并记录人工审批，并在内容哈希匹配且批准后生成可移动发布包。用户要求审批、打包、发布前检查或追溯发布记录时必须使用；不执行真实平台 API 或浏览器最终发布。
---

# 审批与发布包

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/publish-runbook.md`。

1. 对 reviewed revision 调用 `mediaops.delivery.render`；它从冻结素材生成精排白底 HTML 主产物、Markdown 备份和平台档案。
2. 由与 `renderer` principal 不同、具备 `delivery_reviewer` 角色的可信 principal 提交多视口、打印、白底、溢出和可读性确认，再调用 `mediaops.delivery.verify`。它会对确切 HTML 自动运行固定 Nu、Playwright/Chromium、axe、八组视口/配色、文本压力和两种打印检查；随后用 `mediaops.readiness.inspect(contentId)` 执行完整门禁。
3. ready 后由具备 `approval_requester` 角色的可信 principal 调用 `mediaops.approval.request(contentId, deliveryId, ...)`，向批准者展示确切 HTML，并绑定 content、ArticleDoc、render manifest、全部产物和 QA 证据哈希。
4. 只有明确且 `issuer:principalId` 与请求者不同、具备 approver 角色的可信 principal 才能调用 `mediaops.approval.decide`；调用参数中的姓名不是身份，生成者不得自批。
5. approved 后由具备 publisher 角色的可信 principal 调用 `mediaops.publish.package`。打包只复制冻结候选和 QA 证据并复核源/目标字节，绝不重渲染。任何改稿或产物变化都会触发 stale/integrity 停止码。
6. 若返回可恢复错误，保留 `DO-NOT-PUBLISH.commit-pending`、operationId/packageId 和目录，由同一可信 principal 严格按响应中的 retry 参数重试；标记存在时绝不发布。`PACKAGE_ABORTED` 不可恢复，隔离目录并创建新 revision/approval；已提交 package 的审批不可撤销。
7. 默认交付 HTML 路径，Markdown 标注为备份，并给出 `recoveryMode`、全部追溯哈希、QA 工具版本和身份 assurance；最终发布仍由人工在平台后台完成。

缺可信 principal、pending、rejected、revoked、stale、自动 QA 失败或输入不匹配时停止，不提供绕过步骤。`host_principal` 是宿主信任断言，不应描述为插件已完成强身份认证；完整 WCAG 认证和真实平台发布也不在本门禁保证范围内。
