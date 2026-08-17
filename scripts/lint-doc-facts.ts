import path from "node:path";
import { formatDocFactsIssues, validateDocFacts } from "../src/policy/docFactsValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateDocFacts(root);

if (issues.length > 0) {
  process.stderr.write(`${formatDocFactsIssues(issues, root)}\n`);
}
const errors = issues.filter((issue) => issue.severity === "error").length;
const warnings = issues.length - errors;
if (issues.length > 0) {
  process.stderr.write(`lint:doc-facts — ${errors} error(s), ${warnings} warning(s)\n`);
}
if (errors > 0) {
  process.exitCode = 1;
}
