---
name: 流程文档编写
short-description: 把业务流程整理为角色、步骤、输入输出和关键控制点
description: Documents a business process as a complete SOP — purpose, scope, RACI matrix, process flow, detailed steps, and edge cases. Use when formalizing a process that lives in someone's head, building a RACI to clarify who owns what, writing an SOP or process doc for a handoff, onboarding, or audit, capturing the exceptions and edge cases of how work actually gets done, or when the user says "document this process", "write an SOP", "who's responsible for what", or "we need this written down". For step-by-step operational procedures with commands and troubleshooting, use the runbook skill instead.
argument-hint: "<process name or description>"
---

# /process-doc

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).

Document a business process as a complete standard operating procedure (SOP).

## Usage

```
/process-doc $ARGUMENTS
```

## How It Works

Walk me through the process — describe it, paste existing docs, or just tell me the name and I'll ask the right questions. I'll produce a complete SOP.

## Output

```markdown
## Process Document: [Process Name]
**Owner:** [Person/Team] | **Last Updated:** [Date] | **Review Cadence:** [Quarterly/Annually]

### Purpose
[Why this process exists and what it accomplishes]

### Scope
[What's included and excluded]

### RACI Matrix
| Step | Responsible | Accountable | Consulted | Informed |
|------|------------|-------------|-----------|----------|
| [Step] | [Who does it] | [Who owns it] | [Who to ask] | [Who to tell] |

### Process Flow
[ASCII flowchart or step-by-step description]

### Detailed Steps

#### Step 1: [Name]
- **Who**: [Role]
- **When**: [Trigger or timing]
- **How**: [Detailed instructions]
- **Output**: [What this step produces]

#### Step 2: [Name]
[Same format]

### Exceptions and Edge Cases
| Scenario | What to Do |
|----------|-----------|
| [Exception] | [How to handle it] |

### Metrics
| Metric | Target | How to Measure |
|--------|--------|----------------|
| [Metric] | [Target] | [Method] |

### Related Documents
- [Link to related process or policy]
```

## If Connectors Available

If **~~knowledge base** is connected:
- Search for existing process documentation to update rather than duplicate
- Publish the completed SOP to your wiki

If **~~project tracker** is connected:
- Link the process to related projects and workflows
- Create tasks for process improvement action items

## Tips

1. **Start messy** — You don't need a perfect description. Tell me how it works today and I'll structure it.
2. **Include the exceptions** — "Usually we do X, but sometimes Y" is the most valuable part to document.
3. **Name the people** — Even if roles change, knowing who does what today helps get the process right.
