# Context7

CrabCode integration with the Upstash Context7 MCP server. Fetch
version-specific library docs and code examples on demand without leaving
your editor.

## Connect

The plugin runs `npx -y @upstash/context7-mcp` on stdio. Node.js and an
installable `npx` are the only host requirements.

## What you can do

- Look up a library by name and pull current documentation
- Pin documentation to a specific version
- Pull representative code snippets from upstream sources
- Use the docs as additional context for code generation and review

## Notes

Documentation freshness depends on Context7's index; CrabCode does not cache
or mutate Context7 state.
