# Terraform

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Terraform MCP integration metadata. The current package starts no
container and provides no Terraform MCP tools.

## Historical connection reference (inactive)

- The removed configuration historically invoked a pinned Docker image.
- Do not export `TFE_TOKEN` or run that image for this inactive plugin.
- Any future restoration requires artifact provenance, local tests, and an
  approved host/release contract.

## Historical target capabilities (not available)

- Inspect and lint Terraform modules
- Generate `terraform plan` summaries
- Cross-reference module inputs, outputs, and resource graphs
- Reason about IaC changes alongside your code

## Safety

`terraform apply` mutates real infrastructure. CrabCode does not run apply
implicitly through this plugin; never let an assistant apply changes without
a human approval step. Use a dedicated Terraform workspace or short-lived
credentials for any plugin-driven plans you intend to apply later.
