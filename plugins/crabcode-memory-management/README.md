# CRABCODE.md Management Plugin

Tools to maintain and improve CRABCODE.md files - audit quality, capture session learnings, and keep project memory current.

## What It Does

Two complementary tools for different purposes:

| | crabcode-md-improver (skill) | /revise-crabcode-md (command) |
|---|---|---|
| **Purpose** | Keep CRABCODE.md aligned with codebase | Capture session learnings |
| **Triggered by** | Codebase changes | End of session |
| **Use when** | Periodic maintenance | Session revealed missing context |

## Usage

### Skill: crabcode-md-improver

Audits CRABCODE.md files against current codebase state:

```
"audit my CRABCODE.md files"
"check if my CRABCODE.md is up to date"
```

*(Demo screenshot removed during migration — re-render with CrabCode branding before publishing.)*

### Command: /revise-crabcode-md

Captures learnings from the current session:

```
/revise-crabcode-md
```

*(Demo screenshot removed during migration — re-render with CrabCode branding before publishing.)*

## Provenance

Adapted from upstream open-source plugin source. See `docs/legal/THIRD_PARTY_NOTICES.md` for upstream commit hash and license.
