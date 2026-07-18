---
description: 评论分类 + 回复建议（建议模式）— 批量时派 comment-operator；真评论发送属 Gate B 暂不可用
argument-hint: "[来源/文件/粘贴的评论] [--platform wechat|xiaohongshu|toutiao] [--brand 品牌id]"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-comments — 评论运营（建议模式）

用户输入：$ARGUMENTS

对一批评论做分类并给出回复建议。**当前为建议模式：只产出分类与回复草稿，真评论发送属 Gate B，未配置凭证前不可用。** 评论量大或多篇稿件并行运营时，**用 Task 派发 `comment-operator` 子代理**处理（可按稿件/平台分批并行）。

## 工作流

### 1. 取评论与 profile
- 评论来源可为用户粘贴、本地文件或导出文本。无平台拉取真 API（Gate B），本阶段以用户提供的数据为准。
- 调 `mediaops.profile.get` 取品牌 profile——回复口吻以 profile 的 `voice` 为准，禁用词同样适用于回复文案。调用前先按 `media-core/PRACTICE.md`《运行前预检》确认服务可用；`MCP_INACTIVE` 等停止码出现时如实告知，可在无 profile 约束下继续建议模式，但需标注未读取 profile。

### 2. 分类（comment-operator 或主 agent）
- 按以下维度归类：表扬/认同、提问/求助、批评/投诉、纠错/质疑事实、垃圾/引流、敏感/法律风险。
- 标注优先级（需尽快回应的：质疑事实、投诉、敏感）。

### 3. 回复建议
- 为需回复的评论起草回复，遵循品牌口吻（profile）与平台互动政策（`platform-delivery/references/platform-policy.md`）。
- 涉及事实纠错的，给出有依据的回应；涉及投诉的，给出安抚 + 处理路径；敏感/法律风险的，建议不公开回复或转人工，并说明原因。
- 回复建议保持"人味"，避免模板化客套（参考 `media-human-editor`）。

### 4. 输出与确认
- 运营报表风格：分类汇总表 + 逐条回复建议 + 优先级标注 + 不建议回复项及理由。
- **发送动作（Gate B）**：实际发表评论需平台凭证与发送通道，当前一律标注 **"待平台凭证配置（Gate B）"**。本阶段交付到"回复建议 + 人工确认"为止。
