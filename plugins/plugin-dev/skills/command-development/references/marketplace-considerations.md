# Marketplace Considerations for Commands

Guidelines for creating commands designed for distribution and marketplace success.

## Overview

Commands distributed through marketplaces need additional consideration beyond personal use commands. They must work across environments, handle diverse use cases, and provide excellent user experience for unknown users.

## Design for Distribution

### Universal Compatibility

**Cross-platform considerations:**

```markdown
---
description: Cross-platform command
allowed-tools: Bash(*)
---

# Platform-Aware Command

Detecting platform...

Kernel: !`uname`

Read the platform from the line above: `Darwin` is macOS, `Linux` is Linux, and
`MINGW`/`MSYS`/`CYGWIN` mean Windows under a POSIX shell.

Use that to pick the right conventions for the rest of this command — `\` and
`NUL` on Windows, `/` and `/dev/null` elsewhere — and say which platform you
detected before acting on it.
```

**Avoid platform-specific commands:**

```markdown
<!-- BAD: macOS-specific, and fails silently everywhere else -->
!`pbcopy < file.txt`

<!-- GOOD: probe first, then let the model choose -->
Clipboard tools present: !`command -v pbcopy xclip clip.exe`

Copy the file to the clipboard with whichever tool the probe above found —
`pbcopy` on macOS, `xclip -selection clipboard` on Linux, `clip.exe` under
Windows. If it found none, say the clipboard is unavailable on this platform
rather than pretending the copy happened.
```

### Minimal Dependencies

**Check for required tools:**

```markdown
---
description: Dependency-aware command
allowed-tools: Bash(*)
---

# Check Dependencies

Required tools:
- git
- jq
- node

Checking availability...

Found: !`command -v git jq node`

Compare that against the required list. If any tool is missing, stop and report
which ones, with where to get them:

> ❌ ERROR: Missing required dependencies
>
> INSTALLATION:
> - git: https://git-scm.com/downloads
> - jq: https://stedolan.github.io/jq/download/
> - node: https://nodejs.org/

If all three are present, confirm that and continue with the command.
```

**Document optional dependencies:**

```markdown
<!--
DEPENDENCIES:
  Required:
  - git 2.0+: Version control
  - jq 1.6+: JSON processing

  Optional:
  - gh: GitHub CLI (for PR operations)
  - docker: Container operations (for containerized tests)

  Feature availability depends on installed tools.
-->
```

### Graceful Degradation

**Handle missing features:**

```markdown
---
description: Feature-aware command
---

# Feature Detection

Detecting available features...

Optional tools present: !`command -v gh docker`

Treat the probe above as the feature list. If `gh` is there, use the full
GitHub-integrated path. If it is not, say so plainly —

> ⚠ Limited functionality: GitHub CLI not installed. Install `gh` for full
> features.

— and continue with the reduced path rather than failing. Same for `docker`:
present means container operations are available, absent means skip them and
tell the user why.
```

## User Experience for Unknown Users

### Clear Onboarding

**First-run experience:**

```markdown
---
description: Command with onboarding
allowed-tools: Read, Write
---

# First Run Check

Marker present: !`test -f .crabcode/command-initialized && echo yes || echo no`

If this is the first run, show the welcome below, then create
`.crabcode/command-initialized` so it is not shown again:

> **Welcome to Command Name!**
>
> WHAT THIS COMMAND DOES:
> [Brief explanation of purpose and benefits]
>
> QUICK START:
> 1. Basic usage: /command [arg]
> 2. For help: /command help
> 3. Examples: /command examples
>
> SETUP:
> No additional setup required.

Then continue with the user's actual request. On later runs skip the welcome
entirely and go straight to it.
```

**Progressive feature discovery:**

```markdown
---
description: Command with tips
---

# Command Execution

[Main functionality...]

---

💡 TIP: Did you know?

You can speed up this command with the --fast flag:
  /command --fast [args]

For more tips: /command tips
```

### Comprehensive Error Handling

**Anticipate user mistakes:**

