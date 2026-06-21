# Article Type Templates

Structure and best practices for each KB article type. Pick the type that matches the source material (see "Understand the Source Material" in the main SKILL.md), then follow its structure and apply the type-specific best practices.

## Contents
- [How-to Articles](#how-to-articles)
- [Troubleshooting Articles](#troubleshooting-articles)
- [FAQ Articles](#faq-articles)
- [Known Issue Articles](#known-issue-articles)

## How-to Articles

**Purpose**: Step-by-step instructions for accomplishing a task.

**Structure**:
```
# How to [accomplish task]

[Overview — what this guide covers and when you'd use it]

## Prerequisites
- [What's needed before starting]

## Steps
### 1. [Action]
[Instruction with specific details]

### 2. [Action]
[Instruction]

## Verify It Worked
[How to confirm success]

## Common Issues
- [Issue]: [Fix]

## Related Articles
- [Links]
```

**Best practices**:
- Start each step with a verb
- Include the specific path: "Go to Settings > Integrations > API Keys"
- Mention what the user should see after each step ("You should see a green confirmation banner")
- Test the steps yourself or verify with a recent ticket resolution

## Troubleshooting Articles

**Purpose**: Diagnose and resolve a specific problem.

**Structure**:
```
# [Problem description — what the user sees]

## Symptoms
- [What the user observes]

## Cause
[Why this happens — brief, non-jargon explanation]

## Solution
### Option 1: [Primary fix]
[Steps]

### Option 2: [Alternative if Option 1 doesn't work]
[Steps]

## Prevention
[How to avoid this in the future]

## Still Having Issues?
[How to get help]
```

**Best practices**:
- Lead with symptoms, not causes — customers search for what they see
- Provide multiple solutions when possible (most likely fix first)
- Include a "Still having issues?" section that points to support
- If the root cause is complex, keep the customer-facing explanation simple

## FAQ Articles

**Purpose**: Quick answer to a common question.

**Structure**:
```
# [Question — in the customer's words]

[Direct answer — 1-3 sentences]

## Details
[Additional context, nuance, or explanation if needed]

## Related Questions
- [Link to related FAQ]
- [Link to related FAQ]
```

**Best practices**:
- Answer the question in the first sentence
- Keep it concise — if the answer needs a walkthrough, it's a how-to, not an FAQ
- Group related FAQs and link between them

## Known Issue Articles

**Purpose**: Document a known bug or limitation with a workaround.

**Structure**:
```
# [Known Issue]: [Brief description]

**Status:** [Investigating / Workaround Available / Fix In Progress / Resolved]
**Affected:** [Who/what is affected]
**Last updated:** [Date]

## Symptoms
[What users experience]

## Workaround
[Steps to work around the issue, or "No workaround available"]

## Fix Timeline
[Expected fix date or current status]

## Updates
- [Date]: [Update]
```

**Best practices**:
- Keep the status current — nothing erodes trust faster than a stale known issue article
- Update the article when the fix ships and mark as resolved
- If resolved, keep the article live for 30 days for customers still searching the old symptoms
