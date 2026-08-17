import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import hookEventFacts from "./facts/hook-events.json" with { type: "json" };
import pluginSubcommandFacts from "./facts/plugin-subcommands.json" with { type: "json" };

/**
 * Documentation fact gate.
 *
 * The brand linter answers "does this text use a forbidden word". It cannot
 * answer "is this claim true of *this* product", and the 2026-08-15 audit found
 * the second question is where the damage lives: de-branded upstream prose kept
 * describing upstream behaviour — hook events that are never emitted, an MCP
 * namespace no code produces, placeholders nothing substitutes. Each read as
 * confident documentation and each was false.
 *
 * So this validator checks a small set of claims that (a) recurred, and (b) can
 * be decided mechanically against facts exported from the product repository
 * under src/policy/facts/.
 *
 * Severity is scoped deliberately. The two plugins the audit actually cleaned
 * are held at error; every other plugin reports warnings, so the remaining
 * inventory stays visible without turning an unrelated plugin's legacy prose
 * into a build failure. Cleaning a plugin means adding it to STRICT_PLUGINS.
 */

export type DocFactsSeverity = "error" | "warning";

export type DocFactsIssue = {
  severity: DocFactsSeverity;
  file: string;
  line: number;
  rule: string;
  message: string;
};

/** Plugins whose documentation has been audited and must stay clean. */
const STRICT_PLUGINS = new Set(["plugin-dev", "agent-sdk-dev"]);

const WALK_SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "vendor"]);
const CHECKED_EXTENSIONS = new Set([".md", ".sh", ".json"]);

const HOOK_EVENTS = new Set<string>(hookEventFacts.events);
const PLUGIN_SUBCOMMANDS = new Set<string>(pluginSubcommandFacts.subcommands);
const MARKETPLACE_ACTIONS = new Set<string>(pluginSubcommandFacts.marketplaceActions);

/**
 * A documented claim that is false of this product, paired with the truth the
 * author most likely meant. `pattern` is matched per line and must be global.
 */
type BannedClaim = {
  rule: string;
  pattern: RegExp;
  message: string;
};

const BANNED_CLAIMS: BannedClaim[] = [
  {
    rule: "fictional-hook-event",
    pattern: /\bAgentStop\b/g,
    message: "AgentStop 不是运行时事件;子代理结束事件名为 SubagentStop",
  },
  {
    rule: "fictional-mcp-namespace",
    pattern: /mcp__plugin_/g,
    message:
      "mcp__plugin_<server>__ 不是真实命名空间;插件 MCP 工具名为 mcp__p_<24 位十六进制摘要>__<tool>,只能由 /mcp 打印后复制",
  },
  {
    rule: "fictional-hook-placeholder",
    pattern: /\$TOOL_INPUT\b|\$TOOL_RESULT\b|\$USER_PROMPT\b/g,
    message:
      "提示词 hook 只替换 $ARGUMENTS(整段 stdin JSON);逐字段占位符不存在,会原样送进模型",
  },
  {
    rule: "fictional-hook-decision",
    pattern: /"decision"\s*:\s*"deny"/g,
    message:
      'hook 的 decision 字段只接受 approve|block;拒绝工具调用用 hookSpecificOutput.permissionDecision:"deny"',
  },
  {
    rule: "fictional-marketplace-name",
    pattern: /\bcrabcode-marketplace\b/g,
    message: "官方市场名为 crabcode-plugins-official",
  },
  {
    rule: "fictional-debug-flag",
    pattern: /\bdebug-logs\b/g,
    message: "debug-logs 不是真实开关",
  },
  {
    rule: "unresolved-model-placeholder",
    pattern: /<model-id>/g,
    message:
      "<model-id> 是未落地的占位符;agent 的 model 字段取 inherit|best|planmode",
  },
  {
    rule: "fictional-api-key-env",
    pattern: /\bAGENT_API_KEY\b/g,
    message: "环境变量名为 ACOSMI_API_KEY",
  },
  {
    rule: "fictional-answers-index",
    pattern: /answers\[\s*"\d+"\s*\]/g,
    message: "AskUserQuestion 的 answers 以问题原文为键,不是数字下标",
  },
];

