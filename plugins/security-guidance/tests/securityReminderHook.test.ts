import { describe, expect, test } from "bun:test";
import { checkPatterns, extractContent, runHook } from "../src/securityReminderHook.ts";

describe("checkPatterns", () => {
  test("flags GitHub Actions workflow files", () => {
    const match = checkPatterns(".github/workflows/ci.yml", "name: ci");
    expect(match?.ruleName).toBe("github_actions_workflow");
  });

  test("flags eval usage in content", () => {
    const match = checkPatterns("src/app.ts", "const x = eval(userInput)");
    expect(match?.ruleName).toBe("eval_injection");
  });

  test("flags innerHTML assignment", () => {
    const match = checkPatterns("src/dom.ts", "node.innerHTML = userHtml");
    expect(match?.ruleName).toBe("innerHTML_xss");
  });

  test("does not flag innocuous content", () => {
    expect(checkPatterns("src/util.ts", "return 1 + 2")).toBeNull();
  });

  test("ignores leading slashes when path matching", () => {
    const match = checkPatterns("/repo/.github/workflows/build.yaml", "name: build");
    expect(match?.ruleName).toBe("github_actions_workflow");
  });
});

describe("extractContent", () => {
  test("extracts Write content", () => {
    expect(extractContent("Write", { content: "hello" })).toBe("hello");
  });
  test("extracts Edit new_string", () => {
    expect(extractContent("Edit", { new_string: "x = 1" })).toBe("x = 1");
  });
  test("joins MultiEdit new_strings", () => {
    expect(
      extractContent("MultiEdit", {
        edits: [{ new_string: "a" }, { new_string: "b" }],
      }),
    ).toBe("a b");
  });
  test("returns empty for unsupported tool", () => {
    expect(extractContent("Bash", { command: "ls" })).toBe("");
  });
});

describe("runHook", () => {
  test("allows when tool is not file write", async () => {
    const result = await runHook({ tool_name: "Bash", tool_input: { command: "ls" } });
    expect(result.exitCode).toBe(0);
  });

  test("allows when no file_path", async () => {
    const result = await runHook({ tool_name: "Write", tool_input: { content: "eval(x)" } });
    expect(result.exitCode).toBe(0);
  });

  test("disabled when ENABLE_SECURITY_REMINDER=0", async () => {
    const prev = process.env.ENABLE_SECURITY_REMINDER;
    process.env.ENABLE_SECURITY_REMINDER = "0";
    try {
      const result = await runHook({
        tool_name: "Write",
        tool_input: { file_path: "x.js", content: "eval(x)" },
        session_id: "test-disabled",
      });
      expect(result.exitCode).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.ENABLE_SECURITY_REMINDER;
      else process.env.ENABLE_SECURITY_REMINDER = prev;
    }
  });

  test("blocks with exit code 2 the first time a pattern is hit in a session", async () => {
    const sessionId = `unit-${Date.now()}-${Math.random()}`;
    const result = await runHook({
      tool_name: "Write",
      tool_input: { file_path: "src/blocked.ts", content: "eval(payload)" },
      session_id: sessionId,
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("eval");
  });

  test("does not re-block the same warning in the same session", async () => {
    const sessionId = `unit-${Date.now()}-${Math.random()}`;
    const input = {
      tool_name: "Write",
      tool_input: { file_path: "src/repeat.ts", content: "eval(payload)" },
      session_id: sessionId,
    };
    const first = await runHook(input);
    const second = await runHook(input);
    expect(first.exitCode).toBe(2);
    expect(second.exitCode).toBe(0);
  });
});
