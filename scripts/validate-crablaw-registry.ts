import path from "node:path";
import {
  formatCrabLawRegistryIssues,
  validateCrabLawRegistry,
} from "../src/policy/crabLawRegistryValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateCrabLawRegistry(root);
if (issues.length > 0) {
  process.stderr.write(`${formatCrabLawRegistryIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) process.exitCode = 1;
}
