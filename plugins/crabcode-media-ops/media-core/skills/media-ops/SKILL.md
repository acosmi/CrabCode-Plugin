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

1. 研究与选题：`media-topic-research`。
2. 微信原创观点稿：`wechat-original-opinion`；其他稿件由写作者完成。
3. 人工感编辑：`media-human-editor`。
4. 独立原创复核：`media-originality-review`。
5. 无 profile 或需要更新风格：`media-style-intake` → `media-style-manager`。
6. 平台变体：`media-platform-adapter`。
7. 审批与发布包：`media-publish-gate`。

## 状态流

把每次产出保存为 content manifest：`intake → researched → drafted → reviewed`。变更永远新建 revision，不覆盖旧版本。

交付必须包含 contentId、revisionId、contentHash、profileVersion、当前阶段、未解决风险和下一步。遇到停止码立即暂停，不靠文字承诺绕过工具门禁。
