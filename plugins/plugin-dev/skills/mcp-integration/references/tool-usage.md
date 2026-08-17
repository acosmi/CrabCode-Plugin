# Using MCP Tools in Commands and Agents

Complete guide to using MCP tools effectively in CrabCode plugin commands and agents.

## Overview

Once an MCP server is configured, its tools become available under a generated
`mcp__…__…` name. Use them in commands and agents just like built-in CrabCode
tools.

## Tool Naming Convention

### Format

```
mcp__<server-namespace>__<tool-name>
```

For plugin-provided servers the namespace is **derived, not authored**: `p_`
followed by a 24-character hash of the server's internal runtime identity.

```
mcp__p_<24-hex-digest>__<tool-name>
```

You therefore cannot assemble the name from the plugin and server names. Read
it from `/mcp` and paste it verbatim. The digests below are illustrative
placeholders — yours will differ.

### Examples

**Asana plugin with asana server:**
- `mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task`
- `mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks`
- `mcp__p_1f4c9a2be70d5836a1b4c7e2__get_project`

**Custom plugin with database server:**
- `mcp__p_47ac1d90fe6b28c3705ea8b1__query`
- `mcp__p_47ac1d90fe6b28c3705ea8b1__execute`
- `mcp__p_47ac1d90fe6b28c3705ea8b1__list_tables`

### Discovering Tool Names

**Use `/mcp` command:**
```bash
/mcp
```

This shows:
- All available MCP servers
- Tools provided by each server
- Tool schemas and descriptions
- Full tool names for use in configuration

## Using Tools in Commands

### Pre-Allowing Tools

Specify MCP tools in command frontmatter:

```markdown
---
description: Create a new Asana task
allowed-tools: [
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task"
]
---

# Create Task Command

To create a task:
1. Gather task details from user
2. Use mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task with the details
3. Confirm creation to user
```

### Multiple Tools

```markdown
---
allowed-tools: [
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task",
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks",
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__get_project"
]
---
```

### Wildcard (Use Sparingly)

```markdown
---
allowed-tools: ["mcp__p_1f4c9a2be70d5836a1b4c7e2__*"]
---
```

**Caution:** Only use wildcards if the command truly needs access to all tools from a server.

### Tool Usage in Command Instructions

**Example command:**
```markdown
---
description: Search and create Asana tasks
allowed-tools: [
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks",
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task"
]
---

# Asana Task Management

## Searching Tasks

To search for tasks:
1. Use mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks
2. Provide search filters (assignee, project, etc.)
3. Display results to user

## Creating Tasks

To create a task:
1. Gather task details:
   - Title (required)
   - Description
   - Project
   - Assignee
   - Due date
2. Use mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task
3. Show confirmation with task link
```

## Using Tools in Agents

### Agent Configuration

Agents can use MCP tools autonomously without pre-allowing them:

```markdown
---
name: asana-status-updater
description: This agent should be used when the user asks to "update Asana status", "generate project report", or "sync Asana tasks"
model: inherit
color: blue
---

## Role

Autonomous agent for generating Asana project status reports.

## Process

1. **Query tasks**: Use mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks to get all tasks
2. **Analyze progress**: Calculate completion rates and identify blockers
3. **Generate report**: Create formatted status update
4. **Update Asana**: Use mcp__p_1f4c9a2be70d5836a1b4c7e2__create_comment to post report

## Available Tools

The agent has access to all Asana MCP tools without pre-approval.
```

### Agent Tool Access

Agents are scoped by their own frontmatter, not by a command's allowlist:

- Omit `tools` and the agent may use any available tool, MCP tools included
- Declare `tools` and the agent is restricted to exactly that list — an MCP
  tool left out of it is not reachable
- Either way, document which tools the agent typically uses

The choice is a real one: an unrestricted agent adapts, a restricted agent is
predictable. Prefer declaring `tools` for agents that touch external services.

## Tool Call Patterns

### Pattern 1: Simple Tool Call

Single tool call with validation:

```markdown
Steps:
1. Validate user provided required fields
2. Call mcp__p_9b3e70c4d128af56be0913da__create_item with validated data
3. Check for errors
4. Display confirmation
```

