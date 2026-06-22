# Marketplace 大类(category)重分类 — 审计根因与实施方案

- **日期**: 2026-06-22
- **基准**: `main`(上一里程碑 `43390df` 已推送 `origin/main`)
- **目标文件**: `.crabcode-plugin/marketplace.json`(73 条目)
- **状态**: 方案已定稿,**待用户批准后执行**;本文档自包含,清空上下文后可独立实施。
- **前序关联**: `docs/audit/2026-06-21-工作流模型对齐审计与实施方案.md`(tier/groups 两层模型)、`docs/handoff/2026-06-21-下游字段契约.md`(tier/groups 跨端契约)。

---

## ★ 0. 用户原始需求(verbatim,勿改写)

> **需求一(原话)**:
> 「我看你讲内容与办公 纳入到一起,这是不对的,内容和办公可以在一起,但是媒体必须要独立;工作平台 改成企业工作台; 基础必备讲记忆管理也纳入,记忆管理要独立。重新分类先全链路审计根因后出计划不要直接实施」

> **需求二(命名授权 + 深度要求,原话)**:
> 「你来帮我选择,采取合理最优方案,按照我原始需求意思来,总之不要过度的集中,分类一定要搞清晰,媒体运营和办公完全就是两类不同的插件你之前错误混在一起是不对的,请最大思考深度思考举一反三深入」

> **需求三(边界确认)**:content-office 里的 `frontend-design`(前端设计)→ **留在 content-office**(用户已确认)。

> **需求四(本文档)**:「根据审计结果出实施方案,方案顶部要将我的原始需求写入,给我路径我要清空上下文」

**从原话提炼的硬性原则**:
1. 每个大类必须是**单一清晰类型**,杜绝大杂烩(媒体≠办公是典型反例)。
2. **不要过度集中** —— 不同类型不能硬塞进同一大类。
3. **举一反三** —— 不止修用户点名的三处,全仓同类混类问题一并揪出。
4. 命名决策授权给执行者,取"合理最优",但须忠于原始需求语义。
5. **先审计根因 → 再出计划 → 批准后才实施**;破坏性/对外操作前一律停下等用户确认。

---

## ★ 1. 全链路审计与根因(只读,已核验)

### 根因①:`category` 在仓库里是「两套互不相干的概念」,勿混
| 概念 | 取值 | 消费方 | 与本次关系 |
|---|---|---|---|
| **marketplace 的 `category`** | `language-server`/`content-office`/`work-platform`/`essentials` … 15 个 kebab | 仅 `marketplace.json` 自身 + 校验器把它当必填项 | ✅ **本次重分类对象** |
| **`AutomationCategory`** (`src/types.ts:1`) | `mcp/skill/hook/agent/plugin/workflow` | 推荐引擎 `src/recommendations/{ranker,rules,catalog}.ts`、`src/render/markdown.ts` | ❌ 与导航大类无关,**绝对不要碰** |

### 根因②:marketplace 的 `category` 是**无白名单的自由字符串**
- 校验器 `src/policy/marketplaceValidator.ts:32` 仅把 `category` 列入 `REQUIRED_ENTRY_FIELDS`(必填且非空),**无任何枚举/合法值校验**;测试 `tests/validators/marketplace.test.ts` 中用 `"tools"`、`"c"` 等随意值都能通过。
- **推论(关键)**:改 category 取值 = **纯数据改动**,只动 `marketplace.json`,不触代码、不破三校验、不破测试。

### 根因③:仓库**没有任何 `category → 中文名` 映射表**
- category 只是裸 kebab id,中文名当前无处存档(此前对话中的中文名均为口头临时译)。
- **推论**:像「工作平台改成企业工作台」这类诉求,唯一能稳定承载语义的载体就是 **kebab id 本身**;要让中文名正式落地,须新建一张分类元数据表(见第 4 节配套)。

