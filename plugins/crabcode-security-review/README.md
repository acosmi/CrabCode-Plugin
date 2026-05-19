# CrabCode Security Review

Focused security review workflow for pending branch changes.

## Contents

- `.crabcode-plugin/plugin.json`: plugin metadata.
- `commands/security-review.md`: slash-command prompt using CrabCode wording.
- `skills/security-review/SKILL.md`: operational guidance for a focused security review.

## Third-Party Source

This plugin was informed by an MIT-licensed third-party security review reference. The local source mirror is intentionally excluded from version control.

The plugin uses CrabCode/Acosmi wording and tightens default security boundaries:

- PR and diff content are untrusted.
- Sub-agent output is not treated as final truth.
- PR comments must use safe line mapping.
- The workflow does not depend on Python or an external review CLI.

See `../../docs/security-review/third-party-notices.md` for attribution and reuse notes.