```markdown
---
description: Forgiving command
argument-hint: [option]
---

# User Input Handling

Argument: "$0"

<!-- Typos are the common case, so handle them before rejecting anything -->
If `$0` is an obvious misspelling of `help` (`hlep`, `hepl`, and the like),
say "Did you mean: help?" and show the help text instead of erroring.

If `$0` is neither `valid-option1` nor `valid-option2`, do not just reject it —
name the closest match:

> ❌ Unknown option
>
> Did you mean:
> - valid-option1 (most similar)
> - valid-option2
>
> For all options: /command help

Otherwise carry out the requested option.
```

**Helpful diagnostics:**

```markdown
---
description: Diagnostic command
---

# Operation Failed

The operation could not complete.

**Diagnostic Information:**

Environment:
- Platform: $(uname)
- Shell: $SHELL
- Working directory: $(pwd)
- Command: /command $@

Checking common issues:
- Git repository: $(git rev-parse --git-dir 2>&1)
- Write permissions: $(test -w . && echo "OK" || echo "DENIED")
- Required files: $(test -f config.yml && echo "Found" || echo "Missing")

This information helps debug the issue.

For support, include the above diagnostics.
```

## Distribution Best Practices

### Namespace Awareness

**Avoid name collisions:**

```markdown
---
description: Namespaced command
---

<!--
COMMAND NAME: plugin-name-command

This command is namespaced with the plugin name to avoid
conflicts with commands from other plugins.

Alternative naming approaches:
- Use plugin prefix: /plugin-command
- Use category: /category-command
- Use verb-noun: /verb-noun

Chosen approach: plugin-name prefix
Reasoning: Clearest ownership, least likely to conflict
-->

# Plugin Name Command

[Implementation...]
```

**Document naming rationale:**

```markdown
<!--
NAMING DECISION:

Command name: /deploy-app

Alternatives considered:
- /deploy: Too generic, likely conflicts
- /app-deploy: Less intuitive ordering
- /my-plugin-deploy: Too verbose

Final choice balances:
- Discoverability (clear purpose)
- Brevity (easy to type)
- Uniqueness (unlikely conflicts)
-->
```

### Configurability

**User preferences:**

```markdown
---
description: Configurable command
allowed-tools: Read
---

# Load User Configuration

Default configuration:
- verbose: false
- color: true
- max_results: 10

Checking for user config: .crabcode/plugin-name.local.md

<!-- Read only the frontmatter block. A bare grep for "^verbose:" would also
     match a line in the body, which is how a settings file ends up appearing
     to hold two different values for the same key. -->
User settings: !`awk 'NR==1 && /^---$/ {c=1; next} c==1 && /^---$/ {exit} c==1' .crabcode/plugin-name.local.md 2>/dev/null`

If the block above is empty there is no user config — use the defaults and
mention that `.crabcode/plugin-name.local.md` can be created to customise them.
Otherwise take `verbose`, `color` and `max_results` from it, falling back to the
defaults for any key it does not set.
```

**Sensible defaults:**

```markdown
---
description: Command with smart defaults
---

# Smart Defaults

Configuration:
- Format: ${FORMAT:-json}  # Defaults to json
- Output: ${OUTPUT:-stdout}  # Defaults to stdout
- Verbose: ${VERBOSE:-false}  # Defaults to false

These defaults work for 80% of use cases.

Override with arguments:
  /command --format yaml --output file.txt --verbose

Or set in .crabcode/plugin-name.local.md:
\`\`\`yaml
---
format: yaml
output: custom.txt
verbose: true
---
\`\`\`
```

### Version Compatibility

**Version checking:**

```markdown
---
description: Version-aware command
---

<!--
COMMAND VERSION: 2.1.0

COMPATIBILITY:
- Requires plugin version: >= 2.0.0
- Breaking changes from v1.x documented in MIGRATION.md

VERSION HISTORY:
- v2.1.0: Added --new-feature flag
- v2.0.0: BREAKING: Changed argument order
- v1.0.0: Initial release
-->

# Version Check

Command version: 2.1.0
Installed plugin version: !`grep '"version"' .crabcode-plugin/plugin.json`

This command requires plugin version >= 2.0.0. If the installed version is
older, stop and report:

> ❌ ERROR: Incompatible plugin version
>
> This command requires plugin version >= 2.0.0. Quote the version actually
> installed.
>
> Update the plugin:
>   /plugin marketplace update <marketplace>   # refresh the catalog
>   /plugin manage                             # then update from the UI

Otherwise confirm the version is compatible and continue.
```

