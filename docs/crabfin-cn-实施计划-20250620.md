# CrabFin-CN 实施计划（修订版 v2）

> 制定日期：2025-06-20 | 修订日期：2025-06-20
> 前置审计：[docs/crabfin-cn-毁灭性复核审计报告.md](./crabfin-cn-毁灭性复核审计报告.md)
> 关联分支：`task/crabfin-cn-implementation-20260620`
> 修订摘要：补充跨技能一致性、遗漏引用检测、惯例数值处理规则、阶段性校验、PRACTICE.md 对齐、skill-creator 深度优化

---

## 当前进度

| Step | 状态 | 说明 |
|:---:|:---:|------|
| 1 | ✅ 已完成 | sector-overview 行业代码修正（801080→801780, 801780→801220） |
| 2 | ✅ 已完成 | accrual-schedule/unit-economics 引用错位修正 |
| 3 | ⬜ 待执行 | 全量 source→skill 语义匹配排查（五维检查法） |
| 4 | ⬜ 待执行 | 全量硬编码数值交叉验证 |
| 5 | ⬜ 待执行 | git diff → git add |
| 6 | ⬜ 待执行 | 阶段性 + 最终校验 |
| 7 | ⬜ 待执行 | PRACTICE.md 技能描述 ↔ SKILL.md 对齐抽查 |
| 8 | ⬜ 待执行 | skill-creator 对 42 个技能深度优化 |

---

## 方案决策：根因修复 vs 快速修复

| 审计项 | 审计报告索引 | 根因方案 | 快速方案 | 选择 |
|------|:---:|------|------|:---:|
| #1 代码错误 | 审计项#1 | 修改 2 行 + 全量硬编码数值交叉验证 | 修改 2 行 | **根因** |
| #2 引用错位 | 审计项#2 | 修复 2 处 + 全量 source→skill 语义排查 | 修复 2 处 | **根因** |
| #3 git | 审计项#3 | `git add` + `git diff` 确认 | 同左 | 执行 |

**放弃快速方案的理由**：#1 仅改两行会在有人凭记忆写入数值时复发。#2 仅改已发现两处会留下未排查的 40 个技能中的潜在同类错误。

---

## 串行步骤

### Step 1：✅ 已完成 — 修复 sector-overview 行业代码

| 文件 | 行号 | old | new |
|------|:---:|------|------|
| `plugins/crabfin-cn/cn-equity-research/skills/sector-overview/SKILL.md` | 93 | `电子(801080)` | `电子(801780)` |
| 同上 | 97 | `银行(801780)` | `银行(801220)` |

**为何不再复发**：代码改为正确值后，与 `申万行业分类_2021.csv` 一致。配合 Step 4 全量排查消除同类风险。

**受影响的关联方**：sector-overview / morning-note / idea-generation / client-report / investment-proposal（修复后恢复正常）。

**验证输出**：
```
$ grep -n "801080\|801780\|801220" plugins/crabfin-cn/cn-equity-research/skills/sector-overview/SKILL.md
93:2. 电子(801780) — 半导体/消费电子
97:6. 银行(801220) — 高股息防御配置
# 801080 已清零 ✅
```

---

### Step 2：✅ 已完成 — 修复两处 source 引用错位

| 文件 | 改动 |
|------|------|
| `accrual-schedule/SKILL.md:9` | `依据 sources/laws/AMAC基金估值指引.md 的中国基金估值标准，按基金合同...` → `费用参数依据《基金合同》约定（管理费率/托管费率/业绩报酬计提方法），市场惯例区间参考如下。本技能生成...` |
| `unit-economics/SKILL.md:134` | `依据 sources/laws/AMAC私募备案要求.md 中不同资产类型的备案规模要求及行业一般基准：` → `以下行业基准来自市场惯例（非监管规定），供投资判断参考：` |

**为何不再复发**：剥离了不存在的"监管依据"标签，技能不会在回答"依据什么法规"时指向无关文档。配合 Step 3 全量排查消除同类风险。

**验证**：accrual-schedule 不再声称 AMAC 估值指引为其费用依据；unit-economics 行业基准表改为"市场惯例"标注。

---

### Step 3：⬜ 待执行 — 全量 source→skill 引用语义匹配排查（五维检查法）

**范围**：全部 42 个 SKILL.md 中的所有 source 引用声明。

**已读状态**：26/42 已读，16 个待读（process-letter 部分已读待补完）。

| 模块 | 已读 | 待读 | 待读技能 |
|------|:---:|:---:|------|
| cn-equity-research | 9/9 | 0 | — |
| cn-investment-banking | 7/9 | 2 | process-letter（已读 80%）、strip-profile |
| cn-private-equity | 4/10 | 6 | ai-readiness、dd-meeting-prep、deal-sourcing、ic-memo、portfolio-monitoring、value-creation-plan |
| cn-wealth | 3/6 | 3 | client-report、investment-proposal、portfolio-rebalance |
| cn-fund-admin | 5/6 | 1 | variance-commentary |
| cn-kyc-ops | 2/2 | 0 | — |

