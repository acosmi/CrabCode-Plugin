# crabfin-cn 升级建议

- **日期**: 2026-06-23
- **来源**: 全仓库健康度审计 — 对照 crablaw-cn（法律）与 crabcode-media-ops（媒体运营）
- **性质**: 只读审计后的升级路线图，未做任何代码改动

---

## 现状速览

| 已有 | 缺失 |
|---|---|
| 7 子领域 / 54 skills | fin-core 缺 PRACTICE.md |
| 6/7 有 PRACTICE.md | 仅 1/12 核心 skill 有 TROUBLESHOOTING |
| 1 个校验脚本 (dcf) + 1 个提取脚本 (ib-check-deck) | 0 个 JSON Schema |
| 法规/映射/模板参考数据 | 0 个测试 / 0 个 sub-agent |

---

## P0 — 补齐硬缺口

### 1. fin-core 补 PRACTICE.md

fin-core 是 7 个子领域的底座，12 个 skills (dcf/lbo/three-statement/comps/xlsx 等) 全挂在这层。它是唯一缺 PRACTICE.md 的子领域，且偏偏是最关键的一层。应定义：

- 数据源优先级（巨潮资讯网 / Wind / 同花顺 的取数顺序与回退策略）
- 建模通用规范（CAS 口径、公式优先于硬编码、分步确认）
- 交付物质量标准（公式零错误、来源注释完备、敏感性分析覆盖）
- 中国版参数默认值（无风险利率用 10 年期国债、行业用申万分类）

### 2. 核心建模 skill 补 TROUBLESHOOTING.md

目前仅 `dcf-model` 有。以下 3 个同级别 skill 空缺：

| skill | 风险 |
|---|---|
| `lbo-model` | 杠杆模型公式链条更长，debt schedule 不收敛排查难 |
| `three-statement-model` | 三表勾稽，一处断则全盘错 |
| `comps-analysis` | 倍数选错一整份报告报废 |

参照 `dcf-model/TROUBLESHOOTING.md` 模板：常见错误 → 症状 → 根因 → 修复步骤，每个一份即可。

---

## P1 — 从同行插件借鉴

### 3. 补 JSON Schema（学 crablaw-cn）

crablaw-cn 有 13 个 schema 定义实体结构。crabfin-cn 目前全靠 SKILL.md 里的 csv 示例描述数据格式，无结构化约束。建议优先补：

```
fin-core/schemas/
  dcf-inputs.schema.json       ← dcf-model 的输入参数（营收/利润率/WACC/终值增长率）
  comps-data.schema.json       ← 可比公司数据行（代码/市值/EV/EBITDA/P/E）
  three-statement.schema.json  ← 三表科目映射（CAS 科目→模型行）
```

好处：agent 写模型时 schema 可校验输入完整性，降低"漏填关键参数导致全盘算错"的概率。

### 4. 扩展 validate 脚本覆盖（学 media-ops 的 defense-in-depth）

目前仅 `dcf-model` 有 `validate_dcf.py` 校验脚本；`ib-check-deck` 的 `extract_numbers.py` 是提取工具（含 `--check` 一致性检测），非公式校验。`lbo-model`、`three-statement-model` 和 `comps-analysis` 应各加一个校验脚本：

```
fin-core/skills/lbo-model/scripts/validate_lbo.py
  - debt schedule 是否收敛（期末债务→0 或目标杠杆）
  - IRR / MOIC 范围合理性
  - 现金流覆盖倍数 > 1
fin-core/skills/three-statement-model/scripts/validate_3sm.py
  - 资产负债表 A = L + E
  - 现金流量表间接法一致性
  - 科目跨表引用完整性
fin-core/skills/comps-analysis/scripts/validate_comps.py
  - 倍数异常值检测（±3σ）
  - 市值与 EV 一致性
  - 货币单位对齐
```

### 5. 补公式单元测试

crabfin-cn 目前 0 个测试。金融建模插件中，公式正确性的单元测试比 sub-agent 编排更直接保障可靠性。建议优先补：

