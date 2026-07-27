import path from "node:path";
import {
  formatVersionConsistencyIssues,
  validateVersionConsistency,
} from "../src/policy/versionConsistencyValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateVersionConsistency(root);

if (issues.length > 0) {
  process.stderr.write(`${formatVersionConsistencyIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}
