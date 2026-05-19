import { existsSync, readFileSync } from "node:fs";
import type { Condition, EvaluationResult, HookInput, Rule, ToolInput } from "./types.ts";

const regexCache = new Map<string, RegExp | null>();

function compileRegex(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern) ?? null;
  try {
    const compiled = new RegExp(pattern, "i");
    if (regexCache.size > 128) regexCache.clear();
    regexCache.set(pattern, compiled);
    return compiled;
  } catch {
    regexCache.set(pattern, null);
    return null;
  }
}

function matchesTool(matcher: string, toolName: string): boolean {
  if (matcher === "*") return true;
  return matcher.split("|").map((s) => s.trim()).includes(toolName);
}

function extractField(
  field: string,
  toolName: string,
  toolInput: ToolInput,
  input: HookInput,
): string | null {
  if (field in toolInput) {
    const value = toolInput[field];
    return typeof value === "string" ? value : String(value);
  }
  if (field === "reason") return String(input.reason ?? "");
  if (field === "transcript") {
    const tp = input.transcript_path;
    if (!tp || !existsSync(tp)) return "";
    try {
      return readFileSync(tp, "utf8");
    } catch {
      return "";
    }
  }
  if (field === "user_prompt") return String(input.user_prompt ?? "");

  if (toolName === "Bash" && field === "command") {
    return String(toolInput.command ?? "");
  }

  if (toolName === "Write" || toolName === "Edit") {
    if (field === "content") {
      const c = toolInput.content ?? toolInput.new_string;
      return typeof c === "string" ? c : "";
    }
    if (field === "new_text" || field === "new_string") {
      return String(toolInput.new_string ?? "");
    }
    if (field === "old_text" || field === "old_string") {
      return String(toolInput.old_string ?? "");
    }
    if (field === "file_path") {
      return String(toolInput.file_path ?? "");
    }
  }

  if (toolName === "MultiEdit") {
    if (field === "file_path") {
      return String(toolInput.file_path ?? "");
    }
    if (field === "new_text" || field === "content") {
      const edits = toolInput.edits;
      if (Array.isArray(edits)) {
        return edits
          .map((e) => (e && typeof e === "object" ? String((e as Record<string, unknown>).new_string ?? "") : ""))
          .join(" ");
      }
      return "";
    }
  }

  return null;
}

function checkCondition(
  condition: Condition,
  toolName: string,
  toolInput: ToolInput,
  input: HookInput,
): boolean {
  const value = extractField(condition.field, toolName, toolInput, input);
  if (value === null) return false;
  switch (condition.operator) {
    case "regex_match": {
      const re = compileRegex(condition.pattern);
      return re ? re.test(value) : false;
    }
    case "contains":
      return value.includes(condition.pattern);
    case "equals":
      return value === condition.pattern;
    case "not_contains":
      return !value.includes(condition.pattern);
    case "starts_with":
      return value.startsWith(condition.pattern);
    case "ends_with":
      return value.endsWith(condition.pattern);
    default:
      return false;
  }
}

function ruleMatches(rule: Rule, input: HookInput): boolean {
  const toolName = String(input.tool_name ?? "");
  const toolInput = (input.tool_input ?? {}) as ToolInput;

  if (rule.toolMatcher) {
    if (!matchesTool(rule.toolMatcher, toolName)) return false;
  }
  if (rule.conditions.length === 0) return false;
  for (const condition of rule.conditions) {
    if (!checkCondition(condition, toolName, toolInput, input)) return false;
  }
  return true;
}

export function evaluateRules(rules: Rule[], input: HookInput): EvaluationResult {
  const event = String(input.hook_event_name ?? "");
  const blocking: Rule[] = [];
  const warning: Rule[] = [];

  for (const rule of rules) {
    if (!ruleMatches(rule, input)) continue;
    if (rule.action === "block") blocking.push(rule);
    else warning.push(rule);
  }

  if (blocking.length > 0) {
    const message = blocking.map((r) => `**[${r.name}]**\n${r.message}`).join("\n\n");
    if (event === "Stop") {
      return { decision: "block", reason: message, systemMessage: message };
    }
    if (event === "PreToolUse" || event === "PostToolUse") {
      return {
        hookSpecificOutput: { hookEventName: event, permissionDecision: "deny" },
        systemMessage: message,
      };
    }
    return { systemMessage: message };
  }

  if (warning.length > 0) {
    const message = warning.map((r) => `**[${r.name}]**\n${r.message}`).join("\n\n");
    return { systemMessage: message };
  }

  return {};
}