### 举一反三:全仓 15 大类逐类体检结果
除用户点名的 3 处外,另发现 3 处同型大杂烩:
- **essentials** 还混入两个示例插件(本质 demo)。
- **security** 混入 `hookify`(通用钩子工具,非安全)。
- **dev-tools** 是最大杂烩:9 条混了「造扩展的工具」+「外部代码服务连接器」两类。

---

## ★ 2. 决策记录(已定,执行时照此)

| 决策点 | 结论 | 依据 |
|---|---|---|
| 工作平台命名 | **改 kebab id 为 `enterprise-workbench`**(中文「企业工作台」) | 根因③:中文名无处落档,id 是唯一稳定语义载体 |
| frontend-design 归属 | **留在 content-office** | 用户已确认 |
| bio-research / plugin-management 边界 | **默认不动**(第三档存疑项,未获额外指示前保留原位) | 避免过度拆分 crabwork 产品族 |

---

## ★ 3. 实施改动清单(逐条,精确到 entry)

> 全部为修改 `marketplace.json` 中对应条目的 `category` 字段值。**只改 category,其余字段一字不动。**

### 第一档 —— 用户点名(必做)
| entry `name` | category: 旧 → 新 |
|---|---|
| `crabcode-media-ops` | `content-office` → `media-ops` |
| `crabcode-memory-management` | `essentials` → `memory` |
| `crabwork-productivity` | `work-platform` → `enterprise-workbench` |
| `crabwork-enterprise-search` | `work-platform` → `enterprise-workbench` |
| `crabwork-plugin-management` | `work-platform` → `enterprise-workbench` |
| `crabwork-bio-research` | `work-platform` → `enterprise-workbench` |
| `crabwork-small-business` | `work-platform` → `enterprise-workbench` |

### 第二档 —— 举一反三(建议一并做)
| entry `name` | category: 旧 → 新 | 理由 |
|---|---|---|
| `crabcode-example-plugin` | `essentials` → `showcase` | 本质是 demo/参考,归示例与演示 |
| `crabcode-example-skills` | `essentials` → `showcase` | 同上 |
| `hookify` | `security` → `dev-tools` | 通用钩子规则配置工具,非安全专属 |
| `context7` | `dev-tools` → `code-tools` | 外部代码服务连接器 |
| `greptile` | `dev-tools` → `code-tools` | 外部代码服务连接器 |
| `laravel-boost` | `dev-tools` → `code-tools` | 外部代码服务连接器 |
| `serena` | `dev-tools` → `code-tools` | 外部代码服务连接器 |

> 合计:第一档 7 条 + 第二档 7 条 = **14 条 category 值变更**。其余 59 条不变。

### 第三档 —— 存疑项(默认不执行,除非用户另行指示)
- `crabwork-bio-research`:是否从 enterprise-workbench 单列为「行业垂直/research」?
- `crabwork-plugin-management` 与 `builder-hub` 语义重叠,是否合并归位?

---

## ★ 4. 整改后最终形态(18 大类 / 73 条,已核平)

