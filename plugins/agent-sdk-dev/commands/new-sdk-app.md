---
description: Create and setup a new CrabCode Agent SDK application
argument-hint: [project-name]
---

You are tasked with helping the user create a new CrabCode Agent SDK application. Follow these steps carefully:

## Reference Documentation

The authoritative Agent SDK reference ships inside the product as the bundled
`crabcode-api` skill. Invoke `/crabcode-api` and consult, for the user's chosen
language:

- `typescript/agent-sdk/README.md` + `typescript/agent-sdk/patterns.md`
- `python/agent-sdk/README.md` + `python/agent-sdk/patterns.md`

Those files carry the installation commands, the `Agent` / `Tool` surface, and
the built-in tool table. Read them before scaffolding so the code you write
matches the SDK the product actually ships.

For topics beyond the Agent SDK itself — streaming, permissions, MCP
integration, sessions, error handling — the same skill routes to
`{lang}/crabcode-api/*.md` and `shared/*.md`.

**IMPORTANT**: Do not guess a package version. Query the registry your package
manager is configured against (see "Check for Latest Versions" below).

## Gather Requirements

IMPORTANT: Ask these questions one at a time. Wait for the user's response before asking the next question. This makes it easier for the user to respond.

Ask the questions in this order (skip any that the user has already provided via arguments):

1. **Language** (ask first): "Would you like to use TypeScript or Python?"

   - Wait for response before continuing

2. **Project name** (ask second): "What would you like to name your project?"

   - If $ARGUMENTS is provided, use that as the project name and skip this question
   - Wait for response before continuing

3. **Agent type** (ask third, but skip if #2 was sufficiently detailed): "What kind of agent are you building? Some examples:

   - Coding agent (SRE, security review, code review)
   - Business agent (customer support, content creation)
   - Custom agent (describe your use case)"
   - Wait for response before continuing

4. **Starting point** (ask fourth): "Would you like:

   - A minimal 'Hello World' example to start
   - A basic agent with common features
   - A specific example based on your use case"
   - Wait for response before continuing

5. **Tooling choice** (ask fifth): Let the user know what tools you'll use, and confirm with them that these are the tools they want to use (for example, they may prefer pnpm or bun over npm). Respect the user's preferences when executing on the requirements.

After all questions are answered, proceed to create the setup plan.

## Setup Plan

Based on the user's answers, create a plan that includes:

1. **Project initialization**:

   - Create project directory (if it doesn't exist)
   - Initialize package manager:
     - TypeScript: `npm init -y` and setup `package.json` with type: "module" and scripts (include a "typecheck" script)
     - Python: Create `requirements.txt` or use `poetry init`
   - Add necessary configuration files:
     - TypeScript: Create `tsconfig.json` with proper settings for the SDK
     - Python: Optionally create config files if needed

2. **Check for Latest Versions**:

   - BEFORE installing, ask the package manager itself rather than browsing a
     registry website — `npm view crabcode-agent-sdk version` resolves against
     whatever registry the project is configured for, a web page does not
   - Python: `pip install` takes the latest by default; report the resolved
     version after the fact rather than predicting it
   - Inform the user which version you're installing

3. **SDK Installation**:

   - TypeScript: `npm install crabcode-agent-sdk@latest` (or specify latest version)
   - Python: `pip install crabcode-agent-sdk` (pip installs latest by default)
   - After installation, verify the installed version:
     - TypeScript: Check package.json or run `npm list crabcode-agent-sdk`
     - Python: Run `pip show crabcode-agent-sdk`

4. **Create starter files**:

   - TypeScript: Create an `index.ts` or `src/index.ts` with a basic query example
   - Python: Create a `main.py` with a basic query example
   - Include proper imports and basic error handling
   - Use modern, up-to-date syntax and patterns from the latest SDK version

5. **Environment setup**:

   - Create a `.env.example` file with `ACOSMI_API_KEY=your_api_key_here`
   - Add `.env` to `.gitignore`
   - Explain how to obtain a key: running `/login` in CrabCode completes the
     OAuth flow and provisions the key for you. Setting `ACOSMI_API_KEY` by
     hand is the alternative when the app cannot run interactively (CI, for
     instance)

6. **Optional: Create .crabcode directory structure**:
   - Offer to create `.crabcode/` directory for agents, commands, and settings
   - Ask if they want any example agents or slash commands

## Implementation

After gathering requirements and getting user confirmation on the plan:

1. Resolve the package version through the package manager (`npm view`), not a web search
2. Execute the setup steps
3. Create all necessary files
4. Install dependencies (always use latest stable versions)
5. Verify installed versions and inform the user
6. Create a working example based on their agent type
7. Add helpful comments in the code explaining what each part does
8. **VERIFY THE CODE WORKS BEFORE FINISHING**:
   - For TypeScript:
     - Run `npx tsc --noEmit` to check for type errors
     - Fix ALL type errors until types pass completely
     - Ensure imports and types are correct
     - Only proceed when type checking passes with no errors
   - For Python:
     - Verify imports are correct
     - Check for basic syntax errors
   - **DO NOT consider the setup complete until the code verifies successfully**

## Verification

After all files are created and dependencies are installed, use the appropriate verifier agent to validate that the Agent SDK application is properly configured and ready for use:

1. **For TypeScript projects**: Launch the **agent-sdk-verifier-ts** agent to validate the setup
2. **For Python projects**: Launch the **agent-sdk-verifier-py** agent to validate the setup
3. The agent will check SDK usage, configuration, functionality, and adherence to official documentation
4. Review the verification report and address any issues

## Getting Started Guide

Once setup is complete and verified, provide the user with:

1. **Next steps**:

   - How to set their API key
   - How to run their agent:
     - TypeScript: `npm start` or `node --loader ts-node/esm index.ts`
     - Python: `python main.py`

2. **Useful resources**:

   - The bundled `crabcode-api` skill (`/crabcode-api`) — `{lang}/agent-sdk/`
     for the SDK itself, `{lang}/crabcode-api/` for the underlying API
   - Explain key concepts: system prompts, permissions, tools, MCP servers

3. **Common next steps**:
   - How to customize the system prompt
   - How to add custom tools via MCP
   - How to configure permissions
   - How to create agents

## Important Notes

- **ALWAYS USE LATEST VERSIONS**: Resolve versions through the package manager
  against the registry the project is configured for. Do not paste a version
  read off a public registry web page — the package name there may belong to
  someone else entirely
- **VERIFY CODE RUNS CORRECTLY**:
  - For TypeScript: Run `npx tsc --noEmit` and fix ALL type errors before finishing
  - For Python: Verify syntax and imports are correct
  - Do NOT consider the task complete until the code passes verification
- Verify the installed version after installation and inform the user
- Check the official documentation for any version-specific requirements (Node.js version, Python version, etc.)
- Always check if directories/files already exist before creating them
- Use the user's preferred package manager (npm, yarn, pnpm for TypeScript; pip, poetry for Python)
- Ensure all code examples are functional and include proper error handling
- Use modern syntax and patterns that are compatible with the latest SDK version
- Make the experience interactive and educational
- **ASK QUESTIONS ONE AT A TIME** - Do not ask multiple questions in a single response

Begin by asking the FIRST requirement question only. Wait for the user's answer before proceeding to the next question.
