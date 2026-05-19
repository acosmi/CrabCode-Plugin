---
name: mcp-builder
description: "Guide for creating high-quality MCP (Model Context Protocol) servers that enable agents to interact with external services through well-designed tools. Use this skill when building an MCP server to integrate an external API or service, whether in Python (FastMCP) or Node/TypeScript (MCP SDK)."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that let agents interact
with external services through well-designed tools. The quality of an
MCP server is measured by how well it enables agents to accomplish
real-world tasks.

## High-Level Workflow

### Phase 1 — Research and Planning

#### Understand Modern MCP Design

**API coverage vs. workflow tools.** Balance comprehensive endpoint
coverage with specialized workflow tools. Workflow tools are
convenient for specific tasks; comprehensive coverage gives agents
flexibility to compose operations. When uncertain, prioritize
comprehensive API coverage.

**Tool naming and discoverability.** Use clear, descriptive names with
consistent prefixes (for example, `github_create_issue`,
`github_list_repos`) and action-oriented verbs.

**Context management.** Keep tool descriptions concise. Return focused,
relevant data. Provide filter or pagination parameters so agents can
narrow results.

**Actionable error messages.** Error payloads must guide the agent
toward a fix with concrete next steps.

#### Study the MCP Protocol

Start with the protocol sitemap at
`https://modelcontextprotocol.io/sitemap.xml`. Fetch individual pages
with the `.md` suffix for markdown rendering.

Key topics:

- Specification overview and architecture.
- Transports: streamable HTTP, stdio.
- Tool, resource, and prompt definitions.

#### Study Framework Documentation

**Recommended stack.** TypeScript with the official MCP SDK. The
TypeScript SDK has strong tooling support and static typing. Choose
streamable HTTP transport for remote servers and stdio for local
servers.

Reference material:

- TypeScript SDK README:
  `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`
- Python SDK README:
  `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`
- The skill's `reference/` directory contains best-practice notes and
  language-specific patterns.

#### Plan the Implementation

Review the target service's API documentation. Identify key endpoints,
authentication, and data models. List the endpoints to expose,
starting with the most common operations.

### Phase 2 — Implementation

#### Project Structure

Follow the language-specific guide under `reference/`:

- TypeScript: project layout, `package.json`, `tsconfig.json`, build
  scripts.
- Python: module organization, dependencies, virtualenv setup.

#### Core Infrastructure

Create shared utilities:

- API client with authentication.
- Error handling helpers.
- Response formatting (JSON or markdown).
- Pagination support.

#### Implement Tools

For each tool:

- **Input schema**: use Zod (TypeScript) or Pydantic (Python). Include
  constraints and clear descriptions; add examples in field
  descriptions when behavior is not obvious.
- **Output schema**: define `outputSchema` where possible. Use
  `structuredContent` in tool responses when the SDK supports it.
- **Tool description**: concise summary of behavior, parameter
  descriptions, and the return shape.
- **Implementation**: async/await for I/O. Actionable error messages.
  Support pagination. Return both text content and structured data
  when modern SDKs allow it.
- **Annotations**: set `readOnlyHint`, `destructiveHint`,
  `idempotentHint`, and `openWorldHint` accurately.

### Phase 3 — Review and Test

**Code quality.** Eliminate duplication. Apply consistent error
handling. Provide full type coverage. Make tool descriptions match the
implementation.

**Build and verify.**

- TypeScript: `npm run build` for compilation. Test with the MCP
  Inspector (`npx @modelcontextprotocol/inspector`).
- Python: `python -m py_compile <module>` for syntax. Test with the
  MCP Inspector.

### Phase 4 — Create Evaluations

After implementation, build evaluations that test whether agents can
use the server to answer realistic questions.

**Create ten evaluation questions** following the process in
`reference/evaluation.md`:

1. **Tool inspection**: list available tools and understand their
   surface.
2. **Content exploration**: use read-only tools to explore data.
3. **Question generation**: create ten complex, realistic questions.
4. **Answer verification**: solve each question and record the
   verified answer.

**Each question must be:**

- Independent of other questions.
- Read-only: solvable with non-destructive operations.
- Complex: requires multiple tool calls and exploration.
- Realistic: grounded in a real use case.
- Verifiable: a single answer that can be checked by string
  comparison.
- Stable: the answer should not drift over time.

**Output format.** Write an XML file:

```xml
<evaluation>
  <qa_pair>
    <question>Example question that requires multiple tools to answer.</question>
    <answer>42</answer>
  </qa_pair>
</evaluation>
```

## Reference Files

Load these resources as needed during development:

- `reference/mcp_best_practices.md` — universal guidelines (naming,
  response format, pagination, transports, security, error handling).
- `reference/node_mcp_server.md` — TypeScript implementation patterns.
- `reference/python_mcp_server.md` — Python implementation patterns.
- `reference/evaluation.md` — evaluation creation guide.

Fetch the MCP protocol pages and SDK READMEs from their canonical URLs
when the topic requires authoritative reference.
