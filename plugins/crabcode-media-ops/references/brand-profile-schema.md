# 品牌 Profile Schema

品牌 profile 定义"这个号"的人设、口吻、禁用词、栏目与受众，供选题、写作、审稿、平台适配各环节统一遵循。由 `mediaops.profile.save/get/list` 工具管理：按本 schema 代码校验后，以 JSON 存于 `${CRABCODE_PLUGIN_DATA}/profiles/<brand_id>.json`（服务器零依赖，故用 JSON 而非 YAML 落盘；本文的 YAML 示例仅作字段说明）。用 `/media-style-collect` 从历史作品收集生成。

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `brand_id` | string | 是 | 品牌/账号唯一标识 |
| `name` | string | 是 | 品牌展示名 |
| `persona` | object | 是 | 人设：身份、专业领域、立场 |
| `voice` | object | 是 | 口吻：语气、人称、正式度、emoji 使用 |
| `audience` | object | 是 | 目标受众：人群、痛点、阅读场景 |
| `columns` | list | 是 | 栏目/内容系列 |
| `platforms` | list | 是 | 常用平台及各自栏目映射 |
| `banned_words` | list | 是 | 禁用词/敏感表述（写作与 readiness 校验用） |
| `style_refs` | list | 否 | 标杆稿件参考（仅供风格参照，不复制） |
| `compliance` | object | 是 | 合规：AI 标识文案、需回避的领域 |

## YAML 示例

```yaml
brand_id: tech-daily
name: 科技日读
persona:
  identity: 面向开发者的科技内容栏目
  domain: [软件工程, 开源, AI 应用]
  stance: 务实、不吹捧、重证据
voice:
  tone: 专业但不端着，偶尔幽默
  person: 第一人称复数（我们）
  formality: medium
  emoji: 小红书适度使用，公众号克制
audience:
  segments: [一线工程师, 技术管理者]
  pain_points: [信息过载, 需要可落地的判断]
  reading_context: 通勤碎片时间为主
columns:
  - name: 一周技术速览
    cadence: weekly
  - name: 深度拆解
    cadence: biweekly
platforms:
  - platform: wechat
    columns: [深度拆解]
    default_type: news
  - platform: xiaohongshu
    columns: [一周技术速览]
banned_words: [震惊, 必看, 史上最强, 颠覆]
style_refs:
  - note: 仅参考叙事节奏，不复制原文
compliance:
  ai_label_text: 本文由 AI 辅助创作
  avoid_domains: [荐股, 医疗诊断]
```

## 使用约定
- 写作前经 `mediaops.profile.get` 加载对应 `brand_id` 的 profile（硬步骤）；`voice` 决定语气。
- `banned_words` 与 `compliance.ai_label_text` 由 `mediaops.readiness.inspect` 硬校验——调用时传 `brandId` 即自动读通，无需手抄清单。
- `compliance.ai_label_text` 是成稿末尾固定 AI 辅助标识来源（详见 `ai-labeling-compliance.md`）。
- `content.save` 时带 `profileId`，留稿件与 profile 的关联痕迹。
- profile 是配置不是稿件来源；事实仍以 brief 的可信来源为准。
