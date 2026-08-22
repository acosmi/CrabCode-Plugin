import path from "node:path";
import {
  formatWorkflowTriggerIssues,
  validateManualWorkflowTriggers,
} from "../src/policy/workflowTriggerValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");
const issues = await validateManualWorkflowTriggers(root);

if (issues.length > 0) {
  process.stderr.write(`${formatWorkflowTriggerIssues(issues)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("validate-workflow-triggers: all workflows are API-manual only\n");
}
