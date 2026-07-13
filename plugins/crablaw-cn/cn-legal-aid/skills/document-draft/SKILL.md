---
name: 法律援助文书起草
short-description: 起草法律援助案件的法律文书内部草稿,如起诉状、答辩状、代理/辩护意见、申请书等
description: 起草法律援助案件的法律文书内部草稿,如起诉状、答辩状、代理/辩护意见、申请书等。当用户提到写起诉状/答辩状/申请书、起草援助文书、代理词、辩护词、出文书初稿,需要为援助案件草拟法律文书时使用本技能(即使未明说"文书")。
argument-hint: "[受援人 matter id、文书类型与要点/已确认的事实证据]"
---

# /cn-legal-aid:document-draft

【AI 辅助草稿，需律师复核】

法律援助案件法律文书内部草稿，按中国诉讼/仲裁/行政程序文书规范起草。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构/行政机关提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 起草前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；文书类型落在援助事项范围内；产出目的地为内部审核队列（review queue），不得直接对外提交。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 文书类型确认：明确文书种类（民事起诉状/答辩状、上诉状、再审申请书、代理意见、刑事辩护词、行政起诉状、各类申请书等）及适用程序。
2. 当事人与基本要素：填入当事人/诉讼地位、受诉机关、案号（如有）等首部要素，核对主体适格与送达信息。
3. 正文结构：按对应文书规范组织事实与理由、请求/辩护意见、法律依据；事实部分区分有证据支持与待证事实。
4. 法律依据引用：引用民法典/民事诉讼法/刑事诉讼法/行政诉讼法等具体条文，逐处标注三值；不臆造法条编号或司法解释条号。
5. 证据对应：将主张与证据清单对应，标记尚需补强的证据。
6. 期限与提交节点：核查文书对应的提交期限（起诉、上诉、举证等），与 `compliance-deadline` 对应并提示。
7. 红线与边界：文书首/尾保留"内部草稿、待律师复核与受援人确认"提示，不预填受援人/律师签名与盖章为已签状态。
8. 来源标注：无核验来源的法律点配 `source-record`（status: source-needs-check）。
9. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 文书草稿（reviewer note 置顶；明确标注"内部草稿，律师复核与受援人确认前不得提交/对外"）。
- 首部要素（当事人/受诉机关/案号）。
- 事实与理由。
- 请求/辩护意见。
- 法律依据（逐处三值标注）。
- 证据对应与缺口。
- 提交期限提示。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 法律依据不足：移交 `/cn-legal-aid:research-start` 检索。
- 分析基础需补强：回到 `/cn-legal-aid:case-memo`。
- 提交期限管理：移交 `/cn-legal-aid:deadlines`。
- 提交前必经督导复核：移交 `/cn-legal-aid:supervisor-review-queue`。

## 产出物路由

- 需要将法律文书交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
