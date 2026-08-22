# Terraform

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with HashiCorp's Terraform MCP server, run as a Docker
container.

## Connect

- Docker must be installed and running on the host.
- For Terraform Enterprise / Cloud access, export `TFE_TOKEN` in your shell.
- The plugin runs `docker run -i --rm hashicorp/terraform-mcp-server:0.4.0`
  on stdio.

## What you can do

- Inspect and lint Terraform modules
- Generate `terraform plan` summaries
- Cross-reference module inputs, outputs, and resource graphs
- Reason about IaC changes alongside your code

## Safety

`terraform apply` mutates real infrastructure. CrabCode does not run apply
implicitly through this plugin; never let an assistant apply changes without
a human approval step. Use a dedicated Terraform workspace or short-lived
credentials for any plugin-driven plans you intend to apply later.
