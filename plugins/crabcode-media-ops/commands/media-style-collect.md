---
description: 收集账号创作风格 — 派 style-collector 分析历史作品，人工确认后 profile.save 落库；支持增量更新
argument-hint: <语料目录/文件/粘贴文本/链接> [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-style-collect — 创作风格收集

用户输入：$ARGUMENTS

从账号历史作品中提炼创作风格，产出结构化品牌 profile（schema 见 `references/brand-profile-schema.md`）并落库。**profile 是后续选题/写稿/审稿/评论各环节的统一口径来源**；语料分析派给 `style-collector` 子代理，落库前必须经人工确认。

## 工作流

### 1. 收集语料（输入形态按优先级）
- **本地文件/目录**（首选）：用户导出的历史稿件，确认路径可读、篇数（≥3 篇归纳置信度才够）。
- **粘贴文本**：用户直接贴正文，逐篇编号。
- **链接（best-effort）**：可尝试抓取；公众号等平台反爬严重，**抓取失败不硬扛**，直接提示用户"导出原文或粘贴正文"降级继续。
- 语料不足 3 篇时明确告知：可以先建低置信 profile，后续增量补充。

### 2. 判断全新 or 增量
- 调 `mediaops.profile.get`（`--brand` 或询问用户品牌 id）：
  - **无 profile** → 全新收集；
  - **已有 profile** → 增量模式：把现有 profile 一并交给子代理，要求输出**逐字段 diff 建议**（新增/修改/保留），不整体推翻。

### 3. 派发风格分析（Task → style-collector）
- 用 **Task 工具派发 `style-collector`**，交代语料位置/内容、品牌 id、（增量时）现有 profile、用户口头补充的偏好。
- 要求返回：完整 profile 草案（或 diff）+ 每字段的归纳依据（语料原句佐证）+ 低置信字段标注。

### 4. 人工确认（硬步骤）
- 把草案逐字段呈现给用户：人设、口吻、受众、栏目、禁用词、标杆参考、合规（AI 标识文案、回避领域）。
- **用户确认/修改后才落库**；禁用词与 `compliance` 字段尤其要用户过目——它们会成为 readiness 硬校验的依据。

### 5. 落库
- 调 `mediaops.profile.save` 写入确认稿（工具按 schema 校验，存于 `${CRABCODE_PLUGIN_DATA}/profiles/<brand_id>.json`）。
- 落库后此 profile 即被各环节硬挂接：`/media-draft` 写作口径、`readiness.inspect` 禁用词与 AI 标识校验（传 `brandId`）、`/media-comments` 回复口吻。

## 输出
- 运营报表风格：profile 字段摘要、归纳依据要点、低置信字段与建议补充的语料、落库结果（brand_id 与路径）。

## 注意
- profile 是配置不是稿件来源；事实仍以 brief 的可信来源为准。
- 风格收集的目标是"像这个号"，不是复制他人内容；style_refs 只记参照要点。
