import path from "node:path";
import { formatLayoutIssues, validateLayout } from "../src/policy/layoutValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateLayout(root);

if (issues.length > 0) {
  process.stderr.write(`${formatLayoutIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}
