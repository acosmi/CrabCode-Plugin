# 能力路由注册表与跨插件引用引导规范

> 生效日期:2026-07-04 · 依据:《2026-07-04-复核复审与跨插件引用引导实施方案》决策 DG1/DG4
>
> 解决的问题:垂直领域插件(法律/金融/媒体等)需要产出 Word/Excel/PPT/PDF 或开展深度调研时,模型不知道该路由到哪个供给插件。本规范把"引用引导"从口头约定升级为机器可校验的合同。

## 1. 机制背景(为什么这样设计)

CrabCode 运行时的事实约束(源码取证见实施方案第二部分§3):

- 技能清单只向模型注入 frontmatter 的 `description`(+`when_to_use`),单条上限 250 字符;**技能正文只在被调用时注入**,此时模型仍可触发其他插件的技能;
- 跨插件触发使用全限定名 **`插件名:技能名`**(如 `crabcode-office-suite:crabcode-documents`);
- 触发未安装插件的技能会得到 `Unknown skill` 错误,**不会自动安装**;
- `plugin.json` 的 `dependencies` 字段语义很强:装载期依赖未启用会导致**整个插件降级不可用**。

由此推出分层三件套(DG1):

| 层 | 适用 | 手段 |
|---|---|---|
| ① 核心依赖 | 缺了主流程无法交付(如软著申请之于办公套件) | `plugin.json` `dependencies` 声明(慎用:缺依赖→整插件降级) |
| ② 可选产出 | 交付物可选升级(如法律 memo 可选 Word 版) | SKILL.md 正文"产出物路由"标准段,写全限定名 |
| ③ 重流程插件 | 多步骤工作流开场即知依赖 | 开场依赖自检(crabcopyright-cn `apply-manager` 范式) |

## 2. 注册表(`docs/capability-routing.json`)

机器可读的能力域登记表,`lint:refs`(`scripts/validate-references.ts`)以它为数据源。字段:

- `id`:能力 id(豁免标记引用它);
- `domain`:能力域中文名(告警文案用);
- `keywords`:触发关键词组(命中即要求路由或豁免;ASCII 关键词按词边界匹配,不会误伤 `excellent`/`pptx-free` 之类);
- `providers[]`:供给方全限定技能名 + `status`(`available`=必须真实存在;`planned`=立项未就位);
- `providerPlugins[]`:供给插件名(供给侧自身不受该能力的关键词告警约束);
- `domainSpecific[]`:域内专用供给(登记分工边界,防止重复建设;条目必须真实存在)。

新增能力域或调整关键词**只改注册表**,校验器零改码。

## 3. 路由段标准模板(G0-2)

### 3.1 可选产出(provider 已就位)

在需求侧 SKILL.md 正文(建议靠近产出物说明处)加一段:

```markdown
## 产出物路由

- 需要交付 Word 版成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
  电子表格用 `crabcode-office-suite:crabcode-spreadsheets`,演示文稿用
  `crabcode-office-suite:crabcode-presentations`,PDF 用 `crabcode-office-suite:crabcode-pdf`。
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装
  `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现内容供用户确认。
```

只写本技能真正会用到的 provider,不必四个全列;措辞可融入技能自身语境,但**全限定名必须逐字出现**(校验器按它判定已路由)。

### 3.2 能力未就位(provider 为 planned)

```markdown
## 调研升级路径
<!-- capability-route: deep-research=pending(通用调研插件立项中,见 docs/capability-routing.json) -->

- 本技能的调研以用户提供的材料为边界;需要联网深度调研时,建议用户补充检索材料,
  或在具备 WebSearch/WebFetch 工具的会话中直接检索(遵守本域渠道合规约束)。
- 通用深度调研插件(`crabcode-deep-research`)就位后,本段改为全限定名路由;
  届时 lint:refs 会对 pending 标记发出升级提示。
