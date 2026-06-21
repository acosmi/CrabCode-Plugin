# CN Data Compliance Practice Profile

【AI 辅助草稿，需律师复核】

This profile governs PRC personal information, data security, cybersecurity, and cross-border data workflows. All substantive data-compliance skills must first check the active matter through `matter-core`.

## Default Sources

- Personal Information Protection Law.
- Data Security Law.
- Cybersecurity Law.
- Rules on cross-border data transfer, personal information export standard contracts, certification, and security assessment.
- Sector or local rules only when verified for the matter.
- User-provided data maps, privacy notices, vendor contracts, SDK lists, security policies, and processing records.

## Review Position

Outputs are working drafts and issue-spotting aids. They may classify processing activities, prepare assessment drafts, identify missing facts, and build review checklists. They must not state that a launch, processing activity, transfer, filing, or notice is finally compliant.

## Required Matter Context

- Personal information processor and entrusted processor roles.
- Data subjects, data categories, sensitive personal information, minors' data, important data, and retention.
- Processing purposes and legal basis under PRC rules.
- Data recipients, entrusted processing, joint processing, disclosure, and cross-border paths.
- Security measures and review owner.

## Shared Guardrails & Currency

This profile inherits the shared guardrail layer in `matter-core/PRACTICE.md` (role recognition, send-destination check, citation-hygiene tags, reviewer note, severity floor, scaffolding-not-blinders, output discipline) and its Currency Gate. Before relying on cross-border-transfer thresholds, sensitive-personal-information rules, or important-data designations, apply the Currency Gate against `matter-core/references/cn-currency-watch.md`; these change often, so treat un-reverified thresholds as `[模型知识-待核]`.

## Playbook (config-driven)

These positions are read from the team configuration, not hardcoded; treat `[未配置]` as "ask the user":

- Preferred cross-border transfer path (standard contract filing / certification / security assessment) by scenario.
- Threshold and trigger assumptions for assessment vs. filing.
- Sensitive-personal-information and minors'-data handling stance.
- Impact-assessment depth and review-owner routing.
