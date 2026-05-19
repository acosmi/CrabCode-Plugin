import { describe, expect, test } from "bun:test";
import { evaluateRules } from "../src/ruleEngine.ts";
import type { Rule } from "../src/types.ts";

function rule(over: Partial<Rule>): Rule {
  return {
    name: "test",
    enabled: true,
    event: "bash",
    pattern: null,
    conditions: [],
    action: "warn",
    toolMatcher: null,
    message: "msg",
    ...over,
  };
}

describe("evaluateRules", () => {
  test("returns empty when no rules match", () => {
    const result = evaluateRules(
      [rule({ conditions: [{ field: "command", operator: "regex_match", pattern: "deploy" }] })],
      { tool_name: "Bash", tool_input: { command: "ls -la" }, hook_event_name: "PreToolUse" },
    );
    expect(result).toEqual({});
  });

  test("regex match against bash command", () => {
    const result = evaluateRules(
      [rule({ conditions: [{ field: "command", operator: "regex_match", pattern: "rm\\s+-rf" }] })],
      { tool_name: "Bash", tool_input: { command: "rm -rf /tmp" }, hook_event_name: "PreToolUse" },
    );
    expect(result).toEqual({
      systemMessage: "**[test]**\nmsg",
    });
  });

  test("blocking rule on PreToolUse emits permissionDecision deny", () => {
    const result = evaluateRules(
      [
        rule({
          name: "block-rm",
          action: "block",
          conditions: [{ field: "command", operator: "regex_match", pattern: "rm" }],
        }),
      ],
      { tool_name: "Bash", tool_input: { command: "rm foo" }, hook_event_name: "PreToolUse" },
    ) as { hookSpecificOutput?: { permissionDecision?: string }; systemMessage?: string };
    expect(result.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(result.systemMessage).toContain("block-rm");
  });

  test("blocking rule on Stop emits decision=block", () => {
    const result = evaluateRules(
      [
        rule({
          name: "stop-blocker",
          event: "stop",
          action: "block",
          conditions: [{ field: "reason", operator: "contains", pattern: "abort" }],
        }),
      ],
      { reason: "abort now", hook_event_name: "Stop" },
    ) as { decision?: string; reason?: string };
    expect(result.decision).toBe("block");
    expect(result.reason).toContain("stop-blocker");
  });

  test("file event matches new_string content", () => {
    const result = evaluateRules(
      [
        rule({
          event: "file",
          conditions: [{ field: "new_text", operator: "regex_match", pattern: "console\\.log\\(" }],
        }),
      ],
      {
        tool_name: "Edit",
        tool_input: { file_path: "src/a.ts", new_string: "console.log(x)" },
        hook_event_name: "PreToolUse",
      },
    );
    expect((result as { systemMessage?: string }).systemMessage).toContain("test");
  });

  test("tool_matcher restricts which tools can fire", () => {
    const r = rule({
      toolMatcher: "Bash",
      conditions: [{ field: "command", operator: "regex_match", pattern: ".*" }],
    });
    const onBash = evaluateRules([r], {
      tool_name: "Bash",
      tool_input: { command: "ls" },
      hook_event_name: "PreToolUse",
    });
    const onEdit = evaluateRules([r], {
      tool_name: "Edit",
      tool_input: { command: "ls" },
      hook_event_name: "PreToolUse",
    });
    expect((onBash as { systemMessage?: string }).systemMessage).toBeDefined();
    expect(onEdit).toEqual({});
  });

  test("all conditions must match (AND)", () => {
    const r = rule({
      event: "file",
      conditions: [
        { field: "file_path", operator: "regex_match", pattern: "\\.env$" },
        { field: "new_text", operator: "contains", pattern: "API_KEY" },
      ],
    });
    const matches = evaluateRules([r], {
      tool_name: "Write",
      tool_input: { file_path: ".env", new_string: "API_KEY=abc" },
      hook_event_name: "PreToolUse",
    });
    const skipped = evaluateRules([r], {
      tool_name: "Write",
      tool_input: { file_path: ".env", new_string: "DB_HOST=local" },
      hook_event_name: "PreToolUse",
    });
    expect((matches as { systemMessage?: string }).systemMessage).toBeDefined();
    expect(skipped).toEqual({});
  });

  test("invalid regex never matches and never throws", () => {
    const result = evaluateRules(
      [rule({ conditions: [{ field: "command", operator: "regex_match", pattern: "(" }] })],
      { tool_name: "Bash", tool_input: { command: "anything" }, hook_event_name: "PreToolUse" },
    );
    expect(result).toEqual({});
  });
});