```
fin-core/skills/dcf-model/tests/
  test_wacc.test.ts          ← WACC 加权计算（权重×成本求和）
  test_terminal_value.test.ts ← 终值公式（Gordon / Exit Multiple 两种算法）
  test_equity_bridge.test.ts  ← EV→Equity 桥接（减净债务）
fin-core/skills/three-statement-model/tests/
  test_balancing.test.ts     ← A = L + E 勾稽
  test_indirect_cf.test.ts   ← 间接法现金流与净利润衔接
fin-core/skills/comps-analysis/tests/
  test_multiples.test.ts     ← EV/EBITDA、P/E 计算正确性
```

好处：公式逻辑变更时测试立即捕获回归，比 validate 脚本（校验输出合理性）更早发现问题。

---

## P2 — 加固

### 6. 合规声明层

金融领域比媒体更敏感。参照 media-ops 的 D-10 AI 标识硬拦截，crabfin-cn 应将散落的合规要求集中化并加入编排入口校验：

- 所有模型输出必须注明：数据来源 / 日期 / 计价货币 / 适用准则（`cn-data-sources.md` 已有要求，但分散在底座参考文件中，缺编排入口校验）
- 估值结论必须含风险声明"本文不构成投资建议"（已有 11 处 skill 含此声明，但未集中定义）
- 禁止对个股给买入/卖出建议（合规红线）
- 禁止给出未经资质的税务/法律意见

建议新建 `fin-core/references/fin-guardrails.md` 集中定义，在 skill 编排入口处校验。

### 7. 示例数据（学 crablaw-cn）

crablaw-cn 有 3 套 demo 场景的 JSON 数据。crabfin-cn 只有脱敏模板（`.md`），没有可运行的示例数据：

```
examples/
  demo-a-share/        ← 一份 A 股公司的完整 DCF 输入+输出
  demo-hk-stock/       ← 港股示例
```

这比脱敏模板更直观，新用户/agent 可以直接跑通验证。

### 8. 补 sub-agent（学 crablaw-cn + media-ops）— 探索项

crablaw-cn 有 3 个 diligence agent 做多步协同。crabfin-cn 的 DCF 流程（SKILL.md 第 96-361 行）定义了 10 步 workthrough，理论上适合用 sub-agent 拆分：

```
agents/
  data-gatherer.md    ← Step 1-2: 取数 + 历史分析
  model-builder.md    ← Step 3-9: 建模到 equity bridge
  model-reviewer.md   ← Step 10 + validate: 敏感性 + 校验
```

**注意**：DCF 的取数与建模强耦合，拆成独立 agent 会增加协调成本。建议先在 DCF 单技能上验证此模式，确认可靠后再推广到 lbo/comps/three-statement，而非一开始就让 4 个建模 skill 共用一套 agent。

---

## 总结

| 优先级 | 事项 | 借鉴来源 | 工作量 |
|---|---|---|---|
| P0 | fin-core 补 PRACTICE.md | 自身缺口 | 低 |
| P0 | lbo/3sm/comps 补 TROUBLESHOOTING | 自身缺口 | 低 |
| P1 | 补 3 个 JSON Schema | crablaw-cn | 中 |
| P1 | 补 3 个 validate 脚本 | media-ops | 中 |
| P1 | 补公式单元测试 | 自身缺口 | 中 |
| P2 | 补合规声明层 (guardrails) | media-ops D-10 | 低 |
| P2 | 补 demo 示例数据 | crablaw-cn | 低 |
| P2 | 补 sub-agent（探索项，先 DCF 单技能验证） | crablaw-cn + media-ops | 中 |

核心逻辑：crabfin-cn 的知识深度没问题（54 skills 覆盖很全），短板在**工程化落地**——没有校验、没有 schema、没有测试、没有合规硬控。补上这些，估值建模的可靠性会从"全靠 agent 自觉"提升到"工具层兜底"。
