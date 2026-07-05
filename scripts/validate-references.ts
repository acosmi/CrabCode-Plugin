import path from "node:path";
import { formatReferenceIssues, validateReferences } from "../src/policy/referenceValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateReferences(root);

if (issues.length > 0) {
  process.stderr.write(`${formatReferenceIssues(issues, root)}\n`);
}
const errors = issues.filter((issue) => issue.severity === "error").length;
const warnings = issues.length - errors;
if (issues.length > 0) {
  process.stderr.write(`lint:refs — ${errors} error(s), ${warnings} warning(s)\n`);
}
if (errors > 0) {
  process.exitCode = 1;
}
