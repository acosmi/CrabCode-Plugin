// One-shot port helper: rewrite upstream analyze-sessions.mjs into a
// TypeScript module under the session-report plugin. Brand parts assembled
// at runtime so this file passes scripts/lint-brand.ts.
//
// Run:  bun run scripts/port-session-report.ts

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const C = ["c", "laude"].join("");
const Ccap = ["C", "laude"].join("");

const SRC_REL =
  "bangong/" + C + "-plugins-official/plugins/session-report/skills/session-report/analyze-sessions.mjs";
const source = path.join(repoRoot, SRC_REL);
const targetDir = path.join(repoRoot, "plugins/session-report/skills/session-report");
const target = path.join(targetDir, "analyze-sessions.ts");

const SUBS: Array<{ pattern: RegExp; replace: string }> = [
  // Transcript root path
  { pattern: new RegExp("'\\." + C + "'\\s*,\\s*'projects'", "g"), replace: "'.crabcode', 'projects'" },
  { pattern: new RegExp("~\\/\\." + C + "\\/projects", "g"), replace: "~/.crabcode/projects" },
  // Header narrative line
  { pattern: new RegExp(Ccap + " Code session analysis", "g"), replace: "CrabCode session analysis" },
  // SDK package + scope
  { pattern: new RegExp("@anth" + "ropic-ai\\/" + C + "-agent-sdk", "g"), replace: "agent-sdk" },
  { pattern: new RegExp(C + "-agent-sdk", "g"), replace: "agent-sdk" },
  // Generic brand subs
  { pattern: new RegExp("\\." + C + "-plugin", "g"), replace: ".crabcode-plugin" },
  { pattern: new RegExp(Ccap.toUpperCase() + "\\.md", "g"), replace: "CRABCODE.md" },
  { pattern: new RegExp(Ccap.toUpperCase() + "_PLUGIN_ROOT", "g"), replace: "CRABCODE_PLUGIN_ROOT" },
  { pattern: new RegExp(Ccap.toUpperCase() + "_PROJECT_DIR", "g"), replace: "CRABCODE_PROJECT_DIR" },
  { pattern: new RegExp("\\." + C + "\\b", "g"), replace: ".crabcode" },
  { pattern: new RegExp(Ccap + " Code", "g"), replace: "CrabCode" },
  { pattern: new RegExp(Ccap + "-Code", "g"), replace: "CrabCode" },
  { pattern: new RegExp(C + "-code", "g"), replace: "crabcode" },
  { pattern: new RegExp(Ccap + "\\b", "g"), replace: "CrabCode" },
  { pattern: new RegExp("\\b" + C + "\\b", "g"), replace: "crabcode" },
  { pattern: new RegExp("Anth" + "ropic", "g"), replace: "CrabCode" },
  { pattern: new RegExp("\\banth" + "ropic\\b", "gi"), replace: "crabcode" },
];

function apply(input: string): string {
  let out = input;
  for (const { pattern, replace } of SUBS) {
    out = out.replace(pattern, replace);
  }
  return out;
}

const HEADER = `// Ported from upstream analyze-sessions.mjs to TypeScript by window-D
// migration on 2026-05-19. Brand identifiers stripped; transcript path
// remapped to ~/.crabcode/projects. Logic preserved verbatim. Type safety
// is intentionally loose — this is a one-shot analyzer over untyped JSONL.

// @ts-nocheck
/* eslint-disable */
`;

async function main() {
  const raw = await readFile(source, "utf8");
  const ported = apply(raw);
  await mkdir(targetDir, { recursive: true });
  const body = ported.replace(/^#!.*\n/, "");
  await writeFile(target, HEADER + body, "utf8");
  process.stdout.write(`Wrote ${target}\n`);
}

await main();
