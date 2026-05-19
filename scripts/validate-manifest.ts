import path from "node:path";
import { formatManifestIssues, validateManifests } from "../src/policy/manifestValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateManifests(root);

if (issues.length > 0) {
  process.stderr.write(`${formatManifestIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}
