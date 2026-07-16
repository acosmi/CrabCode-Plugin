---
name: 新媒体运营
short-description: "编排选题、创作、审校、适配与发布包流程"
brand-color: "#8957E5"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 编排从选题研究、创作审校、多平台适配到人工审批发布包的完整媒体运营流程。用户要求多阶段继续执行、多平台分发、批量内容、审批留痕或发布包时必须使用；只写一篇公众号观点稿时改用 wechat-original-opinion。
---

# 媒体运营总编排

先读取 `../../PRACTICE.md`，以 Media Gate 为不可降级约束。

## 路由

1. 参考先用 `mediaops.reference.register` 分类并建立不可复制清单；研究与选题：`media-topic-research`。
2. 微信原创观点稿：`wechat-original-opinion`；其他稿件由写作者完成。
3. 人工感编辑：`media-human-editor`。
4. 独立原创复核：`media-originality-review`。
5. 无 profile 或需要更新风格：`media-style-intake` → `media-style-manager`。
6. 平台变体：`media-platform-adapter`。
7. `mediaops.delivery.render` 冻结用户实际看到的 HTML；`mediaops.delivery.verify` 对同一字节运行自动 QA 并记录独立视觉确认；审批与发布包：`media-publish-gate`。

## 状态流

把每次产出保存为 content manifest：`intake → researched → drafted → reviewed`。首版只能是 intake，每次最多推进一级；研究、来源层级/独立组、原创、编辑复核、身份和交付结论只能引用服务端生成或可信 principal 绑定的记录，不能随 `content.save` 自报。写作必须在不含第三方原文的 fresh context 中进行，人工编辑后再扫描；`editorial.review` 必须覆盖标题、摘要、正文、引文元数据、图片 alt/图注和披露的全部可见句，并按事实、作者推论、观点、非主张四类逐项说明。变更永远新建 revision，不覆盖旧版本。

默认向用户呈现已验证的精排白底 HTML，Markdown 仅作备份。交付必须包含 contentId、revisionId、contentHash、articleDocHash、renderManifestHash、profileVersion、自动 QA 证据摘要、身份 assurance、当前阶段、未解决风险和下一步。遇到停止码立即暂停，不靠文字承诺绕过工具门禁。