**方法：逐技能五维检查**

| # | 维度 | 检查问题 | 不通过时处理 |
|:---:|------|------|------|
| 1 | **声明匹配** | 引用的 source 是否包含技能声称的内容？ | 修正引用目标或标注为"惯例引用" |
| 2 | **遗漏引用** | 技能用到中国口径但未声明引用 source——是否应补引？ | 判定：法规事实→补引；市场常识→豁免 |
| 3 | **跨技能一致性** | 多个技能引用同一 source 中同一事实时，数值/口径是否一致？ | 不一致→以 source 为准，修正偏离方 |
| 4 | **反向覆盖** | 每个 source 文件是否至少被一个技能引用？ | 无引用→标记为"僵尸 source"，需确认是否误放 |
| 5 | **引用格式** | 引用路径是否正确（相对路径 vs 绝对路径、文件存在性）？ | 路径错误→修正 |

**维度 3 示例**：
- `deal-screening`、`dd-checklist`、`portfolio-monitoring` 均引用 AMAC 备案要求中的"实缴≥1000万"——三方是否一致？
- `merger-model`、`deal-tracker`、`pitch-deck` 均引用重组办法中"80%发行定价"——三方是否一致？

**维度 4 方法**：
```bash
# 列出所有 source 文件
find plugins/crabfin-cn/*/sources/ -type f ! -name "README.md" | sort
# 对每个 source 文件，grep 所有 SKILL.md 中是否有引用
# 未被任何技能引用的标记为"僵尸 source"
```

**产出**：五维检查结论表（42 行 × 5 列）。

**产出格式**：
| 技能 | 声明匹配 | 遗漏引用 | 跨技能一致 | 反向覆盖 | 引用格式 | 结论 |
|------|:---:|:---:|:---:|:---:|:---:|------|
| sector-overview | ✅ | — | ✅ | ✅ | ✅ | PASS |

**发现处理规则**：
- 声明不匹配 → 立即修正（同 Step 2 模式）
- 遗漏引用 → 判定是否补引（法规事实补引 / 市场常识豁免）
- 跨技能不一致 → 以 source 原文为准修正
- 僵尸 source → 记录在案，不阻断交付
- 引用格式错误 → 立即修正

---

### Step 4：⬜ 待执行 — 全量硬编码数值交叉验证

**范围**：42 个 SKILL.md 中的中国口径硬编码数值。

**数值分级与处理规则**：

| 级别 | 来源类型 | 验证方式 | 发现差异时 |
|:---:|------|------|------|
| **R1 法规值** | 法规原文中的阈值/金额/日期（如重组办法"50%"） | 对照 source 原文逐条核对 | **按错误论**，立即修正 |
| **R2 惯例值** | 市场惯例区间（如"管理费 1-2%"、"SaaS 毛利率 >70%"） | 无法对照 source——source 不包含 | **不按错误论**，标记"惯例引用，无法规交叉验证" |
| **R3 推导值** | 从法规推导出的操作参数（如"年报预告 1月31日"从"会计年度结束后1个月内"推导） | 检查推导逻辑是否正确 | 若假设合理（如默认12月31日财务年度）→ 标注假设即可；若推导错误 → 修正 |

**具体检查清单**：

