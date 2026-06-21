# Knowledge-Work 插件转化方案(上游 → CrabCode 去品牌化)

- **日期**: 2026-06-21
- **上游**: `anthropics/knowledge-work-plugins`(已 `git clone` 至 `/tmp/kwp-recon` 侦察)
- **性质**: 方案存档,**尚未实施**;待拍板后再落地
- **已定决策**:命名加 `crabwork-` 前缀 / category 按职能拆域 / 16 个全转但 **legal、finance 通用版不转(改为参考优化现有中国版)** → 实际转化 **14 个插件**

---

## 一、范围:14 个转化 + 2 个参考优化

### 转化(14 个 → `crabwork-*`)

| 上游 | 目标 name | skills | 备注 |
|---|---|---|---|
| engineering | `crabwork-engineering` | 10 | |
| data | `crabwork-data` | 10 | |
| sales | `crabwork-sales` | 9 | |
| marketing | `crabwork-marketing` | 8 | |
| customer-support | `crabwork-customer-support` | 5 | |
| product-management | `crabwork-product-management` | 8 + 1 command(brainstorm) | 唯一带 command |
| human-resources | `crabwork-hr` | 9 | |
| design | `crabwork-design` | 7 | |
| operations | `crabwork-operations` | 9 | |
| productivity | `crabwork-productivity` | 4 | |
| enterprise-search | `crabwork-enterprise-search` | 5 | |
| cowork-plugin-management | `crabwork-plugin-management` | 2 | 与 crabcode-setup 思路近,定位区分 |
| bio-research | `crabwork-bio-research` | 6 | 垂直研究,难度中 |
| small-business | `crabwork-small-business` | **31** | 全家桶,含 smb-router 路由器;最重 |

合计约 **123 个 skill**(原计 140 减去 legal 9 + finance 8)。

### 不转,改为参考优化(2 个)

上游 `legal`(9 skills)、`finance`(8 skills)**不转化成插件**。改为:对照上游通用版的 skill 清单,审视现有 `crablaw-cn`(matter-core / cn-contract / cn-data-compliance / cn-labor-employment)、`crabfin-cn`(7 子) 是否有**可借鉴的通用能力点缺口**,产出优化建议清单(不直接改插件,见第六节)。

### 排除(4 个 partner-built)

`slack-by-salesforce` / `apollo` / `common-room` / `brand-voice` —— 合作方商业产品,不转。
**待确认**:上游 `pdf-viewer` 目录不在 marketplace plugins 列表(疑似被某些插件引用的查看器组件),实施时需确认 small-business 等是否依赖它。

---

## 二、category 设计(按职能拆 4 个新域)

| 新 category(slug) | 成员 | 数量 |
|---|---|---|
| `eng-data` | crabwork-engineering, crabwork-data | 2 |
| `go-to-market` | crabwork-sales, crabwork-marketing, crabwork-customer-support | 3 |
| `biz-ops` | crabwork-hr, crabwork-operations, crabwork-product-management, crabwork-design | 4 |
| `work-platform` | crabwork-productivity, crabwork-enterprise-search, crabwork-plugin-management, crabwork-bio-research | 4 |

> `crabwork-bio-research` 暂归 `work-platform`(垂直研究),如需可单列;13 个总计放进 4 域。
> 叠加《2026-06-21-分类归并方案》的 11 域 → 全仓 **15 个 category**。

---

## 三、去品牌化规则(逐插件统一套用)

1. **目录**:`plugins/crabwork-<name>/`
2. **清单迁移**:`.claude-plugin/plugin.json` → `.crabcode-plugin/plugin.json`(CrabCode 自有约定)
3. **plugin.json 改写**:
   - `name` → `crabwork-*`
   - `author.name`: `Anthropic` → `CrabCode`
   - `version` → `0.1.0`(对齐全仓统一版本)
   - 补 `license`(**待确认**上游 LICENSE 类型,见第五节)、`keywords`
   - 补 `skills[]` 显式声明(上游靠自动发现;CrabCode 走 office-suite 范式,显式列出每个 `./skills/xxx`)
