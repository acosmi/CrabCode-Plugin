---
description: 为定稿生成各平台变体与预览 — 变体改写可派 draft-writer 按平台 fan-out，preview.create 确定性渲染
argument-hint: <draft/variant id> [--platform wechat|xiaohongshu|toutiao] [--all] [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-preview — 平台预览

用户输入：$ARGUMENTS

把定稿适配为目标平台格式并生成可视预览。**平台变体的撰写/裁剪是创作活**（参考 `media-platform-adapter` skill）——单平台可由你（主 agent）直接改写，多平台时**用 Task 按平台 fan-out 派发 `draft-writer` 并行产出各变体**；`mediaops.preview.create` 负责确定性渲染预览。

## 工作流

### 1. 取定稿
- 调 `mediaops.content.get` 取目标稿件；确认它已过 `/media-review`（含 AI 辅助标识与核查结论）。
- 调 `mediaops.profile.get` 取品牌 profile（各平台栏目映射、口吻约束）。

### 2. 生成平台变体（创作，可 fan-out）
- 依目标平台规范改写（标题字数、正文结构、图片要求、话题标签、排版），规范见 `references/platform-policy.md` 与 `media-platform-adapter` skill：
  - 微信公众号：图文（news）/ 图片消息（newspic）格式差异、标题 ≤32 字（以 platform registry 为准）、摘要、封面图占位。
  - 小红书：图文笔记，标题简短抓眼（≤20 字）、正文口语化、话题标签、配图序列。
  - 今日头条：文章标题党边界、首段抓取、配图。
- `--all` 或多平台时：**每个平台派一个 `draft-writer`**（Task 并行），各自按平台规范改写，你统一验收。
- 每个平台变体调 `mediaops.content.save`，`kind=variant`，`profileId=品牌id`，关联源 draft。

### 3. 就绪度复核 + 生成预览（确定性）
- 对每个 variant 调 `mediaops.readiness.inspect`（传 `brandId`，自动校验禁用词与 AI 标识）复核平台规则。
- 调 `mediaops.preview.create` 生成预览（HTML/图片），返回预览路径或链接。

### 4. 输出
- 运营报表风格：每平台 variant id + readiness 结果 + 预览路径。
- 提示用户检视预览，确认后走 `/media-publish` 进入审批与发布包。

## 注意
- 预览是本地确定性渲染，**不触达任何平台真 API**。
- variant 必须各自带 AI 辅助标识（不能在适配时丢失）。
- 平台限制数字以 platform registry / readiness.inspect 返回为准，不要硬记。
