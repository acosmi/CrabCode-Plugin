import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractFrontmatter } from "./frontmatter.ts";
import type { Condition, Rule } from "./types.ts";

export const RULES_DIR = ".crabcode";
export const RULES_FILE_PREFIX = "hookify.";
export const RULES_FILE_SUFFIX = ".local.md";

export function rulesDir(cwd: string): string {
  return path.join(cwd, RULES_DIR);
}

export function isRuleFile(name: string): boolean {
  return name.startsWith(RULES_FILE_PREFIX) && name.endsWith(RULES_FILE_SUFFIX);
}

export function listRuleFiles(cwd: string): string[] {
  const dir = rulesDir(cwd);
  try {
    return readdirSync(dir)
      .filter(isRuleFile)
      .map((name) => path.join(dir, name))
      .sort();
  } catch {
    return [];
  }
}

export function ruleFromContent(content: string): Rule | null {
  const { frontmatter, body } = extractFrontmatter(content);
  if (!frontmatter || Object.keys(frontmatter).length === 0) return null;

  const name = typeof frontmatter.name === "string" ? frontmatter.name : "unnamed";
  const enabled = frontmatter.enabled === undefined ? true : Boolean(frontmatter.enabled);
  const event = typeof frontmatter.event === "string" ? frontmatter.event : "all";
  const action = frontmatter.action === "block" ? "block" : "warn";
  const toolMatcher = typeof frontmatter.tool_matcher === "string" ? frontmatter.tool_matcher : null;

  const conditions: Condition[] = [];
  const condList = frontmatter.conditions;
  if (Array.isArray(condList)) {
    for (const entry of condList) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const c = entry as Record<string, unknown>;
        conditions.push({
          field: typeof c.field === "string" ? c.field : "",
          operator: typeof c.operator === "string" ? c.operator : "regex_match",
          pattern: typeof c.pattern === "string" ? c.pattern : "",
        });
      }
    }
  }

  const simplePattern = typeof frontmatter.pattern === "string" ? frontmatter.pattern : null;
  if (conditions.length === 0 && simplePattern !== null && simplePattern !== "") {
    let field: string;
    if (event === "bash") field = "command";
    else if (event === "file") field = "new_text";
    else field = "content";
    conditions.push({ field, operator: "regex_match", pattern: simplePattern });
  }

  return {
    name,
    enabled,
    event,
    pattern: simplePattern,
    conditions,
    action: action as "warn" | "block",
    toolMatcher,
    message: body.trim(),
  };
}

export function loadRuleFile(filePath: string): Rule | null {
  try {
    const text = readFileSync(filePath, "utf8");
    return ruleFromContent(text);
  } catch {
    return null;
  }
}

export function loadRules(cwd: string, eventFilter: string | null = null): Rule[] {
  const rules: Rule[] = [];
  for (const file of listRuleFiles(cwd)) {
    const rule = loadRuleFile(file);
    if (!rule || !rule.enabled) continue;
    if (eventFilter && rule.event !== "all" && rule.event !== eventFilter) continue;
    rules.push(rule);
  }
  return rules;
}