**Deprecation warnings:**

```markdown
---
description: Command with deprecation warnings
---

# Deprecation Check

If the arguments include `--old-flag`, warn before proceeding — then still do
the work, because a deprecation is not an error:

> ⚠️  DEPRECATION WARNING
>
> `--old-flag` is deprecated as of v2.0.0 and will be removed in v3.0.0.
>
> Use instead: `--new-flag`
>
>   Old: /command --old-flag value
>   New: /command --new-flag value
>
> Migration guide: /command migrate

Accept both spellings for the whole deprecation period.
```

## Marketplace Presentation

### Command Discovery

**Descriptive naming:**

```markdown
---
description: Review pull request with security and quality checks
---

<!-- GOOD: Descriptive name and description -->
```

```markdown
---
description: Do the thing
---

<!-- BAD: Vague description -->
```

**Searchable keywords:**

```markdown
<!--
KEYWORDS: security, code-review, quality, validation, audit

These keywords help users discover this command when searching
for related functionality in the marketplace.
-->
```

### Showcase Examples

**Compelling demonstrations:**

```markdown
---
description: Advanced code analysis command
---

# Code Analysis Command

This command performs deep code analysis with actionable insights.

## Demo: Quick Security Audit

Try it now:
\`\`\`
/analyze-code src/ --security
\`\`\`

**What you'll get:**
- Security vulnerability detection
- Code quality metrics
- Performance bottleneck identification
- Actionable recommendations

**Sample output:**
\`\`\`
Security Analysis Results
=========================

🔴 Critical (2):
  - SQL injection risk in users.js:45
  - XSS vulnerability in display.js:23

🟡 Warnings (5):
  - Unvalidated input in api.js:67
  ...

Recommendations:
1. Fix critical issues immediately
2. Review warnings before next release
3. Run /analyze-code --fix for auto-fixes
\`\`\`

---

Ready to analyze your code...

[Command implementation...]
```

### Feedback Channels

There is no in-product rating widget and no `/command feedback` — do not print
one, or users will reply into a channel that does not exist.

Point people at something real instead, in your README rather than in every
command's output:

- The issue tracker for the repository the plugin ships from
- A contact address you actually monitor

Likewise, do not design around usage telemetry. Commands do not report
analytics, so "track failure rates" is not something a plugin can do; if you
need to know how a command behaves, log locally and ask the user to share.

## Quality Standards

### Professional Polish

**Consistent branding:**

```markdown
---
description: Branded command
---

# ✨ Command Name

Part of the [Plugin Name] suite

[Command functionality...]

---

**Need Help?**
- Documentation: https://docs.example.com
- Support: support@example.com
- Community: https://community.example.com

Powered by Plugin Name v2.1.0
```

**Attention to detail:**

```markdown
<!-- Details that matter -->

✓ Use proper emoji/symbols consistently
✓ Align output columns neatly
✓ Format numbers with thousands separators
✓ Use color/formatting appropriately
✓ Provide progress indicators
✓ Show estimated time remaining
✓ Confirm successful operations
```

### Reliability

**Idempotency:**

```markdown
---
description: Idempotent command
---

# Safe Repeated Execution

Checking if operation already completed...

Completion marker: !`cat .crabcode/operation-completed.flag 2>/dev/null`

If the marker above has a timestamp, the work is already done. Report it and
stop — repeating it is exactly what idempotency is meant to prevent:

> ℹ️  Operation already completed at <timestamp>
>
> To re-run: delete `.crabcode/operation-completed.flag`, then invoke the
> command again.

If the marker is empty, perform the operation, then write the current timestamp
to `.crabcode/operation-completed.flag`.
```

