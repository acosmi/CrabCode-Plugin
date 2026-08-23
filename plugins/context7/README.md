# Context7

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Context7 MCP integration metadata. The current package provides no
Context7 tools or connection.

## Historical connection reference (inactive)

The removed configuration used an unpinned `npx` launcher. It is documented as
incident history only and must not be copied or executed.

## Historical target capabilities (not available)

- Look up a library by name and pull current documentation
- Pin documentation to a specific version
- Pull representative code snippets from upstream sources
- Use the docs as additional context for code generation and review

## Notes

If a future approved integration is restored, freshness will depend on the
provider's index. The current plugin does not fetch, cache, or mutate Context7 state.
