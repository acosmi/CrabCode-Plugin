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
2. 完成多视口、打印、白底、溢出和可读性检查后调用 `mediaops.delivery.verify`，再用 `mediaops.readiness.inspect(contentId)` 执行完整门禁。
3. ready 后调用 `mediaops.approval.request(contentId, deliveryId, ...)`，向批准者展示确切 HTML，并绑定 content、ArticleDoc、render manifest 及全部产物哈希。
4. 只有明确且与请求者不同的人类才能调用 `mediaops.approval.decide`；生成者不得自批。
5. approved 后调用 `mediaops.publish.package`。打包只复制冻结候选并复核源/目标字节，绝不重渲染。任何改稿或产物变化都会触发 stale/integrity 停止码。
6. 默认交付 HTML 路径，Markdown 标注为备份，并给出全部追溯哈希；最终发布仍由人工在平台后台完成。

pending、rejected、revoked、stale 或输入不匹配时停止，不提供绕过步骤。
