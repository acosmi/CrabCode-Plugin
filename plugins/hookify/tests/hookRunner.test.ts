import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { deriveEventFilter, runHookEvaluation } from "../src/hookRunner.ts";

describe("deriveEventFilter", () => {
  test("Stop -> stop", () => {
    expect(deriveEventFilter("Stop", "")).toBe("stop");
  });
  test("UserPromptSubmit -> prompt", () => {
    expect(deriveEventFilter("UserPromptSubmit", "")).toBe("prompt");
  });
  test("PreToolUse Bash -> bash", () => {
    expect(deriveEventFilter("PreToolUse", "Bash")).toBe("bash");
  });
  test("PreToolUse Edit -> file", () => {
    expect(deriveEventFilter("PreToolUse", "Edit")).toBe("file");
  });
  test("PreToolUse unknown tool -> null", () => {
    expect(deriveEventFilter("PreToolUse", "WhateverTool")).toBeNull();
  });
});

describe("runHookEvaluation with on-disk fixtures", () => {
  test("loads rules from .crabcode and matches Bash command", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "hookify-"));
    try {
      const rulesDir = path.join(dir, ".crabcode");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        path.join(rulesDir, "hookify.rm.local.md"),
        `---\nname: rm-rule\nenabled: true\nevent: bash\npattern: rm\\s+-rf\naction: warn\n---\n\nDangerous rm\n`,
        "utf8",
      );
      const result = runHookEvaluation(
        "PreToolUse",
        { tool_name: "Bash", tool_input: { command: "rm -rf /tmp" } },
        dir,
      ) as { systemMessage?: string };
      expect(result.systemMessage).toContain("rm-rule");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("disabled rules are skipped", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "hookify-"));
    try {
      const rulesDir = path.join(dir, ".crabcode");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        path.join(rulesDir, "hookify.off.local.md"),
        `---\nname: off\nenabled: false\nevent: bash\npattern: rm\n---\n\nignored\n`,
        "utf8",
      );
      const result = runHookEvaluation(
        "PreToolUse",
        { tool_name: "Bash", tool_input: { command: "rm anything" } },
        dir,
      );
      expect(result).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("event filter drops mismatched rules", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "hookify-"));
    try {
      const rulesDir = path.join(dir, ".crabcode");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        path.join(rulesDir, "hookify.file.local.md"),
        `---\nname: file-only\nenabled: true\nevent: file\npattern: console\\.log\n---\n\nedit-only\n`,
        "utf8",
      );
      const result = runHookEvaluation(
        "PreToolUse",
        { tool_name: "Bash", tool_input: { command: "console.log foo" } },
        dir,
      );
      expect(result).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
