import { describe, expect, test } from "bun:test";
import { buildPayload, EXPLANATORY_CONTEXT } from "../src/sessionStart.ts";

describe("explanatory output style", () => {
  test("payload is valid JSON with SessionStart hookEventName", () => {
    const parsed = JSON.parse(buildPayload()) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput?.additionalContext).toBe(EXPLANATORY_CONTEXT);
  });

  test("context mentions the insight format", () => {
    expect(EXPLANATORY_CONTEXT).toContain("Insight");
    expect(EXPLANATORY_CONTEXT).toContain("explanatory");
  });

  test("context does not write to user files (no fs verbs)", () => {
    expect(EXPLANATORY_CONTEXT).not.toMatch(/\bwrite to\b/i);
    expect(EXPLANATORY_CONTEXT).not.toMatch(/\bedit the file\b/i);
  });
});
