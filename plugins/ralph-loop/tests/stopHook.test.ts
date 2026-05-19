import { describe, expect, test } from "bun:test";
import {
  decideStop,
  extractLastAssistantText,
  extractPromiseFromText,
  runStopHook,
} from "../src/stopHook.ts";
import type { RalphState } from "../src/state.ts";
import { renderStateFile } from "../src/state.ts";

function baseState(over: Partial<RalphState> = {}): RalphState {
  return {
    iteration: 1,
    maxIterations: 5,
    completionPromise: null,
    sessionId: null,
    prompt: "do thing",
    startedAt: "2026-05-19T00:00:00Z",
    ...over,
  };
}

describe("extractPromiseFromText", () => {
  test("extracts inner text", () => {
    expect(extractPromiseFromText("text <promise>DONE</promise> tail")).toBe("DONE");
  });
  test("normalizes whitespace", () => {
    expect(extractPromiseFromText("<promise>  TASK  COMPLETE\n</promise>")).toBe("TASK COMPLETE");
  });
  test("returns empty when no tag", () => {
    expect(extractPromiseFromText("no tag here")).toBe("");
  });
});

describe("extractLastAssistantText", () => {
  test("returns the last assistant text block", () => {
    const jsonl = [
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "first" }] } }),
      JSON.stringify({ role: "user", message: { content: [] } }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "tool_use" }] } }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "latest" }] } }),
    ].join("\n");
    expect(extractLastAssistantText(jsonl)).toBe("latest");
  });

  test("returns empty when no assistant lines", () => {
    expect(extractLastAssistantText("")).toBe("");
  });
});

describe("decideStop", () => {
  test("exits when session mismatch", () => {
    const decision = decideStop(baseState({ sessionId: "owner" }), "intruder", "");
    expect(decision.kind).toBe("exit");
  });

  test("removes state when max iterations reached", () => {
    const decision = decideStop(baseState({ iteration: 5, maxIterations: 5 }), null, "");
    expect(decision.kind).toBe("remove-state");
  });

  test("removes state when completion promise matched", () => {
    const decision = decideStop(
      baseState({ completionPromise: "DONE" }),
      null,
      "well <promise>DONE</promise> finally",
    );
    expect(decision.kind).toBe("remove-state");
  });

  test("continues when promise tag missing", () => {
    const decision = decideStop(
      baseState({ completionPromise: "DONE", iteration: 2, maxIterations: 5 }),
      null,
      "no tag",
    );
    expect(decision.kind).toBe("continue");
    if (decision.kind !== "continue") return;
    expect(decision.nextIteration).toBe(3);
    expect(decision.prompt).toBe("do thing");
  });
});

describe("runStopHook", () => {
  test("no-op when state file missing", () => {
    const result = runStopHook(
      {},
      {
        cwd: "/tmp/fake",
        readState: () => {
          throw new Error("should not be called");
        },
      },
    );
    expect(result.exitCode).toBe(0);
  });

  test("re-feeds prompt and bumps iteration", () => {
    const stateFile = renderStateFile({
      iteration: 1,
      maxIterations: 3,
      completionPromise: null,
      sessionId: null,
      prompt: "iterate",
      startedAt: "2026-05-19T00:00:00Z",
    });
    const captured: { content?: string } = {};
    const result = runStopHook(
      { session_id: "sess" },
      {
        cwd: "/tmp/fake",
        readState: () => stateFile,
        writeState: (_file, content) => {
          captured.content = content;
        },
      },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBeDefined();
    const parsed = JSON.parse(result.stdout ?? "{}") as {
      decision?: string;
      reason?: string;
      systemMessage?: string;
    };
    expect(parsed.decision).toBe("block");
    expect(parsed.reason).toBe("iterate");
    expect(parsed.systemMessage).toContain("iteration 2");
    expect(captured.content).toContain("iteration: 2");
  });

  test("corrupted state file is removed and operator informed", () => {
    const captured: { removed?: string } = {};
    const result = runStopHook(
      {},
      {
        cwd: "/tmp/fake",
        readState: () => "garbage",
        removeState: (file) => {
          captured.removed = file;
        },
      },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("corrupted");
    expect(captured.removed).toContain("ralph-loop.local.md");
  });
});
