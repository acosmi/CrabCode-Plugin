---
name: 保密协议审查
short-description: 在中国法合同与商业秘密工作流中审查保密协议/NDA,产出律师复核工作底稿
description: 在中国法合同与商业秘密工作流中审查保密协议/NDA,产出律师复核工作底稿。当用户提到保密协议/NDA/竞业保密/保密条款/这份保密合同看看,或需要对收发保密协议做法律把关时使用本技能(即使未明说"NDA 审查")。
argument-hint: "[NDA file path, pasted text, or matter facts]"
---

# /cn-contract:nda-review

【AI 辅助草稿，需律师复核】

Review an NDA or confidentiality agreement. This is a draft workpaper for lawyer review.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Additionally confirm the engagement scope explicitly includes NDA or confidentiality review. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Identify disclosing party, receiving party, affiliates, representatives, and permitted recipients.
2. Extract confidential information definition, exclusions, permitted use, protection standard, term, return/destruction, compelled disclosure, injunctive relief, liability, governing law, and dispute forum.
3. Check PRC issues:
   - enforceability and clarity of confidentiality obligations.
   - trade secret protection requirements and evidence preservation needs.
   - employee/representative handling obligations.
   - data and personal information overlap.
   - seal, signature, and authority defects.
4. Flag missing facts and source gaps.
5. Create a review queue item.

## Output

Return a red/yellow/green issue table, drafting suggestions, missing facts, source records, and lawyer review points.

## 产出物路由

- 需要将NDA 审查备忘录交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
