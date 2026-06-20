# CrabCode 插件仓库深度审计报告

- **日期**: 2026-06-20
- **范围**: `.crabcode-plugin/marketplace.json` 全部 59 个条目 + `plugins/*` 目录
- **性质**: 只读审计,未做任何代码/配置改动
- **核对方式**: 目录↔marketplace 交叉核对、plugin.json 字段扫描、组件构成统计

---

## 一、整体健康度:基础盘扎实 ✅

| 维度 | 结果 |
|---|---|
| marketplace 条目 | 59 个,**全部命中真实 `plugin.json`,零孤儿、零悬空引用** |
| 目录一致性 | `plugins/*` 与 marketplace 完全对齐,无"有目录没注册/有注册没目录" |
| 展示字段 | 59 个**全部齐全**(displayName / shortDescription / longDescription / defaultPrompt / brandColor / category / tags) |
| 版本 | 全部 `0.1.0`,统一 |
| 清单约定 | 统一用 CrabCode 自有的 `.crabcode-plugin/plugin.json`(非 `.claude-plugin/`) |

### 零散瑕疵(非阻塞)

- `crablaw-cn` 的 4 个子插件(matter-core / cn-contract / cn-data-compliance / cn-labor-employment)的 `plugin.json` **缺 `license` 和 `keywords`** —— 全仓只有这 4 个不一致。
- 分类里有 **`example`(单数) vs `examples`(复数)** 两个几乎同义的 category,各只挂 1 个插件,属笔误级重复。

---

## 二、分类现状:过度碎片化 ⚠️

59 个插件被拆进 **22 个 category**,其中 **11 个是"单例分类"**(只有 1 个插件):
`security / memory / code-quality / hardware / example / examples / database / testing / office / ai-dev / content-ops`。

更深的问题:**分类口径不统一**,混用了两种维度——
- 有的按**领域**分(legal-workflow、messaging、language-server)✅
- 有的按**交付机制**分(`skills` 这个分类把 frontend-design / math-olympiad / playground / skill-creator 凑一起,领域上互不相关)❌

### 当前 category 分布

| category | 数量 |
|---|---|
| language-server | 12 |
| productivity | 5 |
| workflow | 5 |
| development | 5 |
| legal-workflow | 4 |
| skills | 4 |
| messaging | 4 |
| agent-dev | 3 |
| code-review | 2 |
| guardrails | 2 |
| session-style | 2 |
| security / memory / code-quality / hardware / example / database / testing / office / examples / ai-dev / content-ops | 各 1 |

---

## 三、核心发现:"主插件 + 子板块按需带入"模型,仓库里已有两套**互相矛盾**的实现 🔑

下游"**先装主插件工作流,子板块按需带入输入框**"的设想,在仓库里**已经存在,但有两种做法,只有一种真正符合该意图**:

### 模式 A —— 单插件 + `skills[]` 声明(✅ 符合意图,推荐标准)

`crabcode-office-suite`(即"表格类插件")是活样板:

```
crabcode-office-suite/            ← 一个主插件
  .crabcode-plugin/plugin.json
    skills[]: [
      ./skills/crabcode-spreadsheets,
      ./skills/crabcode-documents,
      ./skills/crabcode-presentations,
      ./skills/crabcode-pdf
    ]
```

下游**只装这 1 个**,4 个子板块(表格/文档/演示/PDF)作为 skill 存在,CrabCode **按输入内容自动匹配、按需带入上下文**——完全是"装主插件→子板块按需上场"。
`crabcode-media-ops` 同路子(主插件内含 6 命令 + 5 智能体 + 3 skill)。

### 模式 B —— 容器目录 + N 个独立 marketplace 条目(❌ 与意图相反)

`crablaw-cn` 是反例:

```
crablaw-cn/            ← 只是个目录,本身不是 marketplace 条目
  matter-core/         ← 独立注册成 marketplace 插件
  cn-contract/         ← 独立注册
  cn-data-compliance/  ← 独立注册
  cn-labor-employment/ ← 独立注册
```

下游在市场里看到 **4 个并列插件**,得**自己一个个挑着装**,没有"主插件先行、子板块按需"的层级关系。

> **结论:** 模式 A(office-suite 的 `skills[]` 声明)才是"主+子板块按需带入"的标准范式。`crablaw-cn` 需按模式 A 重构(做一个 `crablaw-cn` 主插件,把 4 个领域作为 skills 声明进去),否则下游体验割裂。

---

## 四、建议的归并分类(22 → 8 大域)

按**领域**重新归并,并标注哪些适合做成"主插件+子板块":

