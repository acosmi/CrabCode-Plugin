# Command Documentation Patterns

Strategies for creating self-documenting, maintainable commands with excellent user experience.

## Overview

Well-documented commands are easier to use, maintain, and distribute. Documentation should be embedded in the command itself, making it immediately accessible to users and maintainers.

## Self-Documenting Command Structure

### Complete Command Template

```markdown
---
description: Clear, actionable description under 60 chars
argument-hint: [arg1] [arg2] [optional-arg]
allowed-tools: Read, Bash(git:*)
model: inherit
---

<!--
COMMAND: command-name
VERSION: 1.0.0
AUTHOR: Team Name
LAST UPDATED: 2025-01-15

PURPOSE:
Detailed explanation of what this command does and why it exists.

USAGE:
  /command-name arg1 arg2

ARGUMENTS:
  arg1: Description of first argument (required)
  arg2: Description of second argument (optional, defaults to X)

EXAMPLES:
  /command-name feature-branch main
    → Compares feature-branch with main

  /command-name my-branch
    → Compares my-branch with current branch

REQUIREMENTS:
  - Git repository
  - Branch must exist
  - Permissions to read repository

RELATED COMMANDS:
  /other-command - Related functionality
  /another-command - Alternative approach

TROUBLESHOOTING:
  - If branch not found: Check branch name spelling
  - If permission denied: Check repository access

CHANGELOG:
  v1.0.0 (2025-01-15): Initial release
  v0.9.0 (2025-01-10): Beta version
-->

# Command Implementation

[Command prompt content here...]

[Explain what will happen...]

[Guide user through steps...]

[Provide clear output...]
```

### Documentation Comment Sections

**PURPOSE**: Why the command exists
- Problem it solves
- Use cases
- When to use vs when not to use

**USAGE**: Basic syntax
- Command invocation pattern
- Required vs optional arguments
- Default values

**ARGUMENTS**: Detailed argument documentation
- Each argument described
- Type information
- Valid values/ranges
- Defaults

**EXAMPLES**: Concrete usage examples
- Common use cases
- Edge cases
- Expected outputs

**REQUIREMENTS**: Prerequisites
- Dependencies
- Permissions
- Environmental setup

**RELATED COMMANDS**: Connections
- Similar commands
- Complementary commands
- Alternative approaches

**TROUBLESHOOTING**: Common issues
- Known problems
- Solutions
- Workarounds

**CHANGELOG**: Version history
- What changed when
- Breaking changes highlighted
- Migration guidance

## In-Line Documentation Patterns

### Commented Sections

```markdown
---
description: Complex multi-step command
---

<!-- SECTION 1: VALIDATION -->
<!-- This section checks prerequisites before proceeding -->

Checking prerequisites...
- Git repository: !`git rev-parse --git-dir 2>/dev/null`
- Branch exists: [validation logic]

<!-- SECTION 2: ANALYSIS -->
<!-- Analyzes the differences between branches -->

Analyzing differences between $0 and $1...
[Analysis logic...]

<!-- SECTION 3: RECOMMENDATIONS -->
<!-- Provides actionable recommendations -->

Based on analysis, recommend:
[Recommendations...]

<!-- END: Next steps for user -->
```

### Inline Explanations

```markdown
---
description: Deployment command with inline docs
argument-hint: [environment]
---

# Deploy to $0

## Pre-flight Checks

<!-- Branch status is injected before the prompt reaches the model, so the
     model can reason about it rather than having to ask. -->
Current branch: !`git branch --show-current`

<!-- Production deploys are expected to come from main. State the rule and let
     the model apply it — a command body is a prompt, so an `if` here would be
     read as literal text, not evaluated. -->
If the target environment is `production` and the branch above is not `main`,
warn that this is an unusual combination and ask the user to confirm before
continuing.

Running tests: !`npm test`

If the tests above failed, stop and report the failure instead of deploying.

## Deployment

<!-- Uses blue-green strategy for zero-downtime -->
Deploy to the `$0` environment, then verify deployment health and report the
result.

## Next Steps

<!-- Guide user on what to do after deployment -->
Tell the user how to follow up:

1. Monitor logs: `/logs $0`
2. Run smoke tests: `/smoke-test $0`
3. Notify team: `/notify-deployment $0`
```

