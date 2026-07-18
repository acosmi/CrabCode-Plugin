import path from "node:path";
import {
  formatMcpContractIssues,
  validateMcpContract,
} from "../src/policy/mcpContractValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateMcpContract(root);

if (issues.length > 0) {
  process.stderr.write(`${formatMcpContractIssues(issues, root)}\n`);
}
if (issues.some((issue) => issue.severity === "error")) {
  process.exitCode = 1;
} else if (issues.length === 0) {
  process.stdout.write("validate-mcp-contract: all checks passed\n");
} else {
  process.stdout.write(`validate-mcp-contract: passed with ${issues.length} legacy baseline warning(s)\n`);
}
