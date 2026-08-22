import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateManualWorkflowTriggers } from "../../src/policy/workflowTriggerValidator.ts";

async function fixture(workflows: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "workflow-trigger-validator-"));
  const directory = path.join(root, ".github", "workflows");
  await mkdir(directory, { recursive: true });
  await Promise.all(
    Object.entries(workflows).map(([name, source]) =>
      writeFile(path.join(directory, name), source),
    ),
  );
  return root;
}

describe("manual workflow trigger gate", () => {
  test("accepts workflow_dispatch as the sole event", async () => {
    const root = await fixture({
      "ci.yml": "name: CI\n\non:\n  workflow_dispatch: {}\n\njobs: {}\n",
    });
    expect(await validateManualWorkflowTriggers(root)).toEqual([]);
  });

  test("rejects push, pull_request and schedule triggers", async () => {
    const root = await fixture({
      "ci.yml": "name: CI\n\non:\n  workflow_dispatch: {}\n  push:\n  pull_request:\n  schedule:\n    - cron: '0 0 * * *'\n\njobs: {}\n",
    });
    const messages = (await validateManualWorkflowTriggers(root))
      .map((issue) => issue.message)
      .join("\n");
    expect(messages).toContain("expected only workflow_dispatch");
    expect(messages).toContain("push");
    expect(messages).toContain("pull_request");
    expect(messages).toContain("schedule");
  });

  test("rejects inline or missing event declarations", async () => {
    const root = await fixture({
      "inline.yaml": "name: Inline\non: [workflow_dispatch]\njobs: {}\n",
      "missing.yml": "name: Missing\njobs: {}\n",
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(2);
  });
});
