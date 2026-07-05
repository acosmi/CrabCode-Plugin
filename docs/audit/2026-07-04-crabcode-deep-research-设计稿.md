# crabcode-deep-research 通用深度调研插件 · 设计稿

> 日期:2026-07-04 · 状态:**设计稿,评审通过后动工**(注册表状态 planned)
> 依据:《2026-07-04-复核复审与跨插件引用引导实施方案》决策 DG3、批次 G2-2
> 需求底数:全库 31+ 个技能提及联网调研/检索,统一供给方为零;各域自建互不复用。

## 1. 定位与边界

- **定位**:插件库"深度调研"能力域的通用供给方,负责"多源检索 → 对抗核验 → 引用留痕"的完整流水线;垂直域技能通过全限定名 `crabcode-deep-research:deep-research` 路由并传入域约束参数。
- **不做**(与已验证的域内设计划界,防止重复建设——已在 `docs/capability-routing.json` domainSpecific 登记):
  - `crablaw-cn:matter-deep-analysis` 的**案卷文档尽调**(基于当事人材料的三层信任隔离分析,非联网检索)保留域内,不合并;
  - `crabcode-media-ops` `trend-researcher` 代理的**热点取材**(与 media-ops 取材溯源留痕硬约束耦合)保留域内,不合并。

## 2. 插件结构

```
plugins/crabcode-deep-research/
├── .crabcode-plugin/plugin.json     # name: crabcode-deep-research
├── README.md                        # 定位 + 能力路由声明(供给方)
├── docs/legal/THIRD_PARTY_NOTICES.md# 如有上游引用
└── skills/
    └── deep-research/SKILL.md       # 唯一入口技能(FQN 即注册表 provider)
```

单技能设计:调研的分层(快查/深查)由参数与流程控制,不拆多个技能——保持清单预算占用最小(description ≤250 字符)。

## 3. 域约束参数化(调用方合同)

调用方(垂直域技能的路由段)在触发时随任务传入:

| 参数 | 语义 | 缺省 |
|---|---|---|
| `channels` | 渠道白名单(如法律域:国家法律法规数据库、裁判文书公开平台、国家知识产权局检索系统) | 无限制(通用网页检索) |
| `language` | 检索语言优先级 | 中文优先 |
| `freshness` | 时效要求(如"近 12 个月"/"不限") | 不限 |
| `evidence` | 证据强度要求:`strict`(每一结论至少两独立来源)/`normal` | normal |
| `scope` | 调研问题边界描述 | 必填 |

法律域调用时必须传 `channels`(境内合规渠道白名单)——这是 crablaw 各技能"调研升级路径"段已经承诺的约束,插件侧按白名单过滤检索目标,白名单外来源仅可作线索、不得作为结论证据。

## 4. 流水线(三段硬 gate)

1. **多源检索(fan-out)**:按 `scope` 拆解子问题;每个子问题多路检索(WebSearch 关键词多组改写 + WebFetch 深读候选页);渠道受 `channels` 约束;每条候选证据记录:来源 URL、抓取时间、原文摘录、与子问题的关联。
2. **对抗核验(hard gate,仿 media-ops fact-checker"存疑项清零或人工放行")**:对每条拟采信证据做反向核验(来源可靠性、是否二手转述、时效是否满足 `freshness`、同主题是否存在矛盾来源);矛盾/存疑项要么补检索消解,要么显式列入"存疑清单"由用户人工放行——**不得静默采信**。
3. **引用留痕(citations 落盘)**:交付物为结构化调研报告(markdown),含:结论摘要 → 分论点(每条挂引用编号)→ 证据表(编号/来源/时间/摘录)→ 存疑清单 → 检索过程记录(用过的关键词组与渠道)。用户要求文件交付时按能力路由走 `crabcode-office-suite:crabcode-documents`。

## 5. 供给侧文案(就位时落地)

- description(≤250 字符,中英触发词):深度调研、联网检索、多源核验、行业研究、尽调检索、deep research、web research 等场景词;
- README 声明本插件为注册表 `deep-research` 能力域供给方;
- `docs/capability-routing.json`:provider status `planned → available`。

## 6. 就位切换机制(已内建,零人工排查)

需求侧现状为 `<!-- capability-route: deep-research=pending(...) -->` + "调研升级路径"措辞(31+ 技能)。插件入库后,`lint:refs` 对"pending 但 provider 已就位"自动发 warning 升级提示,逐技能改为全限定名路由即可——切换点由校验器驱动,不依赖人工记忆。

## 7. 评审清单(动工前需确认)

- [ ] 渠道白名单机制是否满足法律域合规要求(cn-legal-aid/research-start 的渠道约束原文为准);
- [ ] 对抗核验 gate 的"存疑项人工放行"交互是否可接受(会打断全自动流程,这是刻意设计);
- [ ] 单技能 vs 多技能(快查/深查拆分)取舍;
- [ ] 是否需要 `.mcp.json`(现设计只用 WebSearch/WebFetch 内建工具,无外部 MCP 依赖)。