### Decision Point Documentation

```markdown
---
description: Interactive deployment command
argument-hint: [target] [new-version]
---

# Interactive Deployment

## Configuration Review

Target: $0
Current version: !`cat version.txt`
New version: $1

<!-- DECISION POINT: User confirms configuration -->
<!-- This pause allows user to verify everything is correct -->
<!-- We can't automatically proceed because deployment is risky -->

Review the above configuration.

**Continue with deployment?**
- Reply "yes" to proceed
- Reply "no" to cancel
- Reply "edit" to modify configuration

[Await user input before continuing...]

<!-- After user confirms, we proceed with deployment -->
<!-- All subsequent steps are automated -->

Proceeding with deployment...
```

## Help Text Patterns

### Built-in Help Command

Create a help subcommand for complex commands:

```markdown
---
description: Main command with help
argument-hint: [subcommand] [args]
---

# Command Processor

The first argument is `$0`. If it is `help`, `--help` or `-h`, print the help
text below verbatim and do nothing else:

> **Command Help**
>
> USAGE:
>   /command [subcommand] [args]
>
> SUBCOMMANDS:
>   init [name]       Initialize new configuration
>   deploy [env]      Deploy to environment
>   status            Show current status
>   rollback          Rollback last deployment
>   help              Show this help
>
> EXAMPLES:
>   /command init my-project
>   /command deploy staging
>   /command status
>   /command rollback
>
> For detailed help on a subcommand:
>   /command [subcommand] --help

Otherwise carry out the requested subcommand.
```

### Contextual Help

Provide help based on context:

```markdown
---
description: Context-aware command
argument-hint: [operation] [target]
---

# Context-Aware Operation

The operation is `$0` and the target is `$1`.

If no operation was given, print the guidance below and stop:

> **No operation specified**
>
> Available operations:
> - analyze: Analyze target for issues
> - fix: Apply automatic fixes
> - report: Generate detailed report
>
> Usage: /command [operation] [target]
>
> Examples:
>   /command analyze src/
>   /command fix src/app.js
>   /command report
>
> Run /command help for more details.

Otherwise carry out the requested operation on the target.
```

## Error Message Documentation

### Helpful Error Messages

```markdown
---
description: Command with good error messages
argument-hint: [file-path]
---

# Validation Command

Validate the file at `$0`.

If no path was given, report this and stop:

> ❌ ERROR: Missing required argument
>
> The 'file-path' argument is required.
>
> USAGE:
>   /validate [file-path]
>
> EXAMPLE:
>   /validate src/app.js

If the path was given but the file does not exist or cannot be read, report
that instead, quoting the path and listing what usually causes it:

> ❌ ERROR: File not found
>
> COMMON CAUSES:
> 1. Typo in the file path
> 2. File was deleted or moved
> 3. Insufficient permissions
>
> SUGGESTIONS:
> - Check the spelling of the path
> - List the containing directory to confirm the file is there
> - Check the file's permissions

Otherwise validate the file and report findings.
```

### Error Recovery Guidance

```markdown
---
description: Command with recovery guidance
---

# Operation Command

Running operation...

!`risky-operation.sh`

The output above is the result of the operation. If it failed, do not continue
— report the failure using this structure, so the user learns what state the
system is in rather than just that something broke:

> ❌ OPERATION FAILED
>
> WHAT HAPPENED:
> risky-operation.sh exited non-zero. Quote the relevant output.
>
> WHAT THIS MEANS:
> - Changes may be partially applied
> - The system may be in an inconsistent state
> - Manual intervention may be needed
>
> RECOVERY STEPS:
> 1. Check operation logs: cat /tmp/operation.log
> 2. Verify system state: /check-state
> 3. If needed, rollback: /rollback-operation
> 4. Fix the underlying issue
> 5. Retry: /retry-operation
>
> NEED HELP?
> - Troubleshooting guide: /help troubleshooting
> - Contact support with error code: ERR_OP_FAILED_001
```

