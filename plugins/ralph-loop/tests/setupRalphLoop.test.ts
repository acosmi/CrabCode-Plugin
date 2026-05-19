import { describe, expect, test } from "bun:test";
import { parseStateFile } from "../src/state.ts";
import { parseArgs, setupRalphLoop } from "../src/setupRalphLoop.ts";

describe("parseArgs", () => {
  test("rejects missing prompt", () => {
    const result = parseArgs(["--max-iterations", "3"]);
    expect(result.ok).toBe(false);
  });

  test("rejects --max-iterations 0", () => {
    const result = parseArgs(["task", "--max-iterations", "0"]);
    expect(result.ok).toBe(false);
  });

  test("rejects --max-iterations exceeding hard cap", () => {
    const result = parseArgs(["task", "--max-iterations", "9999"]);
    expect(result.ok).toBe(false);
  });

  test("requires --yes when no completion promise", () => {
    const result = parseArgs(["fix the cache"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("--yes");
  });

  test("accepts completion promise instead of --yes", () => {
    const result = parseArgs(["fix the cache", "--completion-promise", "DONE"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.completionPromise).toBe("DONE");
    expect(result.maxIterations).toBe(5); // default
  });

  test("accepts --yes without completion promise", () => {
    const result = parseArgs(["fix the cache", "--yes", "--max-iterations", "8"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.maxIterations).toBe(8);
    expect(result.completionPromise).toBeNull();
  });

  test("returns help text on --help", () => {
    const result = parseArgs(["--help"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.helpRequested).toBe(true);
    expect(result.message).toContain("USAGE");
  });
});

describe("setupRalphLoop", () => {
  test("writes a valid state file", () => {
    const writes: Array<{ file: string; content: string }> = [];
    const result = setupRalphLoop(
      ["fix cache", "--completion-promise", "DONE", "--max-iterations", "4"],
      {
        cwd: "/tmp/fake",
        sessionId: "sess-1",
        now: () => new Date("2026-05-19T00:00:00.000Z"),
        write: (file, content) => writes.push({ file, content }),
      },
    );
    expect(result.exitCode).toBe(0);
    expect(writes.length).toBe(1);
    expect(writes[0]?.file.endsWith("ralph-loop.local.md")).toBe(true);
    const parsed = parseStateFile(writes[0]?.content ?? "");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state.iteration).toBe(1);
    expect(parsed.state.maxIterations).toBe(4);
    expect(parsed.state.completionPromise).toBe("DONE");
    expect(parsed.state.sessionId).toBe("sess-1");
    expect(parsed.state.prompt).toBe("fix cache");
  });

  test("exits non-zero on bad input", () => {
    const result = setupRalphLoop(["fix cache"], { cwd: "/tmp/fake" });
    expect(result.exitCode).toBe(1);
  });
});
