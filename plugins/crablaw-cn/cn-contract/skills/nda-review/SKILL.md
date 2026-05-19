---
name: nda-review
description: Review a confidentiality agreement or NDA under PRC-law contract and trade-secret workflow controls.
argument-hint: "[NDA file path, pasted text, or matter facts]"
---

# /cn-contract:nda-review

【AI 辅助草稿，需律师复核】

Review an NDA or confidentiality agreement. This is a draft workpaper for lawyer review.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate). Additionally confirm the engagement scope explicitly includes NDA or confidentiality review. Stop with the matching matter-core stop code if any check fails.

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
