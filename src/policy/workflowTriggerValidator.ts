import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type WorkflowTriggerIssue = {
  severity: "error";
  path: string;
  message: string;
};

/**
 * Enforce the repository-wide pause on automatic GitHub Actions execution.
 *
 * `workflow_dispatch` can be invoked manually in the GitHub UI or through the
 * REST API. No push, pull_request, schedule, repository_dispatch, or other
 * event is accepted while the pause is active.
 */
export async function validateManualWorkflowTriggers(
  root: string,
): Promise<WorkflowTriggerIssue[]> {
  const issues: WorkflowTriggerIssue[] = [];
  const workflowsRoot = path.join(root, ".github", "workflows");
  let files: string[];
  try {
    files = (await readdir(workflowsRoot))
      .filter((file) => /\.ya?ml$/u.test(file))
      .sort();
  } catch {
    return issues;
  }

  for (const file of files) {
    const absolute = path.join(workflowsRoot, file);
    const relative = path.relative(root, absolute);
    const lines = (await readFile(absolute, "utf8")).split(/\r?\n/u);
    const onIndex = lines.findIndex((line) => /^on:\s*$/u.test(line));
    if (onIndex < 0) {
      issues.push({
        severity: "error",
        path: relative,
        message: "workflow must use a block-style on: section containing only workflow_dispatch",
      });
      continue;
    }

    const triggers: string[] = [];
    for (let index = onIndex + 1; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (/^[^\s#]/u.test(line)) break;
      const match = /^\s{2}([A-Za-z_][A-Za-z0-9_-]*):/u.exec(line);
      if (match) triggers.push(match[1]!);
    }

    if (triggers.length !== 1 || triggers[0] !== "workflow_dispatch") {
      issues.push({
        severity: "error",
        path: relative,
        message: `automatic workflow triggers are paused; expected only workflow_dispatch, found ${triggers.length > 0 ? triggers.join(", ") : "none"}`,
      });
    }
  }

  return issues;
}

export function formatWorkflowTriggerIssues(
  issues: readonly WorkflowTriggerIssue[],
): string {
  return issues.map((issue) => `ERROR ${issue.path}: ${issue.message}`).join("\n");
}
