---
name: media-ops
description: This skill should be used when the user wants to do 自媒体/新媒体内容运营 — 抓热点选题、写主稿、做平台变体、审稿事实核查、生成预览、走审批并打发布包。Triggers on phrases like "写一篇公众号"、"做选题"、"出小红书文案"、"内容运营"、"发布包"、"运营这个号"。
when_to_use: 用户要做内容创作到发布的全流程运营时，作为主入口编排 trends/draft/review/preview/publish 各环节。
version: 1.0.0
model: inherit
effort: medium
user-invocable: true
---

# media-ops — 内容运营主入口

本 skill 是 CrabCode 新媒体运营插件的总编排入口。**核心架构：创作由 agent 完成，MCP 工具只做确定性的活**（抓取、聚类、落库、校验、预览、打包、留痕）。研究/写作/核查等重活派给专职子代理（Task 工具）：`trend-researcher`（联网取材溯源）、`draft-writer`（撰稿与变体，可 fan-out）、`fact-checker`（对抗式核查）、`platform-publisher`（检查审批打包）、`comment-operator`（评论）、`style-collector`（风格收集）；批量运营可由 `media-director` 总编排。你负责准备输入、验收产出、在人工 gate 处对接用户。

## 何时使用
- 用户要从 0 做一篇（或一组多平台）内容并走到可发布。
- 用户说"运营某个号/某个赛道"，需要选题→成稿→发布的闭环。
- 用户已有部分产出（topic/brief/draft），要继续往下推进。

## 全流程（Gate A：零凭证可跑的创作 + 发布包闭环）

### 0. 能力与策略自检（每次开工先做）
- `mediaops.capabilities`：确认本机可用平台与能力、已注册热点源、当前处于 Gate A。
- `mediaops.doctor`：检查依赖/配置健康，缺项告知用户但不阻塞创作。
- `mediaops.policy_status`：取当前限流/合规边界，作为后续硬约束。
- **品牌 profile（硬步骤）**：`mediaops.profile.get` 加载品牌 profile；没有就引导 `/media-style-collect` 建立（或现场确认最小集）。profile 的禁用词与 AI 标识文案是 readiness 硬校验依据。

### 1. 选题（→ `/media-trends`）
- 派 `trend-researcher` 子代理：`mediaops.trends.search`/`cluster` 取确定性数据 + WebSearch/WebFetch 联网取材溯源。
- 候选须带可信来源清单；选中项的来源随 brief 写入 `payload.citations[]` 落痕。

### 2. Brief（带来源）
- 产出 brief：核心论点、受众、平台/栏目、关键信息点、**可信来源清单**、调性。
- `mediaops.content.save`（kind=brief，profileId，payload.citations[]）落库。

### 3. 主稿（→ `/media-draft`）
- 派 `draft-writer` 依 brief + 品牌 profile 写平台无关母稿；多角度试稿时并行 fan-out 数个再择优。
- `mediaops.content.save`（kind=draft，profileId）落库。

### 4. 审稿（→ `/media-review`）
- 派 `fact-checker` 对抗式核查，产出 claims 标注（verified/doubtful/unsourced）；你做人味编辑（`media-human-editor` 五层框架与反模板清单）。
- `mediaops.readiness.inspect`（传 brandId + claims）硬卡：禁用词、verified 缺源、**存疑项未清零且无具名人工放行**。
- 在成稿末尾注入显式 AI 辅助标识（profile 的 `compliance.ai_label_text`，缺省见 `references/ai-labeling-compliance.md`）。

### 5. 平台变体 + 预览（→ `/media-preview`）
- 按平台规范（`media-platform-adapter` skill）改写为各平台 variant；多平台时按平台 fan-out 派 `draft-writer`。
- `mediaops.content.save`（kind=variant，profileId）+ `mediaops.readiness.inspect`（brandId）+ `mediaops.preview.create`。

### 6. 审批 + 发布包（→ `/media-publish`）
- `mediaops.approval.request`（人工审批硬 gate）→ 获批后 `mediaops.publish.package`。
- 真平台发布 API / 浏览器辅助 = **Gate B**，未配凭证前标注"待平台凭证配置（Gate B）"，不伪造成功。
- 经 `mediaops.publish.history` 可回查发布与审计记录。

### 7. 评论运营（→ `/media-comments`，可选）
- 评论分类 + 回复建议（建议模式，可派 `comment-operator`）；真发送 = Gate B。

### 8. 风格收集（→ `/media-style-collect`，建号/换调性时）
- 派 `style-collector` 分析历史作品（本地文件/粘贴为主，链接 best-effort）→ 人工确认 → `mediaops.profile.save` 落库；支持对已有 profile 增量 diff 更新。

## 关键原则
- **来源可追溯**：brief 与稿件的事实陈述必须有出处，存疑标"待核查"。
- **人工 gate 不可绕**：发布前必经人工审批；AI 辅助标识不可缺失或抹除（合规红线）。
- **工具不写字**：MCP 工具不替你创作，只做确定性操作。

## 数据位置
- 内容与审计落在 `${CRABCODE_PLUGIN_DATA}` 下，按 content id 组织。
- 插件资源（platform registry、模板）在 `${CRABCODE_PLUGIN_ROOT}` 下。
- 会话关联用 `${CRABCODE_SESSION_ID}`。

## 能力路由(法律风险审查)

- 稿件涉及营销宣称或存在内容侵权疑虑时,在人工审批 gate 之前路由法律审查:营销宣称合规调用 `crablaw-cn:marketing-claims-review`,内容侵权分诊调用 `crablaw-cn:infringement-triage`;
- 若触发时报 Unknown skill,说明法律插件未安装:提示用户通过 `/plugin` 安装 `crablaw-cn`,或将稿件标注"法律风险未审"交由人工 gate 决断,不得静默跳过。
