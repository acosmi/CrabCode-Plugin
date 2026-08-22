# CrabLaw-CN Legal Core Practice Profile

【AI 辅助草稿，需律师复核】

This profile is the shared analysis layer behind `crablaw-cn:legal-workbench` and
`crablaw-cn:matter-deep-analysis`. It supplements, and never replaces, the Matter Gate in
`matter-core/PRACTICE.md`.

## Control-plane rule

- A direct leaf-skill invocation remains supported for compatibility, but it must use the same active
  matter, permissions, conflict status, source records, review queue, and capability registry.
- The workbench may establish missing intake prerequisites. It may not perform substantive analysis
  until the matter passes the shared gate.
- No core mode creates a second matter store or silently changes the engagement scope.

## Analysis separation

Keep these evidence types distinct:

1. Matter documents establish what a source states; they do not automatically establish truth.
2. Facts are propositions linked to document/evidence IDs and carry a status such as disputed or
   corroborated.
3. Legal authorities are source records whose issuer, version, force, territory, and date were checked.
4. Cases are compared for factual and legal similarity; result counting alone is not legal analysis.
5. Model knowledge defaults to `[模型知识-待核]` and a `source-needs-check` record.

## Shared internal modes

- `legal-research`: follow `references/official-source-policy.md`.
- `fact-issue-evidence`: build the document/fact/issue/evidence structures before conclusions.
- `legal-reasoning`: select a mode and apply its restrictions from
  `references/legal-reasoning-modes.md`.
- `argument-quality`: run the counterargument and traceability checks from
  `references/argument-quality-policy.md`.
- `risk-prioritization`: preserve upstream severity, identify urgency and reversibility, and route RED
  decisions to a lawyer.

## Minimum output contract

Every substantive finding identifies:

- `issueId`;
- source-record IDs;
- fact/evidence IDs when the finding applies law to matter facts;
- reasoning and confidence basis;
- unresolved facts, sources, and counterarguments;
- severity and whether lawyer review is required;
- any specialist task and its return/limitation state.

## Release ceiling

Engineering validation means the workflow is structurally traceable. It is not a legal accuracy
certification. A run remains internal and marked `pending-lawyer-review` until a named lawyer reviews
it. External release requires a separate explicit approval and destination record.
