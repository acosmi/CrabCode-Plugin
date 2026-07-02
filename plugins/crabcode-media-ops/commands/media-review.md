---
description: 审稿 — 派 fact-checker 对抗式核查 + 主 agent 人味编辑；readiness.inspect 硬卡存疑项与禁用词
argument-hint: <draft id 或选题> [--platform wechat|xiaohongshu|toutiao] [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-review — 审稿与人味编辑

用户输入：$ARGUMENTS

定稿前的把关环节，分三层：**事实核查派给独立的 fact-checker 子代理（对抗式，只标注不改稿）**；**人味编辑由你（主 agent）执行**；`mediaops.readiness.inspect` 做确定性硬校验（格式/长度/禁用词/引用完整性/存疑项清零）。

## 工作流

### 1. 取稿与 profile
- 调 `mediaops.content.get` 取出目标 draft（或 `mediaops.content.list` 让用户选）。
- 调 `mediaops.profile.get` 取品牌 profile（禁用词与 AI 标识文案的权威来源）。

### 2. 对抗式事实核查（Task → fact-checker）
- 用 **Task 工具派发 `fact-checker`**，交代稿件全文 + brief 的 `citations[]` 来源清单。
- 子代理逐条提取可验证主张、联网求证，返回结构化 claims 清单：`{ claim, status: verified|doubtful|unsourced, sourceUrl? }` + 核查依据。
- 对失实项按其修正建议修订稿件；能补来源的补来源，补不上的删改表述。

### 3. 人味编辑（主 agent，引用 media-human-editor skill）
- 按 `media-human-editor` skill 的五层框架（Brand Voice / Evidence Grounding / Anti-template / Human Detail / Editor Review）逐层打磨。
- 扫反模板信号清单：万能开头、三段式套路、空泛排比、过度转折、滥用破折号等（详见 `references/humanize-rules.md`），逐一改写。
- **红线提醒**：人味编辑的目标是**提升人工编辑质量**，不是抹掉 AI 标识或规避检测。AI 辅助内容仍须保留显式标识。

### 4. 就绪度硬校验（确定性 gate）
- 调 `mediaops.readiness.inspect`，传入：`brandId`（自动带出 profile 的 banned_words 与 AI 标识文案）+ 修订后的 `claims` 清单。
- 工具硬卡的确定性状态：结构限制（标题/正文/图片）、禁用词出现、verified 主张缺 sourceUrl、**存疑项（doubtful/unsourced）未清零**。
- **存疑项处理只有两条路**：修订到清零；或**具名人工放行**——经用户明示同意后在 `claimWaiver` 里记 `{ waived: true, by: 用户署名, reason }`，工具降级为 warning 并留痕。不允许静默放过。

### 5. 定稿与标识
- 在成稿末尾注入显式 AI 辅助标识（文案取 profile 的 `compliance.ai_label_text`，缺省见 `references/ai-labeling-compliance.md`）。
- 调 `mediaops.content.save`，`kind=draft`（更新）或 `kind=variant`（若已开始分平台），`profileId=品牌id`，payload 记录核查结论（claims 终态、waiver 记录）。

## 输出
- 运营报表风格：核查结论（已证/存疑/无源计数、waiver 记录）、人味编辑改动摘要、readiness 结果、定稿 id。
- 提示下一步走 `/media-preview` 生成平台预览。
