---
description: 从选题/brief 出发撰写主稿 — 默认派 draft-writer 撰写（多角度可 fan-out），content.save 落库
argument-hint: <选题或 brief 描述> [--platform wechat|xiaohongshu|toutiao] [--column 栏目] [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-draft — 撰写主稿

用户输入：$ARGUMENTS

**写稿是创作环节，由 agent 完成；MCP 工具只负责确定性落库与编号。** 默认把撰写派给 `draft-writer` 子代理；你（主 agent）负责准备 brief、把关与取舍。

## 工作流

### 1. 加载品牌 profile（硬步骤）
- 调 `mediaops.profile.get` 取品牌 profile（`--brand` 或会话已知品牌）。
- **无 profile 时不静默继续**：提示用户跑 `/media-style-collect` 建立，或现场确认最小集（口吻、人称、禁用词、AI 标识文案）后再动笔，并建议事后补建 profile。

### 2. 准备 brief（如尚无）
- 若用户给的是 topic 而非 brief，先产出一份 **brief**：核心论点、目标受众、平台与栏目、关键信息点、可信来源清单、调性要求。
- 来源必须可追溯：来自 `/media-trends` 的选题带上其来源清单；存疑信息标"待核查"。
- 调 `mediaops.content.save`，`kind=brief`，`profileId=品牌id`，来源写入 `payload.citations[]`，记下返回的 content id。

### 3. 派发撰写（Task → draft-writer）
- 用 **Task 工具派发 `draft-writer`**，交代 brief 内容、profile 要点（人设/口吻/禁用词/栏目）、平台无关"母稿"的要求。
- **多角度试稿（fan-out）**：当用户要对比方案或选题风险较高时，**并行派发 2-3 个 draft-writer**，各写一版不同角度（信息型/观点型/实用型），你负责比稿、择优或合成。
- 母稿要求：观点清晰、有事实支撑（引用 brief 来源）、结构合理、语言有"人味"（`media-human-editor` 的反模板信号）。
- 不要在主稿阶段就套平台格式（平台变体在 `/media-preview` 处理）。

### 4. 落库
- 择定稿件后调 `mediaops.content.save`，`kind=draft`，`profileId=品牌id`，关联对应 brief id，存入主稿正文与元数据（标题、栏目、来源列表）。
- 记录返回的 draft id，告知用户。

### 5. 合规与标识
- 主稿为 AI 辅助创作，按 `references/ai-labeling-compliance.md`：在正式成稿阶段须保留**显式 AI 辅助标识**，本步骤先在元数据中标记"AI 辅助"，标识文案（profile 的 `compliance.ai_label_text`）在 `/media-review` 定稿时落到成稿末尾。

## 输出
- 用运营报表风格汇报：brief id、draft id、字数、来源数、待核查项、（fan-out 时）各版本取舍理由。
- 提示用户下一步走 `/media-review` 做事实核查与人味编辑。
