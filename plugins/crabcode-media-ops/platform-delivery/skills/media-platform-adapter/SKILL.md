---
name: media-platform-adapter
description: 把已完成主稿适配为微信、小红书或今日头条变体，保留来源、审稿、原创、法律和 AI 披露状态。用户要求一稿多发、改成小红书/头条/公众号格式或平台预览时使用；不负责批准或真实发布。
---

# 平台适配

先读取 `../../../media-core/PRACTICE.md` 与 `../../PRACTICE.md`，再读取 `../../references/platform-policy.md`。

1. 调用 `mediaops.platform.rules.get`，区分硬限制、动态规则和编辑建议。
2. 只从已存储主稿派生变体，parentIds 指向上游 contentId。
3. 调整标题、段落、摘要、emoji、标签和配图建议，但不得改写事实结论或丢失披露。
4. 保存为新的 variant manifest。若内容实质变化，重新完成事实与原创复核。
5. 用 preview 检查，不声称已在平台发布。

规则过期时停止并返回 `PLATFORM_RULES_STALE`。