const BANNED_RULE_IDS = new Set(BANNED_CLAIMS.map((claim) => claim.rule));

const RULE_UNKNOWN_HOOK_EVENT = "unknown-hook-event";
const RULE_UNKNOWN_PLUGIN_SUBCOMMAND = "unknown-plugin-subcommand";
const RULE_COMMAND_ARG_OFF_BY_ONE = "command-arg-off-by-one";

const ALL_RULE_IDS = new Set<string>([
  ...BANNED_RULE_IDS,
  RULE_UNKNOWN_HOOK_EVENT,
  RULE_UNKNOWN_PLUGIN_SUBCOMMAND,
  RULE_COMMAND_ARG_OFF_BY_ONE,
]);

/**
 * Counter-examples are the point, not an exception to it. Prose that says
 * "AgentStop does not exist" has to name AgentStop, and a gate that forbade
 * that would delete the very sentence keeping the mistake from returning.
 *
 * So a line may opt out by naming the rule it is deliberately quoting, either
 * on the line itself or on the line immediately above:
 *
 *   <!-- doc-facts-allow: fictional-hook-event -->   (markdown)
 *   # doc-facts-allow: fictional-hook-event          (shell)
 *
 * Markers are themselves checked: one that no longer suppresses anything is
 * reported, so they cannot quietly outlive the text they were written for.
 */
const ALLOW_MARKER_PATTERN = /doc-facts-allow:\s*([a-z-]+(?:\s*,\s*[a-z-]+)*)/g;

/** Event lists in prose: everything after the colon is claimed to be an event. */
const EVENT_LIST_PATTERN = /(?:Available|Supported|Commonly used|Valid) events\**\s*:\**\s*(.+)/i;

/**
 * Event keys in a hooks config open an array or object of hook definitions.
 * Requiring that value shape is what separates "PreToolUse": [ ... ] from an
 * ordinary PascalCase key such as "Authorization": "Bearer ...".
 */
