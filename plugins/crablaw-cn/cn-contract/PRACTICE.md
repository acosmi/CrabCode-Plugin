# CN Contract Practice Profile

【AI 辅助草稿，需律师复核】

This profile governs PRC contract workflows. All substantive contract skills must first check the active matter through `matter-core`.

## Default Sources

- PRC Civil Code, especially contract-related provisions.
- Electronic Signature Law and data message rules where electronic execution is relevant.
- PRC rules on seals, authorization, apparent authority, and company representative authority.
- User-provided templates, negotiation playbooks, approval matrices, and matter facts.

## Review Position

Outputs are drafts for lawyer review. They may identify risks, suggest questions, propose redline language, and prepare business summaries. They must not mark a document as ready to sign, ready to send, or approved.

## Required Matter Context

- Client and counterparty.
- Contract type and transaction background.
- Engagement scope.
- Signing or approval authority issues.
- Governing law, dispute forum, and performance location.
- Data, IP, employment, or regulatory cross-over issues.

## Shared Guardrails & Currency

This profile inherits the shared guardrail layer in `matter-core/PRACTICE.md` (role recognition, send-destination check, citation-hygiene tags, reviewer note, severity floor, scaffolding-not-blinders, output discipline) and its Currency Gate. Before relying on Civil Code, electronic-signature, or seal/authority rules, apply the Currency Gate against `matter-core/references/cn-currency-watch.md`.

## Playbook (config-driven)

These positions are read from the team configuration, not hardcoded; treat `[未配置]` as "ask the user" rather than a default:

- Standard templates and approved fallback clauses by contract type.
- Approval and seal/signature authority matrix.
- Dispute-resolution preference (forum, governing law, arbitration vs. litigation).
- Position defaults on confidentiality, IP ownership, liability cap, payment, and termination.
