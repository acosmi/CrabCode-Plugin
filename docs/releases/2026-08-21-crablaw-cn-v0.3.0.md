# CrabLaw-CN v0.3.0

## Outcome

CrabLaw-CN now has a single legal control plane and a traceable flagship matter-deep-analysis
workflow while preserving every existing public skill basename.

## Highlights

- Added `crablaw-cn:legal-workbench` as the only new public skill.
- Upgraded `crablaw-cn:matter-deep-analysis` to separate matter-document and legal-research lanes,
  join them by issue ID, route specialist work, red-team findings, and validate before writing.
- Replaced active CrabLaw pseudo-namespaces with canonical `crablaw-cn:<skill>` references.
- Added a machine-validated registry covering 12 display groups, 87 skills, 10 substantive matter
  types, five internal modes, and five declared agents.
- Added nine run-artifact schemas plus additive source/review fields.
- Added dependency-free Python 3.9+ tools for private Matter bootstrap, JSON validation, run
  validation, input hashing, and stale propagation.
- Added path-containment, symlink, overwrite, private-permission, atomic-write, and single-writer
  safeguards.
- Added synthetic trigger/task/security evals and an external-source overlap preflight.

## Compatibility

- All previous 86 skill basenames remain available.
- Existing downstream `crablaw-cn:*` references remain valid.
- Existing Matter records remain readable; no user Matter Store is migrated automatically.
- `sourcePlugin` and `sourceSkill` remain; new review items may additionally provide
  `sourceCapability`, `runId`, and `issueIds`.
- The office suite and generic deep-research provider remain optional, not hard dependencies.

## Safety and review

- Engineering validation is separate from legal professional review.
- No final legal opinion or external release is approved by the workflow.
- Prediction/value-judgment capabilities remain outside the default product surface.
- New implementation text passed the 96-character normalized source-overlap preflight against the
  reviewed upstream snapshot with zero match pairs. This is an engineering check, not a license
  opinion.

## Runtime

The deterministic tools use Python 3.9+ and no third-party packages. If Python is unavailable, the
skill may explain the required artifacts, but a deep-analysis run cannot claim deterministic
ready-for-review validation.

## Validation

- Targeted CrabLaw runtime, registry, reference, Matter Gate, eval, and overlap tests pass.
- An isolated repository snapshot containing only this change passes `bun run validate`.
- Skill-creator comparison: current skills passed 36/36 assertions; the committed-state/no-control
  baseline passed 31/36. Gains are concentrated in canonical routing and the new deep-analysis
  contracts.
- The comparison uses one synthetic run per configuration. Timing was unavailable and the benchmark
  `tokens` field is an output-character proxy; it must not be presented as a latency/token-cost claim.
- Full-suite status and remaining human-review limits are recorded in the implementation log.
