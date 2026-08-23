/** Public diagnostics emitted by the repository MCP executable gate. */
export type McpContractIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export { validateMcpExecutableContract as validateMcpContract } from "./mcpExecutableGate.ts";

export function formatMcpContractIssues(issues: McpContractIssue[], root: string): string {
  void root;
  return issues
    .map((issue) => `${issue.severity === "error" ? "ERROR" : "warn"} ${issue.path}: ${issue.message}`)
    .join("\n");
}
