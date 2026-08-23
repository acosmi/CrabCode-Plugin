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
      "publish-safe-to-cn-mirror.yml": [
        "name: Publish",
        "on:",
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
        "jobs: {}",
        "",
      ].join("\n"),
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

  test("rejects quoted automatic events that are valid YAML", async () => {
    const root = await fixture({
      "ci.yml": [
        "name: CI",
        "on:",
        "  workflow_dispatch: {}",
        '  "push": {}',
        "jobs: {}",
        "",
      ].join("\n"),
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(1);
  });

  test("rejects a quoted duplicate on key or top-level YAML merge indirection", async () => {
    const root = await fixture({
      "quoted-on.yml": [
        "name: CI",
        '"on":',
        "  push: {}",
        "on:",
        "  workflow_dispatch: {}",
        "jobs: {}",
        "",
      ].join("\n"),
      "merge-on.yml": [
        "events: &events",
        "  on:",
        "    push: {}",
        "<<: *events",
        "on:",
        "  workflow_dispatch: {}",
        "jobs: {}",
        "",
      ].join("\n"),
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(2);
  });

  test("rejects escaped, explicit, and tagged top-level on-key spellings", async () => {
    const root = await fixture({
      "escaped-on.yml": [
        "name: CI",
        '"o\\u006e":',
        "  push: {}",
        "on:",
        "  workflow_dispatch: {}",
        "jobs: {}",
        "",
      ].join("\n"),
      "explicit-on.yml": [
        "name: CI",
        '? "on"',
        ":",
        "  push: {}",
        "on:",
        "  workflow_dispatch: {}",
        "jobs: {}",
        "",
      ].join("\n"),
      "tagged-on.yml": [
        "name: CI",
        "!!str on:",
        "  push: {}",
        "on:",
        "  workflow_dispatch: {}",
        "jobs: {}",
        "",
      ].join("\n"),
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(3);
  });

  test("rejects YAML anchors, aliases, and merge keys in the event block", async () => {
    const root = await fixture({
      "anchor.yml": "name: Anchor\non:\n  workflow_dispatch: &manual {}\njobs: {}\n",
      "alias.yml": "name: Alias\non:\n  workflow_dispatch: *manual\njobs: {}\n",
      "merge.yml": "name: Merge\non:\n  workflow_dispatch:\n    <<: *manual\njobs: {}\n",
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(3);
  });

  test("rejects the alternate .yaml suffix even when its trigger is manual", async () => {
    const root = await fixture({
      "ci.yaml": "name: CI\n\non:\n  workflow_dispatch: {}\n\njobs: {}\n",
    });
    const issues = await validateManualWorkflowTriggers(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("canonical .yml suffix");
  });

  test("rejects non-canonical indentation and duplicate on blocks", async () => {
    const root = await fixture({
      "indent.yml": "name: CI\non:\n    workflow_dispatch: {}\njobs: {}\n",
      "duplicate.yml": "name: CI\non:\n  workflow_dispatch: {}\non:\n  workflow_dispatch: {}\njobs: {}\n",
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(2);
  });

  test("rejects arbitrary inputs on ordinary workflows", async () => {
    const root = await fixture({
      "ci.yml": [
        "name: CI",
        "on:",
        "  workflow_dispatch:",
        "    inputs:",
        "      arbitrary:",
        "        required: true",
        "        type: string",
        "jobs: {}",
        "",
      ].join("\n"),
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(1);
  });

  test("rejects missing, extra, or weakened publication inputs", async () => {
    const canonical = [
      "name: Publish",
      "on:",
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
      "jobs: {}",
      "",
    ].join("\n");
    const root = await fixture({
      "publish-safe-to-cn-mirror.yml": canonical.replace(
        "        required: true",
        "        required: false",
      ),
    });
    expect(await validateManualWorkflowTriggers(root)).toHaveLength(1);

    const missingRoot = await fixture({
      "publish-safe-to-cn-mirror.yml": canonical.replace(
        "      expected_sha:\n        description: Full lowercase main commit SHA expected to be published\n        required: true\n        type: string\n",
        "",
      ),
    });
    expect(await validateManualWorkflowTriggers(missingRoot)).toHaveLength(1);

    const extraRoot = await fixture({
      "publish-safe-to-cn-mirror.yml": canonical.replace(
        "jobs: {}",
        "      force:\n        required: true\n        type: string\njobs: {}",
      ),
    });
    expect(await validateManualWorkflowTriggers(extraRoot)).toHaveLength(1);
  });
});