### Pattern 2: Sequential Tools

Chain multiple tool calls:

```markdown
Steps:
1. Search for existing items: mcp__p_9b3e70c4d128af56be0913da__search
2. If not found, create new: mcp__p_9b3e70c4d128af56be0913da__create
3. Add metadata: mcp__p_9b3e70c4d128af56be0913da__update_metadata
4. Return final item ID
```

### Pattern 3: Batch Operations

Multiple calls with same tool:

```markdown
Steps:
1. Get list of items to process
2. For each item:
   - Call mcp__p_9b3e70c4d128af56be0913da__update_item
   - Track success/failure
3. Report results summary
```

### Pattern 4: Error Handling

Graceful error handling:

```markdown
Steps:
1. Try to call mcp__p_9b3e70c4d128af56be0913da__get_data
2. If error (rate limit, network, etc.):
   - Wait and retry (max 3 attempts)
   - If still failing, inform user
   - Suggest checking configuration
3. On success, process data
```

## Tool Parameters

### Understanding Tool Schemas

Each MCP tool has a schema defining its parameters. View with `/mcp`.

**Example schema:**
```json
{
  "name": "asana_create_task",
  "description": "Create a new Asana task",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Task title"
      },
      "notes": {
        "type": "string",
        "description": "Task description"
      },
      "workspace": {
        "type": "string",
        "description": "Workspace GID"
      }
    },
    "required": ["name", "workspace"]
  }
}
```

### Calling Tools with Parameters

The model fills in the tool's parameters from its schema, the same way it does
for built-in tools — you do not hand-write the call. Conceptually the tool is
invoked with the arguments its schema declares:

```jsonc
// Illustrative shape only — not an internal format you can rely on
{
  "name": "Review PR #123",
  "notes": "Code review for new feature",
  "workspace": "12345",
  "assignee": "67890",
  "due_on": "2025-01-15"
}
```

What you control is the schema your server publishes and the instructions in
your command or agent. Make required parameters required in the schema and
describe them well; that is what makes the call come out right.

### Parameter Validation

**In commands, validate before calling:**

```markdown
Steps:
1. Check required parameters:
   - Title is not empty
   - Workspace ID is provided
   - Due date is valid format (YYYY-MM-DD)
2. If validation fails, ask user to provide missing data
3. If validation passes, call MCP tool
4. Handle tool errors gracefully
```

## Response Handling

### Success Responses

```markdown
Steps:
1. Call MCP tool
2. On success:
   - Extract relevant data from response
   - Format for user display
   - Provide confirmation message
   - Include relevant links or IDs
```

### Error Responses

```markdown
Steps:
1. Call MCP tool
2. On error:
   - Check error type (auth, rate limit, validation, etc.)
   - Provide helpful error message
   - Suggest remediation steps
   - Don't expose internal error details to user
```

### Partial Success

```markdown
Steps:
1. Batch operation with multiple MCP calls
2. Track successes and failures separately
3. Report summary:
   - "Successfully processed 8 of 10 items"
   - "Failed items: [item1, item2] due to [reason]"
   - Suggest retry or manual intervention
```

## Performance Optimization

### Batching Requests

**Good: Single query with filters**
```markdown
Steps:
1. Call mcp__p_9b3e70c4d128af56be0913da__search with filters:
   - project_id: "123"
   - status: "active"
   - limit: 100
2. Process all results
```

**Avoid: Many individual queries**
```markdown
Steps:
1. For each item ID:
   - Call mcp__p_9b3e70c4d128af56be0913da__get_item
   - Process item
```

### Caching Results

```markdown
Steps:
1. Call expensive MCP operation: mcp__p_9b3e70c4d128af56be0913da__analyze
2. Store results in variable for reuse
3. Use cached results for subsequent operations
4. Only re-fetch if data changes
```

### Independent Tool Calls

When calls do not depend on each other, say so — an instruction to fetch them
together is what makes concurrency possible:

```markdown
Steps:
1. These three are independent; request them in one batch:
   - mcp__p_9b3e70c4d128af56be0913da__get_project
   - mcp__p_9b3e70c4d128af56be0913da__get_users
   - mcp__p_9b3e70c4d128af56be0913da__get_tags
2. Combine the results
```

