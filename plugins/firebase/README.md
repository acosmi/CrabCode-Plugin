# Firebase

CrabCode integration with Google Firebase via the official `firebase-tools`
MCP entry. Manage Firestore, Auth, Cloud Functions, Hosting, and Storage from
the same workflow you use for code.

## Connect

The plugin runs `npx -y firebase-tools@latest mcp` on stdio. Run
`firebase login` in the same shell once, and the MCP server will reuse those
credentials.

## What you can do

- Inspect and edit Firestore documents
- Inspect Authentication users
- Trigger and inspect Cloud Functions
- Review hosting and storage configuration

## Notes

Operations execute against whatever project is currently selected with
`firebase use`. Treat production projects accordingly.