**Atomic operations:**

```markdown
---
description: Atomic command
---

# Atomic Operation

This operation is atomic — it either fully succeeds or leaves nothing behind.

Work in a temporary directory created with `mktemp -d`, make and validate every
change there, and only move the result into `./target/` once validation passes.

If validation fails, delete the temporary directory and report that no changes
were applied, so the user knows a retry is safe:

> ❌ Changes failed validation. Rolled back; no changes applied.

Never move a partial result into place — a half-applied change is the state
this pattern exists to avoid.
```

## Testing for Distribution

### Pre-Release Checklist

```markdown
<!--
PRE-RELEASE CHECKLIST:

Functionality:
- [ ] Works on macOS
- [ ] Works on Linux
- [ ] Works on Windows (WSL)
- [ ] All arguments tested
- [ ] Error cases handled
- [ ] Edge cases covered

User Experience:
- [ ] Clear description
- [ ] Helpful error messages
- [ ] Examples provided
- [ ] First-run experience good
- [ ] Documentation complete

Distribution:
- [ ] No hardcoded paths
- [ ] Dependencies documented
- [ ] Configuration options clear
- [ ] Version number set
- [ ] Changelog updated

Quality:
- [ ] No TODO comments
- [ ] No debug code
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Privacy considered

Support:
- [ ] README complete
- [ ] Troubleshooting guide
- [ ] Support contact provided
- [ ] Feedback mechanism
- [ ] License specified
-->
```

### Signalling Pre-Release Status

Beta enrolment commands (`/command join-beta` and friends) do not exist. To
mark a plugin as pre-release, use the things that are real:

- A `0.x` version in `plugin.json`, which is the conventional signal
- A short "Status: preview" line at the top of the README, listing what is
  incomplete
- Honest `description` text on the affected commands

Keep the disclaimer in the README, not in every command's output — a banner
reprinted on each invocation costs the user attention every time while telling
them something they already know.

## Maintenance and Updates

### Update Strategy

**Versioned commands:**

```markdown
<!--
VERSION STRATEGY:

Major (X.0.0): Breaking changes
- Document all breaking changes
- Provide migration guide
- Support old version briefly

Minor (x.Y.0): New features
- Backward compatible
- Announce new features
- Update examples

Patch (x.y.Z): Bug fixes
- No user-facing changes
- Update changelog
- Security fixes prioritized

Release schedule:
- Patches: As needed
- Minors: Monthly
- Majors: Annually or as needed
-->
```

**Update notifications:**

```markdown
---
description: Update-aware command
---

# Check for Updates

Current version: 2.1.0
Latest version: [look up the catalog entry]

If the latest version differs from the current one, mention it once and then
get on with the user's request — an update notice should not block the command:

> 📢 UPDATE AVAILABLE — quote both versions.
>
> What's new: feature improvements, bug fixes, performance enhancements.
>
> Update with:
>   /plugin marketplace update <marketplace>   # refresh the catalog
>   /plugin manage                             # then update from the UI

Then continue with the command as normal.
```

## Best Practices Summary

### Distribution Design

1. **Universal**: Works across platforms and environments
2. **Self-contained**: Minimal dependencies, clear requirements
3. **Graceful**: Degrades gracefully when features unavailable
4. **Forgiving**: Anticipates and handles user mistakes
5. **Helpful**: Clear errors, good defaults, excellent docs

### Marketplace Success

1. **Discoverable**: Clear name, good description, searchable keywords
2. **Professional**: Polished presentation, consistent branding
3. **Reliable**: Tested thoroughly, handles edge cases
4. **Maintainable**: Versioned, updated regularly, supported
5. **User-focused**: Great UX, responsive to feedback

### Quality Standards

1. **Complete**: Fully documented, all features working
2. **Tested**: Works in real environments, edge cases handled
3. **Secure**: No vulnerabilities, safe operations
4. **Performant**: Reasonable speed, resource-efficient
5. **Ethical**: Privacy-respecting, user consent

With these considerations, commands become marketplace-ready and delight users across diverse environments and use cases.
