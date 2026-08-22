# Laravel Boost

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with the Laravel Boost MCP server. The Boost server runs
inside your Laravel application via `php artisan boost:mcp`, so CrabCode
talks to the same code, routes, and database the application sees.

## Connect

1. Install the Laravel Boost package in your application and run any vendor
   setup it requires.
2. Make sure `php artisan boost:mcp` runs from the project root.
3. Launch CrabCode from that project root; the plugin invokes the command on
   stdio.

## What you can do

- Inspect routes, controllers, and middleware
- Run safe Artisan introspection commands
- Inspect and query Eloquent models
- Generate framework-aware code with project-level context

## Notes

The MCP server runs inside your Laravel process. Treat its filesystem and
database access as if you were running Artisan locally.