## Usage Example Documentation

### Embedded Examples

```markdown
---
description: Command with embedded examples
---

# Feature Command

This command performs feature analysis with multiple options.

## Basic Usage

\`\`\`
/feature analyze src/
\`\`\`

Analyzes all files in src/ directory for feature usage.

## Advanced Usage

\`\`\`
/feature analyze src/ --detailed
\`\`\`

Provides detailed analysis including:
- Feature breakdown by file
- Usage patterns
- Optimization suggestions

## Use Cases

**Use Case 1: Quick overview**
\`\`\`
/feature analyze .
\`\`\`
Get high-level feature summary of entire project.

**Use Case 2: Specific directory**
\`\`\`
/feature analyze src/components
\`\`\`
Focus analysis on components directory only.

**Use Case 3: Comparison**
\`\`\`
/feature analyze src/ --compare baseline.json
\`\`\`
Compare current features against baseline.

---

Now processing your request...

[Command implementation...]
```

### Example-Driven Documentation

```markdown
---
description: Example-heavy command
---

# Transformation Command

## What This Does

Transforms data from one format to another.

## Examples First

### Example 1: JSON to YAML
**Input:** `data.json`
\`\`\`json
{"name": "test", "value": 42}
\`\`\`

**Command:** `/transform data.json yaml`

**Output:** `data.yaml`
\`\`\`yaml
name: test
value: 42
\`\`\`

### Example 2: CSV to JSON
**Input:** `data.csv`
\`\`\`csv
name,value
test,42
\`\`\`

**Command:** `/transform data.csv json`

**Output:** `data.json`
\`\`\`json
[{"name": "test", "value": "42"}]
\`\`\`

### Example 3: With Options
**Command:** `/transform data.json yaml --pretty --sort-keys`

**Result:** Formatted YAML with sorted keys

---

## Your Transformation

File: $0
Format: $1

[Perform transformation...]
```

## Maintenance Documentation

### Version and Changelog

```markdown
<!--
VERSION: 2.1.0
LAST UPDATED: 2025-01-15
AUTHOR: DevOps Team

CHANGELOG:
  v2.1.0 (2025-01-15):
    - Added support for YAML configuration
    - Improved error messages
    - Fixed bug with special characters in arguments

  v2.0.0 (2025-01-01):
    - BREAKING: Changed argument order
    - BREAKING: Removed deprecated --old-flag
    - Added new validation checks
    - Migration guide: /migration-v2

  v1.5.0 (2024-12-15):
    - Added --verbose flag
    - Improved performance by 50%

  v1.0.0 (2024-12-01):
    - Initial stable release

MIGRATION NOTES:
  From v1.x to v2.0:
    Old: /command arg1 arg2 --old-flag
    New: /command arg2 arg1

  The --old-flag is removed. Use --new-flag instead.

DEPRECATION WARNINGS:
  - The --legacy-mode flag is deprecated as of v2.1.0
  - Will be removed in v3.0.0 (estimated 2025-06-01)
  - Use --modern-mode instead

KNOWN ISSUES:
  - #123: Slow performance with large files (workaround: use --stream flag)
  - #456: Special characters in Windows (fix planned for v2.2.0)
-->
```

### Maintenance Notes

