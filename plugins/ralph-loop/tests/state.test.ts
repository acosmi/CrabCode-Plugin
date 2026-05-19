import { describe, expect, test } from "bun:test";
import { parseStateFile, renderStateFile } from "../src/state.ts";

const SAMPLE = `---
active: true
iteration: 2
session_id: "abc"
max_iterations: 5
completion_promise: "DONE"
started_at: "2026-05-19T00:00:00Z"
---

work on the cache layer
`;

describe("parseStateFile", () => {
  test("parses a valid state file", () => {
    const result = parseStateFile(SAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.iteration).toBe(2);
    expect(result.state.maxIterations).toBe(5);
    expect(result.state.completionPromise).toBe("DONE");
    expect(result.state.sessionId).toBe("abc");
    expect(result.state.prompt).toBe("work on the cache layer");
  });

  test("rejects files without frontmatter", () => {
    const result = parseStateFile("no frontmatter here");
    expect(result.ok).toBe(false);
  });

  test("rejects unterminated frontmatter", () => {
    const result = parseStateFile("---\niteration: 1\n");
    expect(result.ok).toBe(false);
  });

  test("rejects non-numeric iteration", () => {
    const result = parseStateFile(`---\niteration: zz\nmax_iterations: 5\ncompletion_promise: null\n---\n\nprompt\n`);
    expect(result.ok).toBe(false);
  });

  test("treats completion_promise=null as no promise", () => {
    const result = parseStateFile(`---\niteration: 1\nmax_iterations: 3\ncompletion_promise: null\n---\n\nprompt\n`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.completionPromise).toBeNull();
  });
});

describe("renderStateFile", () => {
  test("round-trips with parseStateFile", () => {
    const rendered = renderStateFile({
      iteration: 4,
      maxIterations: 5,
      completionPromise: "TASK COMPLETE",
      sessionId: "session-1",
      prompt: "do thing",
      startedAt: "2026-05-19T01:00:00Z",
    });
    const result = parseStateFile(rendered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.iteration).toBe(4);
    expect(result.state.maxIterations).toBe(5);
    expect(result.state.completionPromise).toBe("TASK COMPLETE");
    expect(result.state.sessionId).toBe("session-1");
    expect(result.state.prompt).toBe("do thing");
  });
});