| 建议大域 | 现有插件 | 是否适合"伞形主插件" |
|---|---|---|
| **① 语言服务** | 12 个 `*-lsp` | ✅ **强烈建议**:做 1 个 `crabcode-lsp` 主插件,12 种语言作为子板块按需带入(目前 12 个并列条目,最碎) |
| **② 研发工作流** | code-modernization, feature-dev, code-review, pr-review-toolkit, code-simplifier, commit-commands, session-report, ralph-loop | 可选:评审类(review/simplifier/pr)可合伞 |
| **③ 研发平台/工具** | context7, greptile, serena, laravel-boost, agent-sdk-dev, mcp-server-dev, plugin-dev, ai-api-dev | 保持独立(多为 MCP 连接器) |
| **④ 集成连接器** | discord, telegram, imessage, fakechat, asana, github, gitlab, linear, firebase, playwright, terraform | 多为 MCP,保持独立;messaging 4 个可合伞 |
| **⑤ 内容与办公** | crabcode-office-suite, crabcode-media-ops, frontend-design | ✅ 已是伞形(office-suite/media-ops),范式可复制 |
| **⑥ 法律** | crablaw-cn ×4 | ⏸️ **暂缓**:功能尚不健全,待补齐后再按伞形重构(见第三节) |
| **⑦ 安全与护栏** | crabcode-security-review, security-guidance, hookify | 可合伞 |
| **⑧ 会话/记忆/示例** | output-style ×2, memory, example ×2, playground, skill-creator, math-olympiad, cwc-makers | 合并 `example`/`examples`;按机制散落的归位 |

---

## 五、各插件组件构成明细(快照)

`cmds` = commands/*.md,`agents` = agents/*.md,`skills` = skills 子目录数,`hooks` = 有 hooks 目录,`mcp` = 有 .mcp.json 或声明 mcpServers。

| name | cmds | agents | skills | hooks | mcp |
|---|---|---|---|---|---|
| crabcode-setup | 1 | 0 | 1 | - | - |
| matter-core | 0 | 0 | 5 | - | - |
| cn-contract | 0 | 0 | 5 | - | - |
| cn-data-compliance | 0 | 0 | 5 | - | - |
| cn-labor-employment | 0 | 0 | 5 | - | - |
| crabcode-security-review | 1 | 0 | 1 | - | - |
| agent-sdk-dev | 1 | 2 | 0 | - | - |
| crabcode-memory-management | 1 | 0 | 1 | - | - |
| code-modernization | 7 | 5 | 0 | - | - |
| code-review | 1 | 0 | 0 | - | - |
| code-simplifier | 0 | 1 | 0 | - | - |
| commit-commands | 3 | 0 | 0 | - | - |
| cwc-makers | 1 | 0 | 2 | - | - |
| crabcode-example-plugin | 1 | 0 | 2 | - | ✓ |
| feature-dev | 1 | 3 | 0 | - | - |
| frontend-design | 0 | 0 | 1 | - | - |
| math-olympiad | 0 | 0 | 1 | - | - |
| mcp-server-dev | 0 | 0 | 3 | - | - |
| playground | 0 | 0 | 1 | - | - |
| plugin-dev | 1 | 3 | 7 | - | - |
| pr-review-toolkit | 1 | 6 | 0 | - | - |
| session-report | 0 | 0 | 1 | - | - |
| skill-creator | 0 | 0 | 1 | - | - |
| asana / context7 / fakechat / firebase / github / gitlab / greptile / laravel-boost / linear / playwright / serena / terraform | 0 | 0 | 0 | - | ✓ |
| discord / imessage / telegram | 0 | 0 | 2 | - | ✓ |
| 12 × `*-lsp` | 0 | 0 | 0 | - | ✓ |
| hookify | 4 | 1 | 1 | ✓ | - |
| security-guidance | 0 | 0 | 0 | ✓ | - |
| explanatory-output-style | 0 | 0 | 0 | ✓ | - |
| learning-output-style | 0 | 0 | 0 | ✓ | - |
| ralph-loop | 3 | 0 | 0 | ✓ | - |
| crabcode-office-suite | 0 | 0 | 4 | - | - |
| crabcode-example-skills | 0 | 0 | 12 | - | - |
| ai-api-dev | 0 | 0 | 1 | - | - |
| crabcode-media-ops | 6 | 5 | 3 | - | ✓ |

---

## 六、行动清单(待拍板,尚未实施)

按优先级:

1. 🔑 **定标准范式**:确认以 office-suite 的 `skills[]` 模式作为"主插件+子板块"统一标准。
2. ⏸️ **~~重构 crablaw-cn~~ —— 暂缓**:法律工作流功能尚不健全,待补齐功能后再做伞形重构与元数据补全。本轮**不动** crablaw-cn 的目录结构与 4 个子插件。
3. 🔧 **重构 12 个 LSP**:碎片化最严重、合伞收益最大的一簇。
4. 🧹 **分类归并**:22 → 8 大域;修掉 `example`/`examples` 重复;把按机制分的 `skills` 拆回领域。
5. ⏸️ **~~补 crablaw-cn 元数据~~ —— 暂缓**:`license`/`keywords` 随上面的法律工作流重构一并处理,本轮不单独动。

### 待定关键决策

1. **伞形标准**:统一走 office-suite 的 `skills[]` 单插件模式,还是保留 crablaw-cn 那种"容器+多条目"?(建议前者)
2. **重构范围**:LSP(12)和法律(4)本轮就合伞,还是先只做分类归并、暂不动目录结构?