```markdown
<!--
MAINTENANCE NOTES:

CODE STRUCTURE:
  - Lines 1-50: Argument parsing and validation
  - Lines 51-100: Main processing logic
  - Lines 101-150: Output formatting
  - Lines 151-200: Error handling

DEPENDENCIES:
  - Requires git 2.x or later
  - Uses jq for JSON processing
  - Needs bash 4.0+ for associative arrays

PERFORMANCE:
  - Fast path for small inputs (< 1MB)
  - Streams large files to avoid memory issues
  - Caches results in /tmp for 1 hour

SECURITY CONSIDERATIONS:
  - Validates all inputs to prevent injection
  - Uses allowed-tools to limit Bash access
  - No credentials in command file

TESTING:
  - Unit tests: tests/command-test.sh
  - Integration tests: tests/integration/
  - Manual test checklist: tests/manual-checklist.md

FUTURE IMPROVEMENTS:
  - TODO: Add support for TOML format
  - TODO: Implement parallel processing
  - TODO: Add progress bar for large files

RELATED FILES:
  - lib/parser.sh: Shared parsing logic
  - lib/formatter.sh: Output formatting
  - config/defaults.yml: Default configuration
-->
```

## README Documentation

Commands should have companion README files:

```markdown
# Command Name

Brief description of what the command does.

## Installation

This command is part of the [plugin-name] plugin.

Install with:
\`\`\`
/plugin install plugin-name@crabcode-plugins-official
\`\`\`

## Usage

Basic usage:
\`\`\`
/command-name [arg1] [arg2]
\`\`\`

## Arguments

- `arg1`: Description (required)
- `arg2`: Description (optional, defaults to X)

## Examples

### Example 1: Basic Usage
\`\`\`
/command-name value1 value2
\`\`\`

Description of what happens.

### Example 2: Advanced Usage
\`\`\`
/command-name value1 --option
\`\`\`

Description of advanced feature.

## Configuration

Optional configuration file: `.crabcode/command-name.local.md`

\`\`\`markdown
---
default_arg: value
enable_feature: true
---
\`\`\`

## Requirements

- Git 2.x or later
- jq (for JSON processing)
- Node.js 14+ (optional, for advanced features)

## Troubleshooting

### Issue: Command not found

**Solution:** Ensure plugin is installed and enabled.

### Issue: Permission denied

**Solution:** Check file permissions and allowed-tools setting.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License - See [LICENSE](LICENSE).

## Support

- Issues: https://github.com/user/plugin/issues
- Docs: https://docs.example.com
- Email: support@example.com
```

## Best Practices

### Documentation Principles

1. **Write for your future self**: Assume you'll forget details
2. **Examples before explanations**: Show, then tell
3. **Progressive disclosure**: Basic info first, details available
4. **Keep it current**: Update docs when code changes
5. **Test your docs**: Verify examples actually work

### Documentation Locations

1. **In command file**: Core usage, examples, inline explanations
2. **README**: Installation, configuration, troubleshooting
3. **Separate docs**: Detailed guides, tutorials, API reference
4. **Comments**: Implementation details for maintainers

### Documentation Style

1. **Clear and concise**: No unnecessary words
2. **Active voice**: "Run the command" not "The command can be run"
3. **Consistent terminology**: Use same terms throughout
4. **Formatted well**: Use headings, lists, code blocks
5. **Accessible**: Assume reader is beginner

### Documentation Maintenance

1. **Version everything**: Track what changed when
2. **Deprecate gracefully**: Warn before removing features
3. **Migration guides**: Help users upgrade
4. **Archive old docs**: Keep old versions accessible
5. **Review regularly**: Ensure docs match reality

## Documentation Checklist

Before releasing a command:

- [ ] Description in frontmatter is clear
- [ ] argument-hint documents all arguments
- [ ] Usage examples in comments
- [ ] Common use cases shown
- [ ] Error messages are helpful
- [ ] Requirements documented
- [ ] Related commands listed
- [ ] Changelog maintained
- [ ] Version number updated
- [ ] README created/updated
- [ ] Examples actually work
- [ ] Troubleshooting section complete

With good documentation, commands become self-service, reducing support burden and improving user experience.
