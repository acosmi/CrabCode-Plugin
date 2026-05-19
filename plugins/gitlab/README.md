# GitLab

CrabCode integration with the GitLab.com hosted MCP endpoint.

## Connect

The endpoint is `https://gitlab.com/api/v4/mcp`. GitLab will perform its own
authorization flow on first connection. Self-managed GitLab instances should
swap the URL in `.mcp.json` to their own `/api/v4/mcp` endpoint.

## What you can do

- Manage repositories and branches
- Review and merge merge requests
- Inspect and trigger CI/CD pipelines
- Manage issues, wikis, and epics

## Notes

This plugin only wires the GitLab MCP endpoint into CrabCode. CrabCode does
not own or maintain that server; authentication and rate limits follow
GitLab's policy.