4. **正文去品牌化(约 314 处)**:
   - `Claude Code` → `CrabCode`
   - 独立的 `Claude` → `CrabCode`(指代 AI 助手处)
   - `Anthropic` → `CrabCode`
   - ⚠️ 批量替换有语义风险,**需逐文件 review**(避免误伤如指向上游文档的链接、专有名词)。README/CONNECTORS.md 是品牌字样重灾区。
5. **`.mcp.json` 处理(13 个含 oauth)**:
   - **保留**第三方连接器 URL(slack/linear/asana/atlassian/notion/github/pagerduty/datadog/gcal/gmail —— 真实服务)
   - **移除/置空** Anthropic 注册的 `oauth.clientId`(那是 Anthropic 的应用凭据,下游用会失效/串号)→ 由下游自配。**待确认处理方式**(移除整个 oauth 块 vs 置空 clientId)。
6. **README / CONNECTORS.md**:去品牌化后保留(对用户有用),同步改 name/链接。
7. **marketplace.json 注册**:每个加条目,**全中文展示字段**:
   - `displayName` / `shortDescription` / `longDescription` / `defaultPrompt[]`(中文)
   - `brandColor`: `#f97316`(全仓统一橙)
   - `source`: `./`(对齐现有约定) / `category`(第二节) / `tags[]`
   - `description`(英文,保留)

---

## 四、执行流水线(实施时)

1. **定样板**:先手工转 `crabwork-engineering`(中等体量、纯 skill),确立去品牌化 + 格式 + 中文文案标准。
2. **批量套用**:其余 13 个用 Agent 并行转化(每 agent 1 插件,独立无冲突),严格套样板规范。`small-business`(31 skill)单独分配并预留更多预算。
3. **统一注册**:我汇总 14 个条目集中写入 `marketplace.json`(避免并发写冲突),并补 4 个新 category。
4. **验证**:目录↔marketplace 交叉核对、`plugin.json` 字段扫描、残留品牌字样 grep 复查(`grep -rIi 'claude\|anthropic'`)、skills[] 路径有效性。

---

## 五、待确认 / 风险

1. **LICENSE 类型**:上游 `LICENSE`(11.6KB)具体许可未核;转化需在 plugin.json 写明并保留上游版权声明/NOTICE(合规)。
2. **oauth clientId 处理方式**:移除 vs 置空(第三节 5)。
3. **品牌替换语义安全**:314 处批量替换需 review,防误伤链接/专名。
4. **中文展示文案量**:14 个 × 多字段,需逐个撰写(实施时产出)。
5. **pdf-viewer 依赖**:small-business 等是否引用,需确认是否一并带入。
6. **MCP 连接器与现有插件重叠**:上游 .mcp.json 引用的 linear/asana/github 等,CrabCode 已有独立连接器插件(linear/asana/github),需说明二者关系(crabwork-* 内置连接是"开箱可用",独立连接器是"细粒度")。

---

## 六、legal / finance 参考优化(独立子任务,不改插件)

1. 拉出上游 `legal`(9 skills)、`finance`(8 skills)的 skill 清单与各自 `description`。
2. 对照现有 `crablaw-cn` / `crabfin-cn` 的 skill 覆盖,找出**上游有、中国版无的通用能力点**(如通用合同审查流程、对账/差异分析框架等可本地化复用的骨架)。
3. 产出"可借鉴优化清单",标注每项是否适合并入中国版(注意:中国版有合规/法规本地化要求,通用版仅作骨架参考)。
4. 交付为建议文档,**不直接修改** crablaw-cn / crabfin-cn。

---

## 附:上游事实快照(侦察所得)

- 上游 marketplace owner = Anthropic;自建 16 + partner-built 4。
- 全部纯 skills 架构(无 agents);仅 product-management 带 1 command。
- 每插件含 `.mcp.json`(http 连接器)+ `CONNECTORS.md` + `README.md`。
- skill 数:engineering 10 / data 10 / sales 9 / legal 9 / hr 9 / operations 9 / finance 8 / marketing 8 / product-management 8 / design 7 / bio-research 6 / customer-support 5 / enterprise-search 5 / productivity 4 / cowork 2 / **small-business 31**。
