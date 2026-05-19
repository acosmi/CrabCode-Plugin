# Greptile

[Greptile](https://greptile.com) is an AI code review agent for GitHub and
GitLab. This plugin connects CrabCode to your Greptile account so you can
view and resolve Greptile's review comments directly from your editor.

## Connect

1. Sign in at [greptile.com](https://greptile.com) and link your GitHub or
   GitLab repositories.
2. Create an API key at
   [https://app.greptile.com/settings/api](https://app.greptile.com/settings/api).
3. Export the key for the shell that launches CrabCode:

   ```bash
   export GREPTILE_API_KEY="grpt_..."
   ```

The MCP transport is HTTP; the key is passed as a bearer header.

## What you can do

- List, search, and inspect pull requests and merge requests
- Trigger a Greptile review on a pull request
- Read review comments, search past comments, and respond inline
- Inspect and create organization-level custom-context patterns

## Notes

This plugin only wires the Greptile MCP endpoint into CrabCode. CrabCode does
not own or maintain that server; authentication, retention, and rate limits
follow Greptile's policy.
