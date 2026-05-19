import { describe, expect, test } from "bun:test";
import { buildPayload, LEARNING_CONTEXT } from "../src/sessionStart.ts";

describe("learning output style", () => {
  test("payload is valid JSON with SessionStart hookEventName", () => {
    const parsed = JSON.parse(buildPayload()) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput?.additionalContext).toBe(LEARNING_CONTEXT);
  });

  test("context bounds user contribution size", () => {
    expect(LEARNING_CONTEXT).toMatch(/5-10 lines/);
  });

  test("context includes both learning and insight framing", () => {
    expect(LEARNING_CONTEXT).toContain("Learning Mode Philosophy");
    expect(LEARNING_CONTEXT).toContain("Insight");
  });

  test("context does not instruct the agent to write user files unprompted", () => {
    expect(LEARNING_CONTEXT).not.toMatch(/\bautomatically (write|edit) /i);
  });
});
