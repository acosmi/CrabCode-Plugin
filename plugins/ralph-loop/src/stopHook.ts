#!/usr/bin/env -S bun
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  HARD_MAX_ITERATIONS,
  parseStateFile,
  renderStateFile,
  stateFileAbsPath,
  type RalphState,
} from "./state.ts";

type HookInput = {
  session_id?: string;
  transcript_path?: string;
};

export type StopDecision =
  | { kind: "exit"; reason: string }
  | { kind: "remove-state"; reason: string }
  | {
      kind: "continue";
      nextIteration: number;
      prompt: string;
      systemMessage: string;
    };

export function extractLastAssistantText(jsonlContent: string): string {
  const lines = jsonlContent.split("\n").filter(Boolean);
  let latest = "";
  const start = Math.max(0, lines.length - 100);
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.includes('"role":"assistant"')) continue;
    try {
      const parsed = JSON.parse(line) as {
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      const content = parsed.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block && block.type === "text" && typeof block.text === "string") {
          latest = block.text;
        }
      }
    } catch {
      // ignore malformed lines
    }
  }
  return latest;
}

export function extractPromiseFromText(text: string): string {
  const match = text.match(/<promise>([\s\S]*?)<\/promise>/);
  if (!match || match[1] === undefined) return "";
  return match[1].trim().replace(/\s+/g, " ");
}

export function decideStop(
  state: RalphState,
  hookSessionId: string | null,
  lastAssistantText: string,
): StopDecision {
  if (state.sessionId && hookSessionId && state.sessionId !== hookSessionId) {
    return { kind: "exit", reason: "Different session owns this loop. Allowing stop." };
  }

  const cap = Math.min(state.maxIterations, HARD_MAX_ITERATIONS);
  if (cap > 0 && state.iteration >= cap) {
    return {
      kind: "remove-state",
      reason: `Ralph loop: max iterations (${cap}) reached. Loop is stopping.`,
    };
  }

  if (state.completionPromise && state.completionPromise.trim() !== "") {
    const promiseText = extractPromiseFromText(lastAssistantText);
    if (promiseText && promiseText === state.completionPromise) {
      return {
        kind: "remove-state",
        reason: `Ralph loop: detected <promise>${state.completionPromise}</promise>. Loop completed.`,
      };
    }
  }

  const nextIteration = state.iteration + 1;
  const msg = state.completionPromise
    ? `Ralph iteration ${nextIteration} of ${cap}. To stop early, output <promise>${state.completionPromise}</promise> ONLY when the statement is genuinely TRUE.`
    : `Ralph iteration ${nextIteration} of ${cap}.`;
  return {
    kind: "continue",
    nextIteration,
    prompt: state.prompt,
    systemMessage: msg,
  };
}

export type RunStopHookResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

export function runStopHook(
  input: HookInput,
  options: {
    cwd: string;
    readTranscript?: (file: string) => string;
    readState?: (file: string) => string;
    writeState?: (file: string, content: string) => void;
    removeState?: (file: string) => void;
  },
): RunStopHookResult {
  const stateFile = stateFileAbsPath(options.cwd);
  const exists = options.readState
    ? true
    : existsSync(stateFile);
  if (!exists) {
    return { exitCode: 0 };
  }

  let stateContent: string;
  try {
    stateContent = options.readState
      ? options.readState(stateFile)
      : readFileSync(stateFile, "utf8");
  } catch (err) {
    return {
      exitCode: 0,
      stderr: `Ralph loop: cannot read state file: ${err instanceof Error ? err.message : String(err)}.`,
    };
  }

  const parsed = parseStateFile(stateContent);
  if (!parsed.ok) {
    removeState(stateFile, options);
    return {
      exitCode: 0,
      stderr: `Ralph loop: state file corrupted (${parsed.reason}). Removing state file; rerun /ralph-loop to start fresh.`,
    };
  }

  const hookSessionId = typeof input.session_id === "string" ? input.session_id : null;
  let lastAssistantText = "";
  const transcript = input.transcript_path;
  if (transcript) {
    try {
      const content = options.readTranscript
        ? options.readTranscript(transcript)
        : readFileSync(transcript, "utf8");
      lastAssistantText = extractLastAssistantText(content);
    } catch {
      lastAssistantText = "";
    }
  }

  const decision = decideStop(parsed.state, hookSessionId, lastAssistantText);
  if (decision.kind === "exit") {
    return { exitCode: 0, stderr: decision.reason };
  }
  if (decision.kind === "remove-state") {
    removeState(stateFile, options);
    return { exitCode: 0, stdout: decision.reason };
  }

  const nextState = {
    ...parsed.state,
    iteration: decision.nextIteration,
    startedAt: parsed.state.startedAt ?? new Date().toISOString(),
  };
  const nextContent = renderStateFile({
    iteration: nextState.iteration,
    maxIterations: nextState.maxIterations,
    completionPromise: nextState.completionPromise,
    sessionId: nextState.sessionId,
    prompt: nextState.prompt,
    startedAt: nextState.startedAt,
  });
  try {
    if (options.writeState) options.writeState(stateFile, nextContent);
    else writeFileSync(stateFile, nextContent, "utf8");
  } catch (err) {
    return {
      exitCode: 0,
      stderr: `Ralph loop: failed to update iteration counter: ${err instanceof Error ? err.message : String(err)}. Removing state file.`,
    };
  }

  const payload = JSON.stringify({
    decision: "block",
    reason: decision.prompt,
    systemMessage: decision.systemMessage,
  });
  return { exitCode: 0, stdout: payload };
}

function removeState(file: string, options: { removeState?: (file: string) => void }): void {
  try {
    if (options.removeState) options.removeState(file);
    else if (existsSync(file)) unlinkSync(file);
  } catch {
    // best effort
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

if (import.meta.main) {
  const raw = await readStdin().catch(() => "");
  let parsed: HookInput = {};
  try {
    parsed = raw.trim() ? (JSON.parse(raw) as HookInput) : {};
  } catch {
    process.exit(0);
  }
  const result = runStopHook(parsed, { cwd: process.cwd() });
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  // Ensure path import is used at runtime build (no-op otherwise).
  void path;
  process.exit(result.exitCode);
}