| category id | 中文名 | 数 | 变化 | 成员 |
|---|---|---:|---|---|
| `language-server` | 语言服务 | 12 | — | 12 个 *-lsp |
| `integrations` | 第三方集成 | 11 | — | asana, discord, fakechat, firebase, github, gitlab, imessage, linear, playwright, telegram, terraform |
| `dev-workflow` | 开发工作流 | 8 | — | code-modernization, code-review, code-simplifier, commit-commands, feature-dev, pr-review-toolkit, session-report, ralph-loop |
| `showcase` | 示例与演示 | 6 | +2 | cn-legal-study, cwc-makers, math-olympiad, playground, **crabcode-example-plugin**, **crabcode-example-skills** |
| `dev-tools` | 开发工具(扩展) | 6 | -4 连接器 +hookify | agent-sdk-dev, mcp-server-dev, plugin-dev, skill-creator, ai-api-dev, **hookify** |
| `enterprise-workbench` | 企业工作台 | 5 | 原 work-platform 改名 | crabwork-productivity, -enterprise-search, -plugin-management, -bio-research, -small-business |
| `code-tools` | 代码工具连接器 | 4 | 🆕 | context7, greptile, laravel-boost, serena |
| `biz-ops` | 业务运营 | 4 | — | crabwork-product-management, -hr, -design, -operations |
| `go-to-market` | 市场开拓 | 3 | — | crabwork-sales, -marketing, -customer-support |
| `content-office` | 内容与办公 | 2 | -1 媒体 | frontend-design, crabcode-office-suite |
| `essentials` | 基础必备 | 2 | -记忆 -2示例 | crabcode-setup, builder-hub |
| `security` | 安全 | 2 | -hookify | crabcode-security-review, security-guidance |
| `session-style` | 会话风格 | 2 | — | explanatory-output-style, learning-output-style |
| `eng-data` | 工程与数据 | 2 | — | crabwork-engineering, crabwork-data |
| `media-ops` | 媒体运营 | 1 | 🆕 | crabcode-media-ops |
| `memory` | 记忆管理 | 1 | 🆕 | crabcode-memory-management |
| `legal-workflow` | 法律工作流 | 1 | — | crablaw-cn |
| `finance` | 财务 | 1 | — | crabfin-cn |

**核平**:12+11+8+6+6+5+4+4+3+2+2+2+2+2+1+1+1+1 = **73** ✓
**新增大类**:`code-tools`、`media-ops`、`memory`(3 个);**改名**:`work-platform`→`enterprise-workbench`;**无大类被删除**(15 → 18)。

---

## ★ 5. 配套(推荐,唯一动代码的部分)

为让 18 个大类成为受校验的正式产物、从根上杜绝再混(直击根因②③):
1. 新建 **`.crabcode-plugin/categories.json`**,结构建议:
   ```json
   [{ "id": "enterprise-workbench", "displayName": "企业工作台", "description": "..." }, ...]
   ```
   把 18 个大类的 id→中文名→描述正式落档。
2. `src/policy/marketplaceValidator.ts` 增加**白名单校验**:每条 entry 的 `category` 必须 ∈ `categories.json` 的 id 集合,否则报 error。
3. 补对应单测。

> 该配套属"动代码/schema"范畴,需独立评审;若用户只批数据改动,可跳过此节,后续单独立项。

---

## ★ 6. 执行步骤与验证闸门

1. **改数据**:按第 3 节清单逐条改 `marketplace.json` 的 14 个 category 值(第三档默认不动)。
2.(可选)**配套**:第 5 节元数据表 + 白名单 + 单测。
3. **复核校验**(预期全 exit 0,因 category 无白名单约束):
   - `bun run lint:marketplace`
   - `bun run lint:manifest`
   - `bun run lint:layout`
   - (bun 二进制:`/Users/fushihua/.crabcode/bin/bun`)
4. **出对照报告**:改前/改后按 category 的条目分布对照,确认与第 4 节最终形态一致、总数仍 73。
5. **提交**(等用户确认范围后):commit message 须含 `Change:` 与 `Root cause:`。
6. **推送**(等用户确认):先个人远程后企业远程(实测仓库仅 `origin` 一个远程 = `https://github.com/acosmi/CrabCode-Plugin.git`),每次 push 前展示提交范围。

## ★ 7. 跨端契约提醒
- category id 变化(尤其 `work-platform`→`enterprise-workbench`、新增 `code-tools`/`media-ops`/`memory`)属与 tier/groups 同级的**下游契约变更**,需同步进 `docs/handoff/` 交接文档,通知下游导航更新映射。

---

## ★ 8. 风险与红线
- 仅改 `marketplace.json` 数据(第 1-2 步)**不触推荐引擎、不破三校验**(根因②已证)。
- **红线**:不得改动 `AutomationCategory`(`src/types.ts`)及推荐引擎——那是另一套无关概念(根因①)。
- **红线**:不得回滚/删除/覆盖任何其他改动;破坏性 git 操作前一律停下等确认。
