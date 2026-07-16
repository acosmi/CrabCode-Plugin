# 发布手册入口

请读取 `../platform-delivery/references/publish-runbook.md`。审批前先冻结并验证 HTML 主产物、Markdown 备份和自动 QA 证据；发布包的业务输入只定位 contentId 与 approvalId，`packagedBy` 由具备 `publisher` 角色的可信 principal 覆盖绑定。打包会复核 revision/content/articleDoc/render/artifact/asset/QA 全部哈希后复制获批候选。
