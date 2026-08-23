import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type WorkflowTriggerIssue = {
  severity: "error";
  path: string;
  message: string;
};

const canonicalManualEvent = ["  workflow_dispatch: {}"] as const;

// Publication must receive commit-bound CI evidence. This is the sole approved
// exception to the empty dispatch mapping, and its complete shape is pinned so
// adding any third input or nested YAML field fails closed.
const canonicalPublishEvent = [
  "  workflow_dispatch:",
  "    inputs:",
  "      ci_run_id:",
  "        description: Successful manually dispatched ci.yml run ID for this exact main commit",
  "        required: true",
  "        type: string",
  "      expected_sha:",
  "        description: Full lowercase main commit SHA expected to be published",
  "        required: true",
  "        type: string",
] as const;

/**
 * Enforce the repository-wide pause on automatic GitHub Actions execution.
 *
 * `workflow_dispatch` can be invoked manually in the GitHub UI or through the
 * REST API. No push, pull_request, schedule, repository_dispatch, or other
 * event is accepted while the pause is active. This deliberately validates a
 * small canonical YAML surface instead of attempting to partially parse YAML:
 * quoted keys, anchors/aliases, merge keys and the alternate `.yaml` suffix
 * are rejected. That makes syntactic disguises fail closed.
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

    if (file.endsWith(".yaml")) {
      issues.push({
        severity: "error",
        path: relative,
        message: "workflow files must use the canonical .yml suffix; .yaml is rejected",
      });
      continue;
    }

    const source = await readFile(absolute, "utf8");
    const lines = source.replace(/\r\n?/gu, "\n").split("\n");
    const hasTopLevelYamlIndirection = lines.some(
      (line) =>
        // The canonical surface uses only plain top-level mapping keys. Reject
        // every quoted/escaped, explicit, tagged, anchored, aliased, flow, or
        // multi-document spelling rather than trying to decode whether it is an
        // obfuscated `on` key (for example `"o\\u006e"`).
        /^(?:["']|\?|:|%|!|&|\*|\{|\[|<<\s*:|---(?:\s|$)|\.\.\.(?:\s|$))/u.test(line) ||
        /^[A-Za-z_][A-Za-z0-9_-]*:\s*&[A-Za-z0-9_-]+(?:\s|$)/u.test(line),
    );
    if (hasTopLevelYamlIndirection) {
      issues.push({
        severity: "error",
        path: relative,
        message:
          "top-level quoted/escaped, explicit, tagged, anchored, aliased, flow, merge, and multi-document YAML forms are rejected",
      });
      continue;
    }
    const onIndexes = lines.flatMap((line, index) => (line === "on:" ? [index] : []));
    if (onIndexes.length !== 1) {
      issues.push({
        severity: "error",
        path: relative,
        message:
          "workflow must contain exactly one canonical top-level on: block",
      });
      continue;
    }

    const onIndex = onIndexes[0]!;
    const block: string[] = [];
    for (let index = onIndex + 1; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (line.length > 0 && !/^[ \t#]/u.test(line)) break;
      block.push(line);
    }

    const meaningful = block.filter(
      (line) => line.trim().length > 0 && !line.trimStart().startsWith("#"),
    );
    const expected =
      file === "publish-safe-to-cn-mirror.yml"
        ? canonicalPublishEvent
        : canonicalManualEvent;
    const isCanonical =
      meaningful.length === expected.length &&
      meaningful.every((line, index) => line === expected[index]);

    if (!isCanonical) {
      issues.push({
        severity: "error",
        path: relative,
        message: `automatic workflow triggers are paused; expected only workflow_dispatch in a canonical on: block with no quoted keys, anchors, aliases, or merge keys; found ${meaningful.join(" | ") || "none"}`,
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
