---
description: 对已批准变体生成发布包 — 可派 platform-publisher 执行检查→审批→打包；真平台 API 为 Gate B 暂不可用
argument-hint: <variant id> [--platform wechat|xiaohongshu|toutiao] [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-publish — 审批与发布包

用户输入：$ARGUMENTS

把已就绪的平台变体走人工审批后打成**发布包**。**当前阶段（Gate A）只生成发布包 + 人工确认；真平台发布 API 属 Gate B，未配置凭证前不可用。** 整段"检查 → 审批 → 打包 → 留痕"流程可用 **Task 派发 `platform-publisher` 子代理**执行（多变体/多平台批量时并行派发）；人工审批的确认动作始终回到用户。

## 工作流

### 1. 取变体并最终复核
- 调 `mediaops.content.get` 取目标 variant；调 `mediaops.readiness.inspect`（传 `brandId` 与审稿时的 `claims`/`claimWaiver` 终态）做发布前最终就绪度检查——禁用词、存疑项清零或已具名放行、AI 标识齐备。
- 确认成稿末尾的 **AI 辅助显式标识** 存在（合规强制，见 `references/ai-labeling-compliance.md`）。缺失则拒绝继续，回退 `/media-review`。

### 2. 请求人工审批（gate）
- 调 `mediaops.approval.request`，提交 variant、预览、就绪度结论（含 waiver 记录），进入待人工确认状态。
- **审批是硬 gate**：未获人工批准不得生成发布包。向用户清楚展示待批内容摘要，等待确认。

### 3. 生成发布包（确定性）
- 获批后调 `mediaops.publish.package`（传 `brandId`——它的 AI 标识终检以 profile 的 `compliance.ai_label_text` 为准，不传会按默认文案校验），生成对应平台的发布包（结构化内容 + 资源 + 发布元数据 + 审计痕迹）。
- 发布包模式 vs 浏览器辅助的差异见 `references/publish-runbook.md`。

### 4. 真发布（Gate B — 当前不可用）
- 微信公众号 draft/freepublish、抖音/微博/B站发布 API、浏览器辅助投递 **均为 Gate B**，需平台凭证配置后开放。
- 本阶段输出到"生成发布包 + 人工确认"为止；真 API 调用一律标注 **"待平台凭证配置（Gate B）"**，不要伪造或模拟成功。

### 5. 留痕
- 发布包与审批记录写入审计（AI 辅助痕迹 + 人工确认记录 + 存疑项 waiver），可经 `mediaops.publish.history` 回查。

## 输出
- 运营报表风格：审批状态、发布包路径、Gate B 待办（哪些真 API 需凭证）、审计记录位置。
