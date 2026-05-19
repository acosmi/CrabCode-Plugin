#!/usr/bin/env -S bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_MAX_ITERATIONS,
  HARD_MAX_ITERATIONS,
  STATE_FILE_PATH,
  renderStateFile,
} from "./state.ts";

export type ParsedArgs =
  | {
      ok: true;
      prompt: string;
      maxIterations: number;
      completionPromise: string | null;
      yes: boolean;
    }
  | { ok: false; helpRequested?: boolean; message: string };

const HELP_TEXT = [
  "Ralph Loop - iterative self-referential development loop (CrabCode port)",
  "",
  "USAGE",
  "  /ralph-loop PROMPT [--max-iterations N] [--completion-promise TEXT] [--yes]",
  "",
  "ARGUMENTS",
  "  PROMPT                       Initial prompt that will be re-fed on each iteration.",
  "                               Combine multiple words by quoting or pass them positionally.",
  "",
  "OPTIONS",
  `  --max-iterations N           Hard cap on iterations (default ${DEFAULT_MAX_ITERATIONS}, max ${HARD_MAX_ITERATIONS}).`,
  "                               This loop never runs unbounded; 0 is rejected.",
  "  --completion-promise TEXT    Phrase that the agent must wrap in <promise>...</promise>",
  "                               to exit early.",
  "  --yes                        Confirm that you understand the loop will run up to",
  "                               --max-iterations times. Required when no completion promise",
  "                               is set.",
  "  -h, --help                   Show this help.",
  "",
  "STATE",
  `  Loop state is persisted to ./${STATE_FILE_PATH} in the current working directory.`,
  "  Cancel any time with /cancel-ralph (deletes the state file).",
].join("\n");

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  let maxIterations: number | null = null;
  let completionPromise: string | null = null;
  let yes = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      return { ok: false, helpRequested: true, message: HELP_TEXT };
    }
    if (arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--max-iterations") {
      const next = argv[i + 1];
      if (next === undefined) return { ok: false, message: "--max-iterations needs a positive integer." };
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return { ok: false, message: `--max-iterations must be >= 1, got "${next}".` };
      }
      if (parsed > HARD_MAX_ITERATIONS) {
        return {
          ok: false,
          message: `--max-iterations cannot exceed ${HARD_MAX_ITERATIONS}.`,
        };
      }
      maxIterations = parsed;
      i++;
      continue;
    }
    if (arg === "--completion-promise") {
      const next = argv[i + 1];
      if (next === undefined || next === "") {
        return { ok: false, message: "--completion-promise needs a non-empty text argument." };
      }
      completionPromise = next;
      i++;
      continue;
    }
    if (arg !== undefined) {
      positional.push(arg);
    }
  }

  const prompt = positional.join(" ").trim();
  if (!prompt) {
    return { ok: false, message: "No prompt provided. See --help for usage." };
  }

  const effectiveMax = maxIterations ?? DEFAULT_MAX_ITERATIONS;
  if (!completionPromise && !yes) {
    return {
      ok: false,
      message: [
        "Refusing to start a loop with no completion promise unless you pass --yes.",
        `The loop will run up to ${effectiveMax} iterations (default cap is ${DEFAULT_MAX_ITERATIONS}).`,
        "Either set --completion-promise '<phrase>' or rerun with --yes.",
      ].join("\n"),
    };
  }

  return {
    ok: true,
    prompt,
    maxIterations: effectiveMax,
    completionPromise,
    yes,
  };
}

export type SetupResult = {
  exitCode: number;
  stderr?: string;
  stdout?: string;
  stateAbsPath?: string;
};

export function setupRalphLoop(
  argv: string[],
  options: {
    cwd: string;
    sessionId?: string | null;
    now?: () => Date;
    write?: (file: string, content: string) => void;
  },
): SetupResult {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    if (parsed.helpRequested) {
      return { exitCode: 0, stdout: parsed.message };
    }
    return { exitCode: 1, stderr: parsed.message };
  }

  const startedAt = (options.now ?? (() => new Date()))().toISOString();
  const sessionId = options.sessionId ?? null;
  const content = renderStateFile({
    iteration: 1,
    maxIterations: parsed.maxIterations,
    completionPromise: parsed.completionPromise,
    sessionId,
    prompt: parsed.prompt,
    startedAt,
  });

  const absPath = path.join(options.cwd, STATE_FILE_PATH);
  if (options.write) {
    options.write(absPath, content);
  } else {
    const dir = path.dirname(absPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, content, "utf8");
  }

  const summaryLines = [
    "Ralph loop activated in this session.",
    `Iteration: 1 of ${parsed.maxIterations}`,
    parsed.completionPromise
      ? `Completion promise: <promise>${parsed.completionPromise}</promise> (output it only when the statement is TRUE)`
      : "Completion promise: none (capped purely by --max-iterations)",
    `State file: ${absPath}`,
    "",
    "Prompt that will be re-fed on each Stop:",
    parsed.prompt,
  ];
  return { exitCode: 0, stdout: summaryLines.join("\n"), stateAbsPath: absPath };
}

if (import.meta.main) {
  const sessionId = process.env.CRABCODE_SESSION_ID || null;
  const result = setupRalphLoop(process.argv.slice(2), {
    cwd: process.cwd(),
    sessionId,
  });
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}
