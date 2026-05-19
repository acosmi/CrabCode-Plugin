# Serena

CrabCode integration with the [Serena](https://github.com/oraios/serena) MCP
server by Oraios. Serena layers LSP-driven semantic understanding on top of
the codebase.

## Connect

The plugin runs `uvx --from git+https://github.com/oraios/serena serena
start-mcp-server` on stdio. You need [uv](https://github.com/astral-sh/uv)
(`uvx`) installed; the first run will fetch Serena.

## What you can do

- Jump to definitions, references, and implementations across the codebase
- Inspect symbol shape and module-level structure
- Get refactoring suggestions grounded in language-server data
- Navigate large repositories more efficiently than text-grep alone

## Notes

This integration is community-maintained upstream. Consult the Serena
project for supported languages and configuration.
