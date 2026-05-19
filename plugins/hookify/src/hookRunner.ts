import { loadRules } from "./configLoader.ts";
import { evaluateRules } from "./ruleEngine.ts";
import type { HookInput } from "./types.ts";

export type HookEventName = "PreToolUse" | "PostToolUse" | "Stop" | "UserPromptSubmit";

export function deriveEventFilter(hookEvent: HookEventName, toolName: string): string | null {
  if (hookEvent === "Stop") return "stop";
  if (hookEvent === "UserPromptSubmit") return "prompt";
  if (hookEvent === "PreToolUse" || hookEvent === "PostToolUse") {
    if (toolName === "Bash") return "bash";
    if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") return "file";
    return null;
  }
  return null;
}

export function runHookEvaluation(
  hookEvent: HookEventName,
  input: HookInput,
  cwd: string,
): Record<string, unknown> {
  const toolName = String(input.tool_name ?? "");
  const filter = deriveEventFilter(hookEvent, toolName);
  const rules = loadRules(cwd, filter);
  return evaluateRules(rules, { ...input, hook_event_name: hookEvent });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function runHookCli(hookEvent: HookEventName): Promise<void> {
  let raw = "";
  try {
    raw = await readStdin();
  } catch {
    process.stdout.write("{}\n");
    process.exit(0);
  }
  let input: HookInput = {};
  try {
    input = raw.trim() ? (JSON.parse(raw) as HookInput) : {};
  } catch (err) {
    const message = `Hookify error: failed to parse stdin (${err instanceof Error ? err.message : String(err)})`;
    process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
    process.exit(0);
  }
  try {
    const result = runHookEvaluation(hookEvent, input, process.cwd());
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(0);
  } catch (err) {
    const message = `Hookify error: ${err instanceof Error ? err.message : String(err)}`;
    process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
    process.exit(0);
  }
}
