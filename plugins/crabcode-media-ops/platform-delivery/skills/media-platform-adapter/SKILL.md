---
name: 多平台内容适配
short-description: "将主稿内容适配为微信、小红书与今日头条版本"
brand-color: "#3178B8"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 把已完成主稿适配为微信、小红书或今日头条变体，保留来源、审稿、原创、法律和 AI 披露状态。用户要求一稿多发、改成小红书/头条/公众号格式或平台预览时使用；不负责批准或真实发布。
---

# 平台适配

先读取 `../../../media-core/PRACTICE.md` 与 `../../PRACTICE.md`，再读取 `../../references/platform-policy.md`。适配开始前先按《运行前预检》确认 `mediaops.capabilities` 可用；预检失败按停止码停止，变体状态一律记 `GATE_NOT_EXECUTED`。

1. 调用 `mediaops.platform.rules.get`，区分硬限制、动态规则和编辑建议。
2. 只从已存储主稿派生变体，parentIds 指向上游 contentId。
3. 调整标题、段落、摘要、emoji、标签和配图建议，但不得改写事实结论或丢失披露。
4. 保存为新的 variant intake，并按级推进。任何内容实质变化都要重新核验受影响主张、人工编辑、原创扫描、ArticleDoc 和交付验证。
5. 微信富文本只是 `wechat-richtext@1` 渲染档案，不能替代默认 web HTML 主产物；preview 复用已验证候选，不重新渲染。

规则过期时停止并返回 `PLATFORM_RULES_STALE`。
