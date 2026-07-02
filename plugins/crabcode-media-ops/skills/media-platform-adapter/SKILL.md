---
name: media-platform-adapter
description: This skill should be used when the user needs to 适配平台格式 — 把稿件改写成微信公众号(news/newspic)、小红书图文、今日头条文章等平台规范，并做发布前格式检查。Triggers on "适配公众号"、"转小红书"、"头条文章格式"、"平台规范检查"。
when_to_use: 在 /media-preview 生成平台变体、或发布前需要按平台规范校验标题/正文/图片限制时。
version: 1.0.0
model: inherit
effort: medium
user-invocable: true
---

# media-platform-adapter — 平台格式适配与发布检查

把平台无关母稿改写为各平台规范的 variant，并配合 `mediaops.readiness.inspect` 与 platform registry 做发布前检查。**适配改写由你（主 agent）完成**，确定性校验交工具。

## 平台规范要点

### 微信公众号
- **两种类型**：
  - `news`（图文消息）：标准长文章，支持富排版、封面图、正文配图、原文链接。
  - `newspic`（图片消息）：以图为主、短文案，多图卡片式。
  - 二选一取决于内容形态：长文/教程用 news，图集/速览用 newspic。
- 标题 ≤32 字（以 platform registry 为准；建议更短以保完整展示）；需摘要、封面图（建议 900×500 或 1:1）。
- 正文段落不宜过长，配图穿插；外链受限（注意平台对跳转的限制）。

### 小红书（图文笔记）
- 标题简短抓眼（≤20 字体感更好），首图决定点击率。
- 正文口语化、分点、emoji 适度、话题标签（#）置尾。
- 配图序列（多图叙事），单图信息聚焦；避免大段纯文字。

### 今日头条（文章）
- 标题信息量足但不越线标题党（参考 `references/platform-policy.md`）。
- 首段须抓住要点（信息流抓取首段）；配图提升完读率。
- 正文结构清晰，适合搜索与推荐分发。

## 适配流程
1. 取母稿（`mediaops.content.get`），明确目标平台与栏目。
2. 按上述规范改写：标题、正文结构、图片占位/要求、标签。
3. 保留成稿末尾的 **AI 辅助显式标识**（适配时不可丢失，`references/ai-labeling-compliance.md`）。
4. `mediaops.content.save`（kind=variant）落库。
5. `mediaops.readiness.inspect` 按平台规则校验（标题/正文长度、禁用词、图片占位、引用完整性）；传 `brandId` 可自动带出品牌 profile 的禁用词与 AI 标识文案。按返回问题项修订至通过。
6. 需要的话由 `/media-preview` 调 `mediaops.preview.create` 生成可视预览。

## 注意
- platform registry（平台规则元数据）随插件分发；以 registry + readiness.inspect 返回为准，不要硬记数字。
- 各平台限制会变化，校验失败以 inspect 结果为权威。
