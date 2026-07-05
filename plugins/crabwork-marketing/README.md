# CrabWork 市场营销

面向市场营销团队的 CrabCode 插件:内容创作、活动策划、品牌声音管理、竞品分析与效果复盘。可独立使用(直接描述需求、粘贴文案、上传资料),连接设计、营销自动化、SEO 与分析工具后能力更强。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 市场营销」并安装,或通过 marketplace 添加 `crabwork-marketing`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `draft-content` | 撰写博客、社媒、邮件简报、落地页、新闻稿与案例,含分渠道排版与 SEO 建议 |
| `content-creation` | 内容创作底层能力:分渠道模板、写作规范、SEO 基础、标题公式与 CTA 指南 |
| `campaign-plan` | 生成完整活动简报:目标、受众、信息、渠道策略、内容日历与成功指标 |
| `brand-review` | 对照品牌声音、风格指南与信息支柱审查内容,按严重程度标注并给出修改建议 |
| `competitive-brief` | 调研竞品并输出定位与信息对比,含内容缺口、机会与威胁 |
| `performance-report` | 制作营销效果报告:关键指标、趋势分析、得失复盘与优先级优化建议 |
| `seo-audit` | 全面 SEO 审计:关键词研究、页面分析、内容缺口、技术检查与竞品对比 |
| `email-sequence` | 设计与撰写多封邮件序列:完整文案、时序、分支逻辑、退出条件与效果基准 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 内容创作 | 描述主题与受众 | 设计工具、知识库(品牌资产) |
| 活动策划 | 描述目标与预算 | 营销自动化、知识库、聊天工具 |
| 品牌审查 | 粘贴草稿 | 知识库(风格指南、信息支柱) |
| 竞品分析 | 描述竞争对手 | SEO、营销分析(流量与市场对标) |
| 效果报告 | 提供数据 | 产品分析、营销分析、营销自动化 |
| 邮件序列 | 描述流程目标 | 邮件营销平台 |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

| 类别 | 示例 | 启用能力 |
|---|---|---|
| 聊天 | Slack、Teams | 与团队共享草稿、报告与简报 |
| 设计 | Canva、Figma | 创建编辑设计素材、调用品牌资产 |
| 营销自动化 | HubSpot、Marketo | 拉取活动数据、管理联系人、跟踪营销自动化 |
| 产品分析 | Amplitude、Mixpanel | 产品行为与用户数据,用于效果报告 |
| 知识库 | Notion、Confluence | 简报、风格指南、活动文档 |
| SEO | Ahrefs、Similarweb | 关键词研究、外链分析、站点审计 |
| 邮件营销 | Klaviyo、Mailchimp | 撰写与审查邮件营销序列 |
| 营销分析 | Supermetrics | 跨平台拉取营销数据用于分析与报告 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-marketing/.crabcode/settings.local.json` 创建本地设置文件,配置品牌声音、风格指南与目标人群,即可让 `draft-content`、`brand-review` 等技能自动套用你的品牌标准,无需每次询问:

```json
{
  "brandName": "你的品牌",
  "voice": ["专业", "亲和", "自信"],
  "audience": ["中型 SaaS 公司的市场负责人"],
  "styleGuide": "句子简洁,避免行话,统一术语",
  "channels": ["博客", "LinkedIn", "邮件"]
}
```

未配置时,插件会在需要时主动询问相关信息。