Whether they actually overlap depends on the model and the server; write the
instruction so that batching is possible, and do not depend on it for
correctness. Anything that must happen in order should be stated in order.

## Integration Best Practices

### User Experience

**Provide feedback:**
```markdown
Steps:
1. Inform user: "Searching Asana tasks..."
2. Call mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks
3. Show progress: "Found 15 tasks, analyzing..."
4. Present results
```

**Handle long operations:**
```markdown
Steps:
1. Warn user: "This may take a minute..."
2. Break into smaller steps with updates
3. Show incremental progress
4. Final summary when complete
```

### Error Messages

**Good error messages:**
```
❌ "Could not create task. Please check:
   1. You're logged into Asana
   2. You have access to workspace 'Engineering'
   3. The project 'Q1 Goals' exists"
```

**Poor error messages:**
```
❌ "Error: MCP tool returned 403"
```

### Documentation

**Document MCP tool usage in command:**
```markdown
## MCP Tools Used

This command uses the following Asana MCP tools:
- **asana_search_tasks**: Search for tasks matching criteria
- **asana_create_task**: Create new task with details
- **asana_update_task**: Update existing task properties

Ensure you're authenticated to Asana before running this command.
```

## Testing Tool Usage

### Local Testing

1. **Configure MCP server** in `.mcp.json`
2. **Install plugin locally** in `.crabcode-plugin/`
3. **Verify tools available** with `/mcp`
4. **Test command** that uses tools
5. **Check debug output**: `crabcode --debug`

### Test Scenarios

**Test successful calls:**
```markdown
Steps:
1. Create test data in external service
2. Run command that queries this data
3. Verify correct results returned
```

**Test error cases:**
```markdown
Steps:
1. Test with missing authentication
2. Test with invalid parameters
3. Test with non-existent resources
4. Verify graceful error handling
```

**Test edge cases:**
```markdown
Steps:
1. Test with empty results
2. Test with maximum results
3. Test with special characters
4. Test with concurrent access
```

## Common Patterns

### Pattern: CRUD Operations

```markdown
---
allowed-tools: [
  "mcp__p_9b3e70c4d128af56be0913da__create_item",
  "mcp__p_9b3e70c4d128af56be0913da__read_item",
  "mcp__p_9b3e70c4d128af56be0913da__update_item",
  "mcp__p_9b3e70c4d128af56be0913da__delete_item"
]
---

# Item Management

## Create
Use create_item with required fields...

## Read
Use read_item with item ID...

## Update
Use update_item with item ID and changes...

## Delete
Use delete_item with item ID (ask for confirmation first)...
```

### Pattern: Search and Process

```markdown
Steps:
1. **Search**: mcp__p_9b3e70c4d128af56be0913da__search with filters
2. **Filter**: Apply additional local filtering if needed
3. **Transform**: Process each result
4. **Present**: Format and display to user
```

### Pattern: Multi-Step Workflow

```markdown
Steps:
1. **Setup**: Gather all required information
2. **Validate**: Check data completeness
3. **Execute**: Chain of MCP tool calls:
   - Create parent resource
   - Create child resources
   - Link resources together
   - Add metadata
4. **Verify**: Confirm all steps succeeded
5. **Report**: Provide summary to user
```

## Troubleshooting

### Tools Not Available

**Check:**
- MCP server configured correctly
- Server connected (check `/mcp`)
- Tool names match exactly (case-sensitive)
- Restart CrabCode after config changes

### Tool Calls Failing

**Check:**
- Authentication is valid
- Parameters match tool schema
- Required parameters provided
- Check `crabcode --debug` logs

### Performance Issues

**Check:**
- Batching queries instead of individual calls
- Caching results when appropriate
- Not making unnecessary tool calls
- Parallel calls when possible

## Conclusion

Effective MCP tool usage requires:
1. **Understanding tool schemas** via `/mcp`
2. **Pre-allowing tools** in commands appropriately
3. **Handling errors gracefully**
4. **Optimizing performance** with batching and caching
5. **Providing good UX** with feedback and clear errors
6. **Testing thoroughly** before deployment

Follow these patterns for robust MCP tool integration in your plugin commands and agents.
