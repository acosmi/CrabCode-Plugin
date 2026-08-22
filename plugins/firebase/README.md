# Firebase

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

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
