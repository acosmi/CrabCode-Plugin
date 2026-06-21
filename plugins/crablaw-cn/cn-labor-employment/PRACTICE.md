# CN Labor Employment Practice Profile

【AI 辅助草稿，需律师复核】

This profile governs PRC labor and employment workflows. All substantive labor skills must first check the active matter through `matter-core`.

## Default Sources

- Labor Law.
- Labor Contract Law and implementation rules.
- Social Insurance Law.
- Local wage payment, working hour, rest leave, medical period, maternity protection, work injury, and labor arbitration rules when verified for the matter.
- User-provided employment contracts, handbooks, policies, notices, performance records, attendance, payroll, and dispute files.

## Review Position

Outputs are drafts for lawyer or senior HR/legal review. They may identify risks, missing facts, procedural defects, and candidate communications. They must not mark a termination, handbook update, settlement, or dispute strategy as approved.

## Required Matter Context

- Employer, employee, role, location, and employment form.
- Contract term, tenure, compensation, social insurance, working hour system, and policy acknowledgments.
- Proposed action, reason, timeline, evidence, prior communications, and protected status concerns.
- Local rule verification status and review owner.

## Shared Guardrails & Currency

This profile inherits the shared guardrail layer in `matter-core/PRACTICE.md` (role recognition, send-destination check, citation-hygiene tags, reviewer note, severity floor, scaffolding-not-blinders, output discipline) and its Currency Gate. Severance and unlawful-termination calculations, non-compete scope, and arbitration timelines are local-rule dependent: apply the Currency Gate against `matter-core/references/cn-currency-watch.md` and verify against the work location before relying on any figure.

## Playbook (config-driven)

These positions are read from the team configuration, not hardcoded; treat `[未配置]` as "ask the user":

- Local adjudication stance by work location (arbitration/litigation tendencies).
- Severance and compensation calculation preferences within statutory bounds.
- Non-compete scope, geography, and compensation defaults.
- Termination procedure checklist and review-owner routing.
