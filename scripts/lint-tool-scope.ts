import path from "node:path";
import {
  formatMatterGateIssues,
  validateMatterGate,
} from "../src/policy/matterGateValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateMatterGate(root);

if (issues.length > 0) {
  process.stderr.write(`${formatMatterGateIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}
