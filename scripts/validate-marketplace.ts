import path from "node:path";
import {
  formatMarketplaceIssues,
  validateMarketplace,
} from "../src/policy/marketplaceValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateMarketplace(root);

if (issues.length > 0) {
  process.stderr.write(`${formatMarketplaceIssues(issues, root)}\n`);
  if (issues.some((issue) => issue.severity === "error")) {
    process.exitCode = 1;
  }
}
