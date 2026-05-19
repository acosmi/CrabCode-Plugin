# GitHub

CrabCode integration with the GitHub-hosted MCP endpoint. Manage repositories,
issues, pull requests, and reviews from your CrabCode session.

## Connect

Set `GITHUB_PERSONAL_ACCESS_TOKEN` in your environment with a token that
carries the scopes you intend to use. The MCP transport is HTTP; the token is
passed as a bearer header.

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."
```

## What you can do

- Create and update issues
- Open, review, and merge pull requests
- Search code and repositories
- Read and update repository metadata

## Notes

This plugin only wires the GitHub MCP endpoint into CrabCode. CrabCode does
not own or maintain that server; authentication and rate limits follow
GitHub's policy.