const HOOK_CONFIG_KEY_PATTERN = /"([A-Z][A-Za-z]+)"\s*:\s*[[{]/g;

const PLUGIN_COMMAND_PATTERN = /\/plugin\s+([a-z-]+)(?:\s+([a-z-]+))?/g;

/**
 * Positional arguments in a command body are zero-based: substituteArguments
 * maps $0 to the first argument, so the shell habit of writing $1 for the first
 * one shifts every argument along and drops the last into an empty string. It
 * fails silently — the command still runs, just with the wrong values — which
 * is why it survived in 171 places until it was measured.
 *
 * A block is judged as a whole rather than line by line: what marks it as
 * shell-numbered is that it uses $1 while never using $0.
 */
const POSITIONAL_ARG_PATTERN = /\$(\d+)(?!\w)/g;
const COMMAND_FILE_FENCE_LANGS = new Set(["markdown", "md", "yaml", "yml"]);
const FENCE_PATTERN = /^\s*(`{3,})\s*([A-Za-z0-9_-]*)\s*$/;

export async function validateDocFacts(root: string): Promise<DocFactsIssue[]> {
  const absRoot = path.resolve(root);
  const pluginsDir = path.join(absRoot, "plugins");
  const issues: DocFactsIssue[] = [];

  for (const plugin of await listDirectories(pluginsDir)) {
    const severity: DocFactsSeverity = STRICT_PLUGINS.has(plugin) ? "error" : "warning";
    const files: string[] = [];
    await walkCheckedFiles(path.join(pluginsDir, plugin), files);
    for (const file of files) {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue;
      }
      checkFile(content, file, severity, issues);
    }
  }

  return issues;
}

export function formatDocFactsIssues(issues: DocFactsIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.file);
      return `${issue.severity.toUpperCase()} ${rel}:${issue.line} [${issue.rule}] ${issue.message}`;
    })
    .join("\n");
}

function checkFile(
  content: string,
  file: string,
  severity: DocFactsSeverity,
  issues: DocFactsIssue[],
): void {
  const lines = content.split(/\r?\n/);
  const allowed = collectAllowMarkers(lines, file, issues);
  const used = new Set<string>();

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const suppressed = allowed.get(lineNumber);
    const raise = (rule: string, message: string): void => {
      if (suppressed?.has(rule)) {
        used.add(`${lineNumber}:${rule}`);
        return;
      }
      issues.push({ severity, file, line: lineNumber, rule, message });
    };

    for (const claim of BANNED_CLAIMS) {
      claim.pattern.lastIndex = 0;
      if (claim.pattern.test(line)) raise(claim.rule, claim.message);
    }

    checkEventList(line, raise);
    checkHookConfigKeys(line, raise);
    checkPluginSubcommands(line, raise);
  });

  checkPositionalArgs(lines, allowed, used, severity, file, issues);
  reportUnusedMarkers(allowed, used, file, issues);
}

function checkPositionalArgs(
  lines: string[],
  allowed: Map<number, Set<string>>,
  used: Set<string>,
  severity: DocFactsSeverity,
  file: string,
  issues: DocFactsIssue[],
): void {
  let openTicks: string | null = null;
  let isCommandFile = false;
  let blockStart = 0;
  let indices = new Set<number>();
  let firstHit = 0;

  const closeBlock = (): void => {
    if (isCommandFile && indices.size > 0 && !indices.has(0) && Math.min(...indices) === 1) {
      if (allowed.get(firstHit)?.has(RULE_COMMAND_ARG_OFF_BY_ONE)) {
        used.add(`${firstHit}:${RULE_COMMAND_ARG_OFF_BY_ONE}`);
      } else {
        issues.push({
          severity,
          file,
          line: firstHit,
          rule: RULE_COMMAND_ARG_OFF_BY_ONE,
          message: `命令正文用 $1 指代第一个参数(块起于第 ${blockStart} 行);位置参数从 $0 起算,写 $1 会取到第二个参数、并让最后一个静默为空`,
        });
      }
    }
    openTicks = null;
    isCommandFile = false;
    indices = new Set();
  };

  lines.forEach((line, i) => {
    const fence = FENCE_PATTERN.exec(line);
    if (fence) {
      const [, ticks, lang] = fence;
      if (openTicks === null) {
        openTicks = ticks ?? "```";
        isCommandFile = COMMAND_FILE_FENCE_LANGS.has((lang ?? "").toLowerCase());
        blockStart = i + 1;
        indices = new Set();
        firstHit = 0;
        return;
      }
      // Only a fence at least as long as the opener can close it, so a nested
      // shorter fence inside a wrapped example does not end the block early.
      if ((ticks?.length ?? 0) >= openTicks.length && !lang) closeBlock();
      return;
    }
    if (openTicks === null || !isCommandFile) return;
    POSITIONAL_ARG_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(POSITIONAL_ARG_PATTERN)) {
      if (indices.size === 0) firstHit = i + 1;
      indices.add(Number(match[1]));
    }
  });
  if (openTicks !== null) closeBlock();
}

