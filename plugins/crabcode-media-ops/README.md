# crabcode-media-ops

CrabCode 自媒体 / 新媒体内容运营插件。把"选题 → 写稿 → 审稿 → 平台适配 → 预览 → 审批 → 发布包"做成可跑通的创作闭环。

## 设计理念
**创作由主 agent 完成，MCP 工具只做确定性的活。** 你（主 agent）负责研究、提炼、写作、人味编辑；插件的 MCP 工具负责确定性操作——抓取热点、聚类、落库、就绪度校验、生成预览、打发布包、留痕审计。工具不替你写字。

## 能力一览

### 命令（commands）
- `/media-trends` — 抓热点、聚类，主 agent 提炼选题候选
- `/media-draft` — 从选题/brief 写主稿并落库
- `/media-review` — 事实核查 + 人味编辑 + 就绪度检查
- `/media-preview` — 生成各平台变体与预览
- `/media-publish` — 审批 → 发布包（真 API 属 Gate B）
- `/media-comments` — 评论分类 + 回复建议（建议模式；发送属 Gate B）
- `/media-style-collect` — 从历史作品收集创作风格，生成品牌 profile（人工确认后落库）

### 技能（skills）
- `media-ops` — 全流程主入口编排
- `media-human-editor` — 人味编辑（编辑提质，非规避检测）
- `media-platform-adapter` — 平台格式适配与发布检查

### 子代理（agents）
- `media-director`（统筹）/ `trend-researcher`（选题取材）/ `draft-writer`（成稿，可 fan-out）/ `fact-checker`（对抗式核查）/ `platform-publisher`（发布）/ `comment-operator`（评论）/ `style-collector`（风格收集）
- 各命令经 Task 工具派发对应子代理；核查结论回流 `readiness.inspect` 硬校验（存疑项未清零且无具名人工放行则不得进发布）。

### 输出风格（output-styles）
- `media-report` — 结构化运营报表风格

## Gate 分级

### Gate A（现可用，零凭证）
- 完整创作闭环：选题、brief、主稿、审稿、平台变体、预览。
- 品牌 profile 管理（`profile.save/get/list`）与风格收集。
- 就绪度校验（结构限制、禁用词、引用完整性/存疑项清零、AI 标识）、人工审批、**发布包生成**、审计留痕。
- 自定义确定性热点源经 `${CRABCODE_PLUGIN_DATA}/sources.config.json` 注册（官方/自建 JSON feed）；无官方 API 的平台热榜由 trend-researcher 子代理联网取材，不内置爬虫。
- 不触达任何平台真 API。

### Gate B（待平台凭证配置）
- 真平台发布 API：微信公众号 draft/freepublish、抖音 / 微博 / B站发布。
- 浏览器辅助投递。
- 评论真发送。
- 凭证清单见 `references/publish-runbook.md`；未配置前相关动作一律标注"待平台凭证配置（Gate B）"，不伪造成功。

## 安装

```bash
# 添加本地 marketplace（替换为 CrabCode-Plugin 仓库的绝对路径）
crabcode plugin marketplace add <CrabCode-Plugin 绝对路径>

# 安装插件
crabcode plugin install crabcode-media-ops@crabcode-plugins-official
```

## 合规声明（AI 标识，强制）
凡经本插件 AI 辅助创作的内容，发布前**必须**保留显式 AI 辅助标识（成稿末尾固定"本文由 AI 辅助创作"）并留存审计痕迹，依据《人工智能生成合成内容标识办法》（2025-09-01 施行）。**禁止抹除、伪造、隐匿标识，禁止规避检测。** 详见 `references/ai-labeling-compliance.md`。

## 许可证
Apache-2.0，CrabCode。第三方参考声明见 `docs/legal/THIRD_PARTY_NOTICES.md`。
