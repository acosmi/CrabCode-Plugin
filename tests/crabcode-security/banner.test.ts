import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PLUGIN_ROOT, requireSuccess, run } from "./test-helpers.ts";

const hook = path.join(PLUGIN_ROOT, "hooks", "banner_hook.sh");

function submit(payload: unknown): ReturnType<typeof run> {
  return run("sh", [hook], {
    env: { ...process.env, CRABCODE_PLUGIN_ROOT: PLUGIN_ROOT },
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

describe("CrabCode Security UserPromptSubmit banner", () => {
  test.each([
    "/crabcode-security",
    "  /crabcode-security high  ",
    "/crabcode-security:crabcode-security",
    "crabcode-security:crabcode-security --effort max",
  ])("emits exactly one display-only system message for %s", (prompt) => {
    const result = submit({ prompt });
    requireSuccess(result, `banner hook for ${prompt}`);
    const output = JSON.parse(result.stdout);
    expect(Object.keys(output)).toEqual(["systemMessage"]);
    expect(output.systemMessage).toContain("Launching CrabCode Security");
    expect(output.systemMessage).toContain("C R A B C O D E");
    expect(output.systemMessage).toMatch(/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
    expect(result.stderr).toBe("");
  });

  test.each([
    { prompt: "/crabcode-security-review" },
    { prompt: "/crabcode-securityx" },
    { prompt: "please /crabcode-security" },
    { prompt: "" },
    { prompt: 42 },
    {},
    "not-json",
  ])("is silent and successful for non-target payload %#", (payload) => {
    const result = submit(payload);
    requireSuccess(result, "non-target banner hook");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test("fails open without emitting a global warning when python3 is unavailable", () => {
    const result = run("/bin/sh", [hook], {
      env: {
        ...process.env,
        CRABCODE_PLUGIN_ROOT: PLUGIN_ROOT,
        PATH: "/definitely-not-a-real-command-path",
      },
      input: JSON.stringify({ prompt: "/crabcode-security" }),
    });
    requireSuccess(result, "banner hook without python3");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test.each([
    ["/crabcode-security", true],
    ["/crabcode-security-review", false],
  ])(
    "checks the target command before reporting an old Python runtime for %s",
    (prompt, shouldWarn) => {
      const runner = [
        "import importlib.util, io, sys",
        "spec = importlib.util.spec_from_file_location('banner_notice_test', sys.argv[1])",
        "module = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(module)",
        "module.sys.version_info = (3, 8, 18)",
        `module.sys.stdin = io.StringIO(${JSON.stringify(JSON.stringify({ prompt }))})`,
        "raise SystemExit(module.main())",
      ].join("\n");
      const result = run("python3", [
        "-c",
        runner,
        path.join(PLUGIN_ROOT, "hooks", "banner_notice.py"),
      ]);
      requireSuccess(result, `old-Python banner branch for ${prompt}`);
      if (shouldWarn) {
        const output = JSON.parse(result.stdout);
        expect(output.systemMessage).toContain("needs python3 3.9 or newer");
        expect(output.systemMessage).toContain("python3 is 3.8.18");
      } else {
        expect(result.stdout).toBe("");
      }
      expect(result.stderr).toBe("");
    },
  );

  test("registers only a non-blocking UserPromptSubmit command hook", async () => {
    const hooks = JSON.parse(
      await readFile(path.join(PLUGIN_ROOT, "hooks", "hooks.json"), "utf8"),
    );
    expect(Object.keys(hooks.hooks)).toEqual(["UserPromptSubmit"]);
    expect(hooks.hooks.UserPromptSubmit).toHaveLength(1);
    expect(hooks.hooks.UserPromptSubmit[0].matcher).toBeUndefined();
    expect(hooks.hooks.UserPromptSubmit[0].hooks).toEqual([
      {
        type: "command",
        command: 'sh "${CRABCODE_PLUGIN_ROOT}/hooks/banner_hook.sh"',
      },
    ]);
    expect(JSON.stringify(hooks)).not.toContain("permissionDecision");
  });
});