function checkEventList(line: string, raise: (rule: string, message: string) => void): void {
  const match = EVENT_LIST_PATTERN.exec(line);
  if (!match?.[1]) return;
  // Stop at the first clause boundary: a list is often followed by a sentence
  // that legitimately contains ordinary capitalised words.
  const listSegment = match[1].split(/—|–|;|\.\s|\(|\bsee\b/i)[0] ?? "";
  for (const raw of listSegment.split(/[,、]/)) {
    const token = raw.replace(/[`*.\s]/g, "");
    if (!token || !/^[A-Z][A-Za-z]+$/.test(token)) continue;
    if (HOOK_EVENTS.has(token)) continue;
    raise(
      RULE_UNKNOWN_HOOK_EVENT,
      `事件列表中的「${token}」不在运行时事件集内(见 src/policy/facts/hook-events.json)`,
    );
  }
}

function checkHookConfigKeys(line: string, raise: (rule: string, message: string) => void): void {
  HOOK_CONFIG_KEY_PATTERN.lastIndex = 0;
  for (const match of line.matchAll(HOOK_CONFIG_KEY_PATTERN)) {
    const key = match[1] ?? "";
    if (HOOK_EVENTS.has(key)) continue;
    raise(
      RULE_UNKNOWN_HOOK_EVENT,
      `hook 配置键「${key}」不在运行时事件集内(见 src/policy/facts/hook-events.json)`,
    );
  }
}

function checkPluginSubcommands(
  line: string,
  raise: (rule: string, message: string) => void,
): void {
  PLUGIN_COMMAND_PATTERN.lastIndex = 0;
  for (const match of line.matchAll(PLUGIN_COMMAND_PATTERN)) {
    const sub = match[1] ?? "";
    if (!PLUGIN_SUBCOMMANDS.has(sub)) {
      raise(
        RULE_UNKNOWN_PLUGIN_SUBCOMMAND,
        `/plugin ${sub} 不是真实子命令,解析器会静默回落到菜单(见 src/policy/facts/plugin-subcommands.json)`,
      );
      continue;
    }
    const action = match[2];
    if ((sub === "marketplace" || sub === "market") && action && !MARKETPLACE_ACTIONS.has(action)) {
      raise(
        RULE_UNKNOWN_PLUGIN_SUBCOMMAND,
        `/plugin ${sub} ${action} 不是真实动作,可选 ${[...MARKETPLACE_ACTIONS].join("、")}`,
      );
    }
  }
}

/**
 * Markers apply to their own line and to the line below, so a marker may sit
 * above the text it exempts rather than trailing it.
 */
function collectAllowMarkers(
  lines: string[],
  file: string,
  issues: DocFactsIssue[],
): Map<number, Set<string>> {
  const allowed = new Map<number, Set<string>>();
  lines.forEach((line, index) => {
    ALLOW_MARKER_PATTERN.lastIndex = 0;
    for (const match of line.matchAll(ALLOW_MARKER_PATTERN)) {
      for (const raw of (match[1] ?? "").split(",")) {
        const rule = raw.trim();
        if (!rule) continue;
        if (!ALL_RULE_IDS.has(rule)) {
          issues.push({
            severity: "warning",
            file,
            line: index + 1,
            rule: "unknown-allow-marker",
            message: `doc-facts-allow 引用了不存在的规则 id「${rule}」`,
          });
          continue;
        }
        for (const target of [index + 1, index + 2]) {
          let set = allowed.get(target);
          if (!set) {
            set = new Set<string>();
            allowed.set(target, set);
          }
          set.add(rule);
        }
      }
    }
  });
  return allowed;
}

/**
 * A marker that suppressed nothing is reported once, at the line it covers.
 * Because a marker covers two lines, it counts as used if either line used it.
 */
function reportUnusedMarkers(
  allowed: Map<number, Set<string>>,
  used: Set<string>,
  file: string,
  issues: DocFactsIssue[],
): void {
  const reported = new Set<string>();
  for (const [line, rules] of allowed) {
    for (const rule of rules) {
      if (used.has(`${line}:${rule}`)) continue;
      // The sibling line of the same marker may have consumed it.
      if (used.has(`${line - 1}:${rule}`) || used.has(`${line + 1}:${rule}`)) continue;
      const key = `${rule}:${Math.min(line, line - 1)}`;
      if (reported.has(key) || reported.has(`${rule}:${line}`)) continue;
      reported.add(`${rule}:${line}`);
      issues.push({
        severity: "warning",
        file,
        line,
        rule: "stale-allow-marker",
        message: `doc-facts-allow: ${rule} 未抑制任何命中,文本可能已改,请删除该标记`,
      });
    }
  }
}

async function listDirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function walkCheckedFiles(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || WALK_SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Upstream licence texts are verbatim third-party records, not our claims.
      if (entry.name === "legal" && path.basename(dir) === "docs") continue;
      await walkCheckedFiles(full, out);
    } else if (entry.isFile() && CHECKED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}