| 类型 | 示例 | 对应 source | 验证方法 |
|------|------|------|------|
| 重组认定阈值 | `≥50%`（总资产/营收/净资产） | `重大资产重组管理办法_2023修订要点.md` | 对照 source 第一章 |
| 披露阈值 | `5%、±5%、20%、30%` | `披露阈值表_v1.csv` | 对照 CSV 第 1-6 行 |
| 要约收购时限 | `30-60日` | `披露阈值表_v1.csv` | 对照 CSV 第 7 行 |
| 发行定价比例 | `80%` | `重大资产重组管理办法_2023修订要点.md` | 对照 source 第四章 |
| 锁定期 | `12/36/24个月` | `重大资产重组管理办法_2023修订要点.md` | 对照 source 第四章 |
| 反垄断阈值 | `120亿/40亿/8亿` | `经营者集中申报标准.md` | 对照 source 第一章 |
| 反垄断审查期 | `30+90+60=180自然日` | `经营者集中申报标准.md` | 对照 source 第四章 |
| 合格投资者门槛 | `300万/500万/40万/1000万` | `合格投资者认定标准_v1.md` | 对照 source 第一章 |
| AMAC 备案 | `≥1000万/≥5人/20工作日` | `AMAC私募备案要求.md` | 对照 source 第 1-2 章 |
| 受益所有人阈值 | `≥25%` | `受益所有人识别规则_v1.md` | 对照 source 第二章 |
| 大额交易阈值 | `5万/200万/50万/20万` | `客户尽调_可疑交易报告口径.md` | 对照 source 第三章 |
| 资管新规杠杆 | `140%/200%` | `资管新规_核心条款.md` | 对照 source 第六章 |
| 综合所得税率 | `3%/10%/20%/25%/30%/35%/45%` | `个税口径_v1.md` | 对照 source 第二章 |
| 专项附加扣除 | `2000/400/3000/1000/1500元` | `个税口径_v1.md` | 对照 source 第二章 |
| 估值层级折扣 | `15-35%`（DLOM） | `估值层级判定_v1.md` / `AMAC基金估值指引.md` | 对照 source 第四章 |
| 估值分层占比 | `L1:92-95%/L2:5-8%` | `估值层级判定_v1.md` | 对照 source 第五章 |
| 份额登记时效 | `T日/T+1日/T+2日` | `份额登记确认规则.md` | 对照 source 第 2-3 章 |
| 冷静期 | `24小时` | `理财销售管理规则.md` / `份额登记确认规则.md` | 对照 source 各相关章节 |

**执行方式**：
1. 对 R1 级数值：逐条取出 SKILL.md 中的硬编码数值 → 打开对应 source → 逐行比对
2. 对 R2 级数值：仅标记，不比对（无 source 可比）
3. 对 R3 级数值：检查推导前提是否标注

**产出**：R1 级数值验证表（数值 → source → 是否一致 → 不一致则修正动作）。

---

### Step 5：⬜ 待执行 — git diff 确认 + git add

**5a：确认改动范围**
```bash
git diff --stat        # 确认 modified 文件均为有意修改
git diff               # 逐处审查 diff 内容，排除残留调试/临时
```

**5b：纳入版本管理**
```bash
git add plugins/crabfin-cn/
```

**5c：验证**
```bash
git status             # 确认 70+ 文件 staged，无遗漏 untracked
```

---

### Step 6：⬜ 待执行 — 阶段性 + 最终校验

**校验分布**（不在最后一步集中校验）：

| 校验点 | 时机 | 命令 | 通过标准 |
|------|------|------|------|
| CV-1 | Step 3 完成后 | `bun run validate` | 0 ERROR |
| CV-2 | Step 4 完成后 | `bun run validate` | 0 ERROR |
| CV-3 | Step 5c 完毕后 | `bun run validate` + `git status` | 0 ERROR + staged 完整 |

**若 CV-1 或 CV-2 失败**：检查是 Step 3/4 中修改引入的新错误还是已有错误，按审计报告的错误处置规则修正后重新校验。

---

### Step 7：⬜ 待执行 — PRACTICE.md 技能描述 ↔ SKILL.md 内容对齐抽查

**范围**：6 个 PRACTICE.md 中的技能描述表（共 42 行）。

**检查方法**：对每行描述，对照对应 SKILL.md 的 frontmatter description + 核心内容：

| 检查项 | 不通过示例 |
|------|------|
| 技能名称一致 | PRACTICE.md 写 "buyer-list" vs SKILL.md frontmatter name 为 "buyer-list" |
| 作用描述准确 | PRACTICE.md 写"潜在买方名单 | 经营者集中申报标准 / 外资准入负面清单"，但 buyer-list 实际还引用了 `披露阈值表`——遗漏描述 |
| 中国素材列完整 | PRACTICE.md 列出的素材是否 ≤ 技能实际引用的素材？（少列可接受，多列是夸大） |

**抽样策略**：每模块抽 2 个技能（共 12 个）做深度对齐检查，不在全量 42 个上铺开。

**产出**：抽查结论表。

---

### Step 8：⬜ 待执行 — skill-creator 深度优化全部 42 个技能

> 依据用户初始指令："尤其是技能要使用 skiil-creator 进行深度优化"

**现状诊断**：Step 1-7 解决的是"纠错级"问题（数据准确性、引用匹配、对齐一致性）。但未触及**AI 技能原生质量问题**——即技能的 prompt 结构是否符合 skill-creator 最佳实践标准。前者确保"不出错"，后者确保"效果好"。

**深度优化维度**（skill-creator 关注的非纠错性问题）：

