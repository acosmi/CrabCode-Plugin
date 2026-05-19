import path from "node:path";

export const STATE_FILE_PATH = ".crabcode/ralph-loop.local.md";

export const DEFAULT_MAX_ITERATIONS = 5;
export const HARD_MAX_ITERATIONS = 200;

export type RalphState = {
  iteration: number;
  maxIterations: number;
  completionPromise: string | null;
  sessionId: string | null;
  prompt: string;
  startedAt: string | null;
};

export type ParseResult =
  | { ok: true; state: RalphState }
  | { ok: false; reason: string };

export function parseStateFile(content: string): ParseResult {
  if (!content.startsWith("---")) {
    return { ok: false, reason: "state file missing YAML frontmatter" };
  }
  const closing = content.indexOf("\n---", 3);
  if (closing < 0) {
    return { ok: false, reason: "state file frontmatter is not terminated" };
  }
  const frontmatter = content.slice(3, closing).trim();
  const promptText = content.slice(closing + 4).trim();
  if (!promptText) {
    return { ok: false, reason: "state file has no prompt body" };
  }

  const fields: Record<string, string> = {};
  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    fields[key] = stripWrappingQuotes(rawValue);
  }

  const iteration = Number.parseInt(fields.iteration ?? "", 10);
  if (!Number.isFinite(iteration) || iteration < 0) {
    return { ok: false, reason: "iteration field is not a non-negative integer" };
  }
  const maxIterations = Number.parseInt(fields.max_iterations ?? "", 10);
  if (!Number.isFinite(maxIterations) || maxIterations < 0) {
    return { ok: false, reason: "max_iterations field is not a non-negative integer" };
  }

  const rawCompletion = fields.completion_promise ?? "null";
  const completionPromise = rawCompletion === "null" || rawCompletion === "" ? null : rawCompletion;
  const sessionId = fields.session_id && fields.session_id !== "null" ? fields.session_id : null;

  return {
    ok: true,
    state: {
      iteration,
      maxIterations,
      completionPromise,
      sessionId,
      prompt: promptText,
      startedAt: fields.started_at ?? null,
    },
  };
}

export function renderStateFile(state: Omit<RalphState, "startedAt"> & { startedAt: string }): string {
  const completion =
    state.completionPromise === null || state.completionPromise === ""
      ? "null"
      : JSON.stringify(state.completionPromise);
  const session = state.sessionId ? JSON.stringify(state.sessionId) : "null";
  const fm = [
    "---",
    "active: true",
    `iteration: ${state.iteration}`,
    `session_id: ${session}`,
    `max_iterations: ${state.maxIterations}`,
    `completion_promise: ${completion}`,
    `started_at: ${JSON.stringify(state.startedAt)}`,
    "---",
    "",
    state.prompt.trim(),
    "",
  ].join("\n");
  return fm;
}

export function stateFileAbsPath(cwd: string): string {
  return path.join(cwd, STATE_FILE_PATH);
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
