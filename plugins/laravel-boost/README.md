# Laravel Boost

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Laravel Boost MCP integration metadata. The current package does not
run Artisan or connect CrabCode to an application.

## Historical connection reference (inactive)

The removed configuration historically invoked `php artisan boost:mcp` from a
project root. Do not use this as setup instruction; future restoration requires
an explicit local-runtime and release review.

## Historical target capabilities (not available)

- Inspect routes, controllers, and middleware
- Run safe Artisan introspection commands
- Inspect and query Eloquent models
- Generate framework-aware code with project-level context

## Notes

Any future runtime would have application filesystem and database access and
must be reviewed accordingly. No server runs in the current version.