```

**不要在 provider 就位前写它的全限定名**——那是死链,`lint:refs` 按 error 拦截。

### 3.3 显式豁免

技能命中关键词但确无路由价值时(如"表格化审查"产出的是 markdown 工作底稿):

```markdown
<!-- capability-route: office-spreadsheets=none(概念性表格,交付物为 markdown 工作底稿,无文件产出) -->
```

- 语法:`<!-- capability-route: <能力id>=none(理由) -->`,多能力用逗号分隔;
- `none(理由)` 不带 id 为全豁免(慎用:会同时豁免该文件所有能力域的告警,后加的关键词命中也会被吞掉);
- 理由必填,毁灭性复核会核对理由是否成立。

### 3.4 开场依赖自检(重流程插件)

参照 `crabcopyright-cn/apply-core/skills/apply-manager/SKILL.md`:工作流第一步探测所需技能是否可用(如让模型确认清单中是否存在 `crabcode-office-suite:crabcode-pdf`),不可用则暂停并引导用户 `/plugin` 安装,避免流程走到一半才发现缺依赖。

## 4. 校验规则(`bun run lint:refs`,DG4 两级口径)

**error(阻断)**——确定性事实:

1. 反引号包裹的 `插件:技能` 引用,插件存在但技能不存在(死链);
2. 引用了注册表 planned 插件的全限定名(provider 未就位);
3. 引用 `mcp__<server>__*` 工具但插件 `.mcp.json` 未声明该 server(`mcp__plugin_*` 命名空间的教学示例除外);
4. 引用上游容器路径 `/mnt/skills/...`;
5. 注册表自身完整性:available provider 或 domainSpecific 条目解析不到实体。

**warning(不阻断,需要收敛到零)**——含判断,允许豁免:

6. SKILL.md 命中能力关键词但既无 provider 全限定名、又无 `none`/`pending` 标记;
7. `pending` 标记对应的 provider 已就位(该升级成全限定名路由了);
8. 标记语法错误或引用了不存在的能力 id。

## 5. 能力路由全景矩阵(G3-1 扫描裁决,2026-07-04)

以注册表为轴对全 73 插件的横向能力 × 垂直域缺口扫描结论:

| 能力域 | 需求侧证据 | 供给方 | 裁决 |
|---|---|---|---|
| 办公文档产出(四子域) | 65+ 技能命中 | `crabcode-office-suite` 四技能 | **已执法**:keywords 强制,G1 铺开后全库路由/豁免覆盖 100% |
| 深度调研 | 31+ 技能提及 | `crabcode-deep-research`(planned) | **pending 机制托管**:设计稿待评审,就位后 lint:refs 自动提示切换;bio-research(PubMed MCP)/matter-deep-analysis/trend-researcher 登记为域内专用不合并 |
| 媒体发布 | small-business 2 技能(公众号/自媒体投放) | `crabcode-media-ops`(media-ops/media-platform-adapter) | **已执法**:注册 keywords(公众号/自媒体),需求侧已路由 |
| 内容法律风险审查(反向) | media-ops 稿件营销宣称/侵权疑虑 | `crablaw-cn`(marketing-claims-review/infringement-triage) | **登记不执法**:media-ops 已加审批前路由;"侵权/法律风险"等关键词过泛会误伤 crabcopyright 全域,故 keywords 留空,靠登记发现 + 死链保护 |
| 数据可视化 | marketing/product-management/operations 等 4-5 技能(报表图表) | 分散:office-suite 图表(工作簿内)、crabwork-data(分析)、example-skills(HTML 产物) | **候选暂缓**:工作簿内图表已被 office-spreadsheets 覆盖;独立"HTML 仪表盘"无单一干净供给方,现在注册会制造无处路由的告警。待出现专职 provider 再登记 |
| marketplace `groups` 工作流编排(如"法律文书流"组合) | — | marketplace schema 支持 | **暂缓**:属锦上添花,未经运行时实测,不在本批引入;后续需要时按 07-01 试点流程验证再上 |

新插件准入:`lint:refs` 已挂 `bun run validate` 与 CI(ci.yml),死链拦截与路由告警自动执行,规范即 CI 强制(G3-2)。

## 6. dependencies 语义警示(写给插件作者)

`plugin.json` 的 `dependencies` 是**强依赖**:安装期会 DFS 闭包自动安装(跨 marketplace 默认阻断),装载期任一依赖未启用则**本插件整体降级不可用**。只在"缺了它主流程无法交付"时使用;可选产出一律走正文路由段,否则会出现"没装办公套件的用户连法律插件都用不了"的过度伤害。
