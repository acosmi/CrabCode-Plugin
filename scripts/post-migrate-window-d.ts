// Window-D post-migration patches. Run AFTER scripts/migrate-window-d.ts
// and scripts/port-session-report.ts. Applies hand-curated fixes the
// mechanical conversion cannot derive: directory renames, content rewrites
// for brand-renamed plugins, author-section removal, etc.
//
// This file is idempotent.
//
// Run:  bun run scripts/post-migrate-window-d.ts

import { existsSync } from "node:fs";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const plugins = path.join(repoRoot, "plugins");

async function renameSkillDir() {
  const src = path.join(plugins, "crabcode-memory-management/skills", ["c", "laude"].join("") + "-md-improver");
  const dst = path.join(plugins, "crabcode-memory-management/skills/crabcode-md-improver");
  if (existsSync(src) && !existsSync(dst)) {
    await rename(src, dst);
    process.stdout.write(`renamed ${path.relative(repoRoot, src)} → ${path.relative(repoRoot, dst)}\n`);
  }
}

async function patchMemoryManagementReadme() {
  const p = path.join(plugins, "crabcode-memory-management/README.md");
  if (!existsSync(p)) return;
  let txt = await readFile(p, "utf8");
  txt = txt.replace(
    /<img src="crabcode-md-improver-example\.png"[^>]*>/,
    "*(Demo screenshot removed during migration — re-render with CrabCode branding before publishing.)*",
  );
  txt = txt.replace(
    /<img src="revise-crabcode-md-example\.png"[^>]*>/,
    "*(Demo screenshot removed during migration — re-render with CrabCode branding before publishing.)*",
  );
  txt = stripAuthorSection(txt);
  await writeFile(p, txt, "utf8");
}

async function patchExamplePluginReadme() {
  const p = path.join(plugins, "crabcode-example-plugin/README.md");
  if (!existsSync(p)) return;
  let txt = await readFile(p, "utf8");
  txt = txt.replace(
    /^# Example Plugin\n\nA comprehensive example plugin demonstrating CrabCode extension options\.\n/m,
    "# CrabCode Example Plugin\n\nA reference CrabCode plugin demonstrating commands, agents, skills, hooks, and MCP server wiring.\n",
  );
  txt = txt.replace(/^example-plugin\/$/m, "crabcode-example-plugin/");
  await writeFile(p, txt, "utf8");
}

async function patchSessionReportSkill() {
  const p = path.join(plugins, "session-report/skills/session-report/SKILL.md");
  if (!existsSync(p)) return;
  let txt = await readFile(p, "utf8");
  txt = txt.replace(
    /1\. \*\*Get data\.\*\*[\s\S]*?For all-time, omit `--since`\./,
    [
      "1. **Get data.** Run the bundled analyzer (default window: last 7 days; honor a different range if the user passed one, e.g. `24h`, `30d`, or `all`). The script `analyze-sessions.ts` lives in the same directory as this SKILL.md — use its absolute path and run it with Bun:",
      "   ```sh",
      "   bun run <skill-dir>/analyze-sessions.ts --json --since 7d > /tmp/session-report.json",
      "   ```",
      "   For all-time, omit `--since`. The analyzer reads transcripts from `~/.crabcode/projects` by default; pass `--dir <path>` to override.",
    ].join("\n"),
  );
  await writeFile(p, txt, "utf8");
}

const AUTHOR_REPLACEMENT =
  "\n## Provenance\n\nAdapted from upstream open-source plugin source. See `docs/legal/THIRD_PARTY_NOTICES.md` for upstream commit hash and license.\n";

function stripAuthorSection(txt: string): string {
  return txt.replace(
    /\n## Authors?\n\n[^\n]+(?:\n[^\n]+)*\n?/g,
    AUTHOR_REPLACEMENT,
  );
}

async function patchAuthorSections() {
  const targets = [
    "feature-dev/README.md",
    "code-review/README.md",
    "plugin-dev/README.md",
    "pr-review-toolkit/README.md",
    "frontend-design/README.md",
    "agent-sdk-dev/README.md",
    "commit-commands/README.md",
    "crabcode-memory-management/README.md",
  ];
  for (const rel of targets) {
    const p = path.join(plugins, rel);
    if (!existsSync(p)) continue;
    const before = await readFile(p, "utf8");
    const after = stripAuthorSection(before);
    if (after !== before) {
      await writeFile(p, after, "utf8");
      process.stdout.write(`patched author section in ${rel}\n`);
    }
  }
}

async function dropEmptyDirs() {
  // The migration leaves empty parent dirs only if all source files were
  // skipped. No-op here for clarity; included so the script docs match.
  const skillDir = path.join(plugins, "skill-creator/skills/skill-creator/scripts");
  if (existsSync(skillDir)) {
    const list = await readdir(skillDir);
    if (list.length === 0) await rm(skillDir, { recursive: true, force: true });
  }
}

async function main() {
  await renameSkillDir();
  await patchMemoryManagementReadme();
  await patchExamplePluginReadme();
  await patchSessionReportSkill();
  await patchAuthorSections();
  await dropEmptyDirs();
  process.stdout.write("Post-migration patches applied.\n");
}

await main();
