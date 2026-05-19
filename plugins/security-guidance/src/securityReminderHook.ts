#!/usr/bin/env -S bun
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";

type ToolInput = Record<string, unknown>;

type HookInput = {
  session_id?: string;
  tool_name?: string;
  tool_input?: ToolInput;
};

type Pattern = {
  ruleName: string;
  pathCheck?: (filePath: string) => boolean;
  substrings?: string[];
  reminder: string;
};

const SECURITY_PATTERNS: Pattern[] = [
  {
    ruleName: "github_actions_workflow",
    pathCheck: (p) =>
      p.includes(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml")),
    reminder: [
      "You are editing a GitHub Actions workflow file. Be aware of these security risks:",
      "",
      "1. Command Injection: Never use untrusted input (issue title, PR description, commit message) directly inside run: commands without proper escaping.",
      "2. Pass untrusted strings through env: with proper quoting and reference them with $VAR inside run:.",
      "3. Common untrusted fields: github.event.issue.title, github.event.issue.body, github.event.pull_request.*, github.event.comment.body, github.event.review.body, github.event.commits.*, github.head_ref.",
      "",
      "Unsafe example:",
      "  run: echo \"${{ github.event.issue.title }}\"",
      "",
      "Safer example:",
      "  env:",
      "    TITLE: ${{ github.event.issue.title }}",
      "  run: echo \"$TITLE\"",
    ].join("\n"),
  },
  {
    ruleName: "child_process_exec",
    substrings: ["child_process.exec", "exec(", "execSync("],
    reminder: [
      "Security warning: child_process.exec / execSync invoke a shell and can be exploited if any argument is influenced by untrusted input.",
      "",
      "Prefer execFile / spawn with an argument array, or a project-local helper that uses execFile under the hood.",
      "Only fall back to exec if you genuinely need shell features and every argument is trusted and static.",
    ].join("\n"),
  },
  {
    ruleName: "new_function_injection",
    substrings: ["new Function"],
    reminder:
      "Security warning: new Function(string) parses and runs arbitrary code, equivalent to eval. Replace with a switch/lookup table, an interpreter that you control, or static factory functions.",
  },
  {
    ruleName: "eval_injection",
    substrings: ["eval("],
    reminder:
      "Security warning: eval() runs arbitrary code and is a top-tier injection sink. Use JSON.parse for data, a real parser for expressions, or refactor the design so dynamic code is unnecessary.",
  },
  {
    ruleName: "react_dangerously_set_html",
    substrings: ["dangerouslySetInnerHTML"],
    reminder:
      "Security warning: dangerouslySetInnerHTML renders the string as HTML. If any part comes from a user, sanitize with a vetted library such as DOMPurify, or render plain text via React children.",
  },
  {
    ruleName: "document_write_xss",
    substrings: ["document.write"],
    reminder:
      "Security warning: document.write() can be exploited for XSS and has serious side effects after page load. Use createElement / appendChild or insertAdjacentHTML with sanitized markup.",
  },
  {
    ruleName: "innerHTML_xss",
    substrings: [".innerHTML =", ".innerHTML="],
    reminder:
      "Security warning: setting innerHTML with untrusted content is an XSS sink. Use textContent for plain text, or sanitize HTML through a vetted library before assignment.",
  },
  {
    ruleName: "pickle_deserialization",
    substrings: ["pickle"],
    reminder:
      "Security warning: Python pickle deserialization can execute arbitrary code when fed untrusted bytes. Switch to JSON or another data-only format unless every byte is trusted.",
  },
  {
    ruleName: "os_system_injection",
    substrings: ["os.system", "from os import system"],
    reminder:
      "Security warning: os.system passes its argument to /bin/sh. Use subprocess.run(args, shell=False) with a list of arguments and never interpolate untrusted strings.",
  },
];

export function extractContent(toolName: string, toolInput: ToolInput): string {
  if (toolName === "Write") {
    return String(toolInput.content ?? "");
  }
  if (toolName === "Edit") {
    return String(toolInput.new_string ?? "");
  }
  if (toolName === "MultiEdit") {
    const edits = toolInput.edits;
    if (Array.isArray(edits)) {
      return edits
        .map((edit) => {
          if (edit && typeof edit === "object") {
            const v = (edit as Record<string, unknown>).new_string;
            return typeof v === "string" ? v : "";
          }
          return "";
        })
        .join(" ");
    }
  }
  return "";
}

export type Match = { ruleName: string; reminder: string } | null;

export function checkPatterns(filePath: string, content: string): Match {
  const normalized = filePath.replace(/^\/+/, "");
  for (const pattern of SECURITY_PATTERNS) {
    if (pattern.pathCheck && pattern.pathCheck(normalized)) {
      return { ruleName: pattern.ruleName, reminder: pattern.reminder };
    }
    if (pattern.substrings && content) {
      for (const substring of pattern.substrings) {
        if (content.includes(substring)) {
          return { ruleName: pattern.ruleName, reminder: pattern.reminder };
        }
      }
    }
  }
  return null;
}

function stateDir(): string {
  return path.join(os.homedir(), ".crabcode");
}

function stateFile(sessionId: string): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128) || "default";
  return path.join(stateDir(), `security_warnings_state_${safeId}.json`);
}

function loadShownWarnings(sessionId: string): Set<string> {
  const file = stateFile(sessionId);
  if (!existsSync(file)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
    }
  } catch {
    // ignore parse errors
  }
  return new Set();
}

function saveShownWarnings(sessionId: string, shown: Set<string>): void {
  try {
    const dir = stateDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(stateFile(sessionId), JSON.stringify([...shown]), "utf8");
  } catch {
    // ignore
  }
}

function maybeCleanupOldState(): void {
  if (Math.random() >= 0.1) return;
  const dir = stateDir();
  if (!existsSync(dir)) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    for (const name of readdirSync(dir)) {
      if (!name.startsWith("security_warnings_state_") || !name.endsWith(".json")) continue;
      const full = path.join(dir, name);
      try {
        const st = statSync(full);
        if (st.mtimeMs < cutoff) unlinkSync(full);
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function runHook(input: HookInput): Promise<{ exitCode: number; stderr?: string }> {
  if (process.env.ENABLE_SECURITY_REMINDER === "0") return { exitCode: 0 };

  const toolName = String(input.tool_name ?? "");
  if (!["Edit", "Write", "MultiEdit"].includes(toolName)) return { exitCode: 0 };

  const toolInput = (input.tool_input ?? {}) as ToolInput;
  const filePath = String(toolInput.file_path ?? "");
  if (!filePath) return { exitCode: 0 };

  const content = extractContent(toolName, toolInput);
  const match = checkPatterns(filePath, content);
  if (!match) return { exitCode: 0 };

  const sessionId = String(input.session_id ?? "default");
  const key = `${filePath}-${match.ruleName}`;
  const shown = loadShownWarnings(sessionId);
  if (shown.has(key)) return { exitCode: 0 };
  shown.add(key);
  saveShownWarnings(sessionId, shown);

  return { exitCode: 2, stderr: match.reminder };
}

async function main(): Promise<void> {
  maybeCleanupOldState();
  let raw = "";
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }
  let parsed: HookInput = {};
  try {
    parsed = raw.trim() ? (JSON.parse(raw) as HookInput) : {};
  } catch {
    process.exit(0);
  }
  const result = await runHook(parsed);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}

if (import.meta.main) {
  void main();
}
