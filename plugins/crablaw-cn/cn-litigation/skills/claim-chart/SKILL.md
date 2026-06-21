---
name: claim-chart
description: 构建中国民商事诉讼/仲裁的争点与诉讼请求对照表(主张-法律依据-证据三栏),专利案可附技术特征与权利要求比对表。当用户提到争点对照/诉讼请求梳理/主张与证据对应/争点整理时使用本技能(即使未明说"对照表")。
argument-hint: "[案件事实、双方主张、已有证据清单，或文件路径/粘贴文本]"
---

# /cn-litigation:claim-chart

【AI 辅助草稿，需律师复核】

构建中国民商事诉讼或仲裁的争点对照表（claim chart）：将原告/申请人与被告/被申请人的主张、对应法律依据（民法典及相关司法解释、合同条款）、支撑证据三栏对照排列，理清争点焦点与举证责任分配。专利侵权诉讼可另附"技术特征—权利要求"比对表。本对照表为内部分析底稿，不得标注为可向人民法院或仲裁机构提交的最终版本，也不得作为可对外发送的声明。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：本案已在 `litigation-matter` 中登记（含 forumType / partyRole / instance），对照表的产出目的与承办范围一致，且输出仅进入内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 读取 `litigation-matter` 案件登记，确认审理机关（人民法院/仲裁委员会）、案由、我方诉讼地位（原告/被告/第三人/申请人/被申请人）与诉讼阶段。
2. 拆解争点：从诉讼请求与答辩意见中提炼每一项独立争点（如合同效力、违约成立与否、损失金额、责任比例）。
3. 对每一争点建立三栏对照：
   - 主张栏——双方各自的事实主张与诉讼请求/答辩意见。
   - 法律依据栏——对应的民法典条文、相关司法解释、合同约定条款。
   - 证据栏——支撑该主张的证据及其证明对象，标注举证责任归属。
4. 标注证据状态：已提交/待补强/缺失；区分书证、物证、证人证言、当事人陈述、鉴定意见、电子数据等证据种类。
5. 专利侵权诉讼（如适用）：另附技术特征比对表，逐一对照涉案产品/方法的技术特征与权利要求的技术特征，标注全面覆盖/等同/缺失。
6. 引用的法律依据按 citationTag 标注（`[已核验-来源]` / `[用户提供]` / `[模型知识-待核]`）。凡 `[模型知识-待核]` 法律点，须在 `sources.jsonl` 配一条 `source-record`，`status: source-needs-check`，`effectiveStatus` 写明待核验内容。
7. 创建 review queue 条目，状态 `pending-review`。

## Output

- 顶部 Reviewer note 固定块：所用来源 / 实际审读范围 / 留待律师判断事项 / 时效（last-verified）/ 依赖前须完成事项。
- 争点清单与焦点排序。
- 三栏争点对照表（主张 / 法律依据 / 证据）。
- 举证责任分配与证据缺口表。
- 技术特征—权利要求比对表（仅专利侵权案）。
- 来源表（citationTag + source-record 指针）。
- 律师复核要点。

## Next Steps

- 需就某争点形成文书分段（事实与理由 / 诉讼请求）：移交 `/cn-litigation:brief-section-drafter`。
- 需准备庭审发问与质证：移交 `/cn-litigation:deposition-prep`。
- 涉及不公开材料（国家秘密/商业秘密/个人隐私）的证据分级：移交 `/cn-litigation:privilege-log-review`。
- 证据缺口需向法院申请调查取证：移交 `/cn-litigation:subpoena-triage`。
- 跨域问题（合同效力、数据合规、劳动争议）升级至对应板块技能。
