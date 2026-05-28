---
description: 从选题/brief 出发由主 agent 撰写主稿，再用 content.save 落库（kind=brief|draft）
argument-hint: <选题或 brief 描述> [--platform wechat|xiaohongshu|toutiao] [--column 栏目]
allowed-tools: [Read, Glob, Grep, Bash]
---

# /media-draft — 撰写主稿

用户输入：$ARGUMENTS

**写稿是创作环节，由你（主 agent）完成。** MCP 工具只负责把你的产出确定性地落库与编号，不替你写字。

## 工作流

### 1. 准备 brief（如尚无）
- 若用户给的是 topic 而非 brief，先产出一份 **brief**：核心论点、目标受众、平台与栏目、关键信息点、可信来源清单、调性要求。
- 来源必须可追溯：列出链接或出处；存疑信息标"待核查"。
- 调 `mediaops.content.save`，`kind=brief`，把 brief 落库，记下返回的 content id。

### 2. 撰写主稿（平台无关的"母稿"）
- 基于 brief 与品牌 profile（人设/口吻/禁用词/栏目，见 `references/brand-profile-schema.md`）写一篇**完整主稿**。
- 主稿要求：观点清晰、有事实支撑（引用 brief 来源）、结构合理、语言有"人味"（参考 `media-human-editor` skill 的反模板信号，避免万能开头/三段式/空泛排比）。
- 不要在主稿阶段就套平台格式（平台变体在 `/media-preview` 与发布阶段处理）。

### 3. 落库
- 调 `mediaops.content.save`，`kind=draft`，关联对应 brief id，存入主稿正文与元数据（标题、栏目、来源列表）。
- 记录返回的 draft id，告知用户。

### 4. 合规与标识
- 主稿为 AI 辅助创作，按 `references/ai-labeling-compliance.md`：在正式成稿阶段须保留**显式 AI 辅助标识**，本步骤先在元数据中标记"AI 辅助"，标识文案在 `/media-review` 定稿时落到成稿末尾。

## 输出
- 用运营报表风格汇报：brief id、draft id、字数、来源数、待核查项。
- 提示用户下一步走 `/media-review` 做事实核查与人味编辑。
