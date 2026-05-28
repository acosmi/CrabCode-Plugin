---
description: 审稿 — 事实核查 + 人味编辑 + 就绪度检查；主 agent 编辑，readiness.inspect 做确定性校验
argument-hint: <draft id 或选题> [--platform wechat|xiaohongshu|toutiao]
allowed-tools: [Read, Glob, Grep, Bash]
---

# /media-review — 审稿与人味编辑

用户输入：$ARGUMENTS

定稿前的把关环节。**事实核查与人味编辑由你（主 agent）执行**；`mediaops.readiness.inspect` 做确定性的格式/长度/禁用词校验。

## 工作流

### 1. 取稿
- 调 `mediaops.content.get` 取出目标 draft（或 `mediaops.content.list` 让用户选）。

### 2. 事实核查（主 agent）
- 逐条核对稿中可验证陈述与 brief 来源；存疑或无来源的论断标红，给出修正或删除建议。
- 数字、日期、引语、人名机构名重点复核。
- 涉敏感/医疗/金融/法律等内容，对照 `references/platform-policy.md` 与 `mediaops.policy_status` 判断是否越界。

### 3. 人味编辑（主 agent，引用 media-human-editor skill）
- 按 `media-human-editor` skill 的五层框架（Brand Voice / Evidence Grounding / Anti-template / Human Detail / Editor Review）逐层打磨。
- 扫反模板信号清单：万能开头、三段式套路、空泛排比、过度转折、滥用破折号等（详见 `references/humanize-rules.md`），逐一改写。
- **红线提醒**：人味编辑的目标是**提升人工编辑质量**，不是抹掉 AI 标识或规避检测。AI 辅助内容仍须保留显式标识。

### 4. 就绪度检查（确定性）
- 调 `mediaops.readiness.inspect` 对修订稿做平台维度校验（标题长度、正文长度、禁用词、图片占位、引用完整性）。
- 根据返回的问题项继续修订，直到 inspect 通过。

### 5. 定稿与标识
- 在成稿末尾注入显式 AI 辅助标识（固定文案见 `references/ai-labeling-compliance.md`）。
- 调 `mediaops.content.save`，`kind=draft`（更新）或 `kind=variant`（若已开始分平台），记录审计痕迹（核查结论、人工确认记录）。

## 输出
- 运营报表风格：核查结论（通过/存疑项）、人味编辑改动摘要、readiness 结果、定稿 id。
- 提示下一步走 `/media-preview` 生成平台预览。