| # | 维度 | 当前可能存在的问题 | skill-creator 优化方向 |
|:---:|------|------|------|
| A | **指令清晰度** | 技能的"做什么"与"怎么做"边界模糊，LLM 执行时可能跳步或遗漏 | 明确工作流步骤 + 每步输入/输出 + 停止条件 |
| B | **trigger 精准度** | frontmatter description 中的触发词覆盖不足或过于宽泛，导致误触发或漏触发 | 正例/反例触发场景 + 歧义消解规则 |
| C | **输出格式约束** | 输出模板中存在 `[XX]` 占位符过多、数据源引用模糊 | 格式模板加注"必须填充"与"可选填充"标记 |
| D | **中国口径嵌入深度** | source 引用停留在"列在文件头"层面，未嵌入到具体操作步骤中 | 将 source 中的具体规则作为"约束条件"而非"背景材料"嵌入 |
| E | **边界条件与 fallback** | 技能缺少"当数据不可得时如何处理"的兜底逻辑 | 添加 fallback 路径 + "信息不足时的最小输出" |
| F | **与 fin-core 的协作契约** | 部分技能声明"依赖 fin-core 底座"但未明确调用哪个技能/怎么传参 | 显式声明"调用 fin-core/X 技能 → 取回 Y 数据 → 本技能填充到 Z 位置" |
| G | **安全/合规语言** | 风险揭示语缺少或措辞不足以满足中国监管要求 | 补强免责声明 + 禁止性措辞（"不构成投资建议"等） |

**执行方式**：使用 `/skill-creator` agent，逐模块、逐技能深度优化。

**执行策略**（控制范围，避免一次性 42 技能导致上下文爆炸）：

| 轮次 | 模块 | 技能数 | 方式 |
|:---:|------|:---:|------|
| 8a | cn-equity-research | 9 | 逐技能调用 skill-creator，每完成 3 个做一次 `bun run validate` |
| 8b | cn-investment-banking | 9 | 同上 |
| 8c | cn-private-equity | 10 | 同上 |
| 8d | cn-wealth | 6 | 同上，每完成 3 个校验一次 |
| 8e | cn-fund-admin | 6 | 同上 |
| 8f | cn-kyc-ops | 2 | 一次完成 |

**每轮执行步骤**：
```
1. 读取当前 SKILL.md
2. 调用 /skill-creator 优化（输入：当前 SKILL.md + module 所有 source 文件路径 + 上述 7 个优化维度）
3. skill-creator 输出优化后的 SKILL.md → 落盘覆盖原文件
4. 验证：bun run validate（每 3 个技能一次，不逐个校验以节约时间）
5. 继续下一个技能
```

**优化优先级**（高风险技能优先）：
1. 涉及法规阈值输出的技能（如 merger-model、deal-tracker）—— 维度 D/G 高优先级
2. 前端客户可见产出的技能（如 client-report、investment-proposal、morning-note）—— 维度 C/G 高优先级
3. 核心工作流技能（如 financial-plan、dd-checklist、earnings-analysis）—— 维度 A/F 高优先级

**skill-creator 输入模板**（每个技能调用时使用）：
```
请深度优化以下 SKILL.md，关注：
1. 将 source 材料中的中国口径嵌入到操作步骤中（而非仅列在文件头）
2. 为每个操作步骤明确输入/输出/停止条件
3. 补齐"数据不可得时的 fallback"路径
4. 显式声明与 fin-core 的协作接口（调用哪个技能、取回什么数据）
5. 补强风险揭示与合规免责措辞
6. 优化 trigger description，减少误触发/漏触发

该模块的 source 材料位于：
plugins/crabfin-cn/<模块>/sources/
```

**skill-creator 产出约束**：
- 保持现有 frontmatter 不变（name/description/license）
- 保持现有 source 引用路径不变
- 不在技能中引入未存在的 source 引用
- 输出格式须为完整 Markdown，可直接覆盖原文件

**每轮校验**：
```bash
bun run validate  # 确认 0 ERROR
```

**关联方影响**：全部 42 个 SKILL.md 被改写，如校验通过则功能不受影响（优化是结构增强，非功能变更）。

---

## 关联方影响总览

| Step | 改动文件 | 受影响技能 | 影响类型 |
|:---:|------|------|------|
| 1 | `sector-overview/SKILL.md:93,97` | sector-overview + 4 下游 | **修复**：错误代码污染下游，修复后正常 |
| 2 | `accrual-schedule/SKILL.md:9` | accrual-schedule | **修复**：移除无效引用 |
| 2 | `unit-economics/SKILL.md:134` | unit-economics | **修复**：移除无效引用 |
| 3 | 可能 0-N 个 | TBD | **预防性修复**：声明错位/遗漏/跨技能不一致 |
| 4 | 可能 0-N 个 | TBD | **预防性修复**：R1 级数值错误修正 |
| 5 | 70+ 文件 git add | 全部 | 纳入版本管理 |
| 7 | 可能修改 PRACTICE.md | TBD | **描述补全** |
| 8 | 全部 42 个 SKILL.md | 全部 | **深度优化**：指令结构/trigger/fallback/fin-core 协作/合规语言 |
