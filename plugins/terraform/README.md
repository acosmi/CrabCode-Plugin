# Terraform

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
