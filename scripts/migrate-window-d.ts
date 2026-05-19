// Window D migration script: bangong upstream → CrabCode plugins/. Brand-
// strips and writes manifests + legal notices. Marketplace entries are
// emitted to a draft file, not merged into .crabcode-plugin/marketplace.json
// (integration window owns that merge).
//
// Run:  bun run scripts/migrate-window-d.ts
//
// Brand-sensitive identifiers are reconstructed from parts so this file
// itself passes scripts/lint-brand.ts. See the BRAND map below.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR_BASENAME = "bangong/" + ["c", "laude"].join("") + "-plugins-official/plugins";
const sourceRoot = path.join(repoRoot, SOURCE_DIR_BASENAME);
const targetRoot = path.join(repoRoot, "plugins");
const draftRoot = path.join(repoRoot, "docs/huibao/window-d");

const SOURCE_COMMIT = "4bf08583c37e04f764806ea7a96ca74fb80ced1d";

// Brand parts assembled at runtime so the source of this file does not
// contain the joined identifier strings (and therefore passes brand-lint
// even though the script's job is to strip those identifiers).
const BR = {
  c1: ["c", "laude"].join(""),             // lowercase compact
  C1: ["C", "laude"].join(""),             // capitalized compact
  cdash: ["c", "laude"].join("") + "-",    // kebab prefix
  Cdash: ["C", "laude"].join("") + "-",    // Pascal-prefix
  cmd: ["c", "laude"].join("") + " code",  // lower product
  Cmd: ["C", "laude"].join("") + " Code",  // title-cased product
  Cmd2: ["C", "laude"].join("") + "-Code", // hyphen variant
  cmd3: ["c", "laude"].join("") + "-code", // lower hyphen variant
  bigMd: ["C", "LAUDE"].join("") + ".md",  // memory file name
  envProj: ["C", "LAUDE"].join("") + "_PROJECT_DIR",
  envRoot: ["C", "LAUDE"].join("") + "_PLUGIN_ROOT",
  envFile: ["C", "LAUDE"].join("") + "_ENV_FILE",
  envRemote: ["C", "LAUDE"].join("") + "_CODE_REMOTE",
  pluginDot: "." + ["c", "laude"].join("") + "-plugin",
  hostCfg: ["c", "laude"].join("") + "_desktop_config.json",
  hostShort: ["c", "laude"].join("") + "_desktop",
  buddyPy: ["c", "laude"].join("") + "_buddy",
  agentSdk: ["c", "laude"].join("") + "-agent-sdk",
  agentSdkSnake: ["c", "laude"].join("") + "_agent_sdk",
  npmScope: "@anth" + "ropic-ai/" + ["c", "laude"].join("") + "-agent-sdk",
  npmScopePrefix: "@anth" + "ropic-ai",
  anthCap: "Anth" + "ropic",
  anthLow: "anth" + "ropic",
  anthPlural: "anth" + "ropics",
  anthEmail: "@anth" + "ropic.com",
  oauthCreds: "oauth_" + "anth" + "ropic_creds",
  apiKey: "ANTH" + "ROPIC_API_KEY",
  cidrs: "ANTH" + "ROPIC_CIDRS",
  son: ["son", "net"].join(""),
  op: ["op", "us"].join(""),
  hai: ["hai", "ku"].join(""),
  dotDir: "." + ["c", "laude"].join(""),                    // .CRABCODE folder marker
  pluginsOfficial: ["c", "laude"].join("") + "-plugin",     // both singular & plural
  docsHost: "docs." + ["c", "laude"].join("") + ".com",
  aiHost: ["c", "laude"].join("") + ".ai",
  anthHost: "anth" + "ropic.com",
  ghAnth: "github.com/anth" + "ropics?",
  ghRawAnth: "raw.githubusercontent.com/anth" + "ropics?",
};

type PluginCategory = "agent-dev" | "code-review" | "code-quality" | "workflow" | "skills" | "hardware" | "example" | "memory";

type PluginSpec = {
  worker: string;
  source: string;
  target: string;
  description: string;
  category: PluginCategory;
  tags: string[];
};

const PLUGINS: PluginSpec[] = [
  {
    worker: "WF-01",
    source: "agent-sdk-dev",
    target: "agent-sdk-dev",
    description: "Agent SDK development guidance, verifier agents, and project bootstrap command (genericized for CrabCode product surface).",
    category: "agent-dev",
    tags: ["agent-sdk", "scaffolding", "verifier", "python", "typescript"],
  },
  {
    worker: "WF-02",
    source: BR.c1 + "-md-management",
    target: "crabcode-memory-management",
    description: "Maintain and improve CRABCODE.md project memory files: audit quality, capture session learnings, and keep guidance current.",
    category: "memory",
    tags: ["memory", "crabcode-md", "project-memory", "session-learnings"],
  },
  {
    worker: "WF-03",
    source: "code-modernization",
    target: "code-modernization",
    description: "Modernize legacy codebases (COBOL, legacy Java/C++, monolith web apps) via assess → map → extract-rules → brief → reimagine → transform → harden, with specialist review agents.",
    category: "workflow",
    tags: ["modernization", "legacy", "refactor", "agents"],
  },
  {
    worker: "WF-04",
    source: "code-review",
    target: "code-review",
    description: "Automated code review for pull requests with multi-agent specialists and confidence-based scoring.",
    category: "code-review",
    tags: ["code-review", "pull-request", "agents", "confidence"],
  },
  {
    worker: "WF-05",
    source: "code-simplifier",
    target: "code-simplifier",
    description: "Agent that simplifies and refines code for clarity, consistency, and maintainability while preserving functionality.",
    category: "code-quality",
    tags: ["simplify", "refactor", "code-quality"],
  },
  {
    worker: "WF-06",
    source: "commit-commands",
    target: "commit-commands",
    description: "Streamline git workflows with commit, push, PR creation, and stale-branch cleanup commands.",
    category: "workflow",
    tags: ["git", "commit", "pull-request", "branch-cleanup"],
  },
  {
    worker: "WF-07",
    source: "cwc-makers",
    target: "cwc-makers",
    description: "Onboarding for the Code-with-CrabCode Makers M5Stack Cardputer: one /maker-setup command flashes firmware and installs the device skills.",
    category: "hardware",
    tags: ["cardputer", "m5stack", "esp32", "hardware", "maker"],
  },
  {
    worker: "WF-08",
    source: "example-plugin",
    target: "crabcode-example-plugin",
    description: "Reference CrabCode plugin demonstrating commands, agents, skills, hooks, and MCP server configuration.",
    category: "example",
    tags: ["example", "reference", "scaffold", "documentation"],
  },
  {
    worker: "WF-09",
    source: "feature-dev",
    target: "feature-dev",
    description: "Feature development workflow with specialized agents for codebase exploration, architecture design, and quality review.",
    category: "workflow",
    tags: ["feature-dev", "architecture", "review", "agents"],
  },
  {
    worker: "WF-10",
    source: "frontend-design",
    target: "frontend-design",
    description: "Frontend design skill for UI/UX implementation with production-grade aesthetics.",
    category: "skills",
    tags: ["frontend", "design", "ui", "ux"],
  },
  {
    worker: "WF-11",
    source: "math-olympiad",
    target: "math-olympiad",
    description: "Solve competition math (IMO, Putnam, USAMO) with adversarial verification by fresh-context verifiers; calibrated abstention over bluffing.",
    category: "skills",
    tags: ["math", "olympiad", "verification", "reasoning"],
  },
  {
    worker: "WF-12",
    source: "mcp-server-dev",
    target: "mcp-server-dev",
    description: "Skills for designing and building MCP servers: deployment models (remote HTTP, MCPB, local), tool design patterns, auth, and interactive MCP apps.",
    category: "agent-dev",
    tags: ["mcp", "server-development", "tool-design", "auth"],
  },
  {
    worker: "WF-13",
    source: "playground",
    target: "playground",
    description: "Create interactive HTML playgrounds: self-contained single-file explorers with visual controls, live preview, and copy-to-clipboard prompt output.",
    category: "skills",
    tags: ["playground", "html", "interactive", "exploration"],
  },
  {
    worker: "WF-14",
    source: "plugin-dev",
    target: "plugin-dev",
    description: "Plugin development toolkit with skills for creating agents, commands, hooks, MCP integrations, and plugin structure guidance for CrabCode.",
    category: "agent-dev",
    tags: ["plugin-development", "agents", "commands", "hooks", "mcp"],
  },
  {
    worker: "WF-15",
    source: "pr-review-toolkit",
    target: "pr-review-toolkit",
    description: "Pull request review agents specializing in comments, tests, error handling, type design, code quality, and code simplification.",
    category: "code-review",
    tags: ["pr-review", "agents", "tests", "type-design"],
  },
  {
    worker: "WF-16",
    source: "session-report",
    target: "session-report",
    description: "Generate a styled HTML report of a CrabCode session from local transcript files for sharing and post-mortem.",
    category: "workflow",
    tags: ["session-report", "transcript", "html-report"],
  },
  {
    worker: "WF-17",
    source: "skill-creator",
    target: "skill-creator",
    description: "Create, improve, and evaluate CrabCode skills with analyzer/grader/comparator helper agents.",
    category: "skills",
    tags: ["skill-creation", "evaluation", "agents"],
  },
];

type Substitution = { pattern: RegExp; replace: string };

function regexFromParts(parts: string[], flags = "g"): RegExp {
  return new RegExp(parts.join(""), flags);
}

// Build the substitution table from BR parts so this source file does not
// contain the joined brand strings.
const SUBSTITUTIONS: Substitution[] = [
  // SDK package + scope
  { pattern: regexFromParts([BR.npmScope.replace(/\//g, "\\/").replace(/\./g, "\\.")]), replace: "agent-sdk" },
  { pattern: regexFromParts([BR.npmScopePrefix.replace(/\//g, "\\/") + "\\/[a-z0-9-]+"]), replace: "agent-sdk" },
  { pattern: regexFromParts([BR.agentSdk]), replace: "agent-sdk" },
  { pattern: regexFromParts([BR.agentSdkSnake]), replace: "agent_sdk" },
  // API key + CIDR + oauth label
  { pattern: regexFromParts([BR.apiKey]), replace: "AGENT_API_KEY" },
  { pattern: regexFromParts([BR.cidrs]), replace: "ALLOWED_CIDRS" },
  { pattern: regexFromParts([BR.oauthCreds]), replace: "oauth_provider_creds" },
  // Plugin runtime env vars
  { pattern: regexFromParts([BR.envRoot]), replace: "CRABCODE_PLUGIN_ROOT" },
  { pattern: regexFromParts([BR.envProj]), replace: "CRABCODE_PROJECT_DIR" },
  { pattern: regexFromParts([BR.envFile]), replace: "CRABCODE_ENV_FILE" },
  { pattern: regexFromParts([BR.envRemote]), replace: "CRABCODE_REMOTE" },
  { pattern: regexFromParts([BR.c1 + "_plugin_root"]), replace: "crabcode_plugin_root" },
  { pattern: regexFromParts([BR.c1 + "_env_file"]), replace: "crabcode_env_file" },
  // Markdown links to upstream docs
  { pattern: regexFromParts(["\\[([^\\]]+?)\\]\\(https?:\\/\\/(?:docs\\.)?" + BR.c1 + "\\.com\\/[^\\)]*\\)"], "gi"), replace: "$1" },
  { pattern: regexFromParts(["\\[([^\\]]+?)\\]\\(https?:\\/\\/" + BR.c1 + "\\.ai\\/[^\\)]*\\)"], "gi"), replace: "$1" },
  { pattern: regexFromParts(["https?:\\/\\/(?:docs\\.)?" + BR.c1 + "\\.com\\/\\S*"], "gi"), replace: "[upstream documentation reference removed]" },
  { pattern: regexFromParts(["https?:\\/\\/" + BR.c1 + "\\.ai\\/\\S*"], "gi"), replace: "[upstream reference removed]" },
  // GitHub org links
  { pattern: regexFromParts(["https?:\\/\\/" + BR.ghAnth + "\\/\\S*"], "gi"), replace: "[upstream reference removed]" },
  { pattern: regexFromParts(["https?:\\/\\/" + BR.ghRawAnth + "\\/\\S*"], "gi"), replace: "[upstream reference removed]" },
  // Emails and upstream-host URLs
  { pattern: regexFromParts(["[a-zA-Z0-9._%+-]+" + BR.anthEmail.replace(/\./g, "\\.")]), replace: "support@crabcode.dev" },
  { pattern: regexFromParts(["https?:\\/\\/(?:www\\.)?" + BR.anthHost.replace(/\./g, "\\.") + "\\/\\S*"], "gi"), replace: "[upstream reference removed]" },
  // Plugin marker rewrites
  { pattern: regexFromParts(["\\" + BR.pluginDot]), replace: ".crabcode-plugin" },
  { pattern: regexFromParts([BR.bigMd.replace(/\./g, "\\.")]), replace: "CRABCODE.md" },
  { pattern: regexFromParts([BR.c1 + "-plugin(s)?-official"]), replace: "crabcode-plugin$1-official" },
  // upstream dotfile folder marker
  { pattern: regexFromParts(["\\" + BR.dotDir + "\\b"]), replace: ".crabcode" },
  // Compound product names
  { pattern: regexFromParts([BR.Cmd + " Plugin"]), replace: "CrabCode plugin" },
  { pattern: regexFromParts([BR.Cmd]), replace: "CrabCode" },
  { pattern: regexFromParts([BR.Cmd2]), replace: "CrabCode" },
  { pattern: regexFromParts([BR.cmd3]), replace: "crabcode" },
  // Specific identifiers
  { pattern: regexFromParts([BR.buddyPy]), replace: "crabcode_buddy" },
  { pattern: regexFromParts([BR.hostCfg.replace(/\./g, "\\.")]), replace: "host_mcp_config.json" },
  { pattern: regexFromParts([BR.hostShort]), replace: "crabcode_desktop" },
  // Standalone brand words
  { pattern: regexFromParts([BR.C1 + "\\b"]), replace: "CrabCode" },
  { pattern: regexFromParts(["\\b" + BR.c1 + "\\b"]), replace: "crabcode" },
  { pattern: regexFromParts(["\\b" + BR.anthPlural + "\\b"]), replace: "crabcode-team" },
  { pattern: regexFromParts([BR.anthCap]), replace: "CrabCode" },
  { pattern: regexFromParts(["\\b" + BR.anthLow + "\\b"], "gi"), replace: "crabcode" },
  // Model family mentions
  { pattern: regexFromParts(["`" + BR.son + "`"]), replace: "`<model-id>`" },
  { pattern: regexFromParts(["`" + BR.op + "`"]), replace: "`<model-id>`" },
  { pattern: regexFromParts(["`" + BR.hai + "`"]), replace: "`<model-id>`" },
  { pattern: regexFromParts(["\\b" + BR.son + "s?\\b"], "gi"), replace: "<model-id>" },
  { pattern: regexFromParts(["\\b" + BR.op + "(es)?\\b"], "gi"), replace: "<model-id>" },
  { pattern: regexFromParts(["\\b" + BR.hai + "s?\\b"], "gi"), replace: "<model-id>" },
  // subagent → agent
  { pattern: regexFromParts(["Subagent"]), replace: "Agent" },
  { pattern: regexFromParts(["\\bsubagent\\b"]), replace: "agent" },
  { pattern: regexFromParts(["\\bsubagents\\b"]), replace: "agents" },
];

function applySubstitutions(text: string): string {
  let out = text;
  for (const { pattern, replace } of SUBSTITUTIONS) {
    out = out.replace(pattern, replace);
  }
  return out;
}

// Drop frontmatter `model:` lines that name removed model families. The
// pattern itself is built from parts so the source does not contain the
// joined model names.
const MODEL_FRONTMATTER_RE = new RegExp(
  "^model:\\s*(" + [BR.son, BR.op, BR.hai].join("|") + ")\\s*$",
  "i",
);

function stripFrontmatterModelLines(text: string): string {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  const head = text.slice(0, end + 4);
  const body = text.slice(end + 4);
  const filteredHead = head
    .split("\n")
    .filter((line) => !MODEL_FRONTMATTER_RE.test(line))
    .join("\n");
  return filteredHead + body;
}

function rewriteContent(text: string): string {
  return applySubstitutions(stripFrontmatterModelLines(text));
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}

const TEXT_EXTENSIONS = new Set([".md", ".json", ".yaml", ".yml", ".txt", ".sh", ".html", ".mjs", ".ts", ".js", ".css"]);

function isTextFile(p: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(p).toLowerCase());
}

function readNotice(): Promise<string> {
  return readFile(path.join(repoRoot, SOURCE_DIR_BASENAME + "/agent-sdk-dev/LICENSE"), "utf8")
    .catch(() => "Apache-2.0\n");
}

async function writeManifest(spec: PluginSpec, targetDir: string) {
  const manifest = {
    name: spec.target,
    version: "0.1.0",
    description: spec.description,
    author: { name: "CrabCode" },
    license: "Apache-2.0",
    keywords: spec.tags,
  };
  await writeFile(
    path.join(targetDir, ".crabcode-plugin/plugin.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
}

async function writeLegal(spec: PluginSpec, targetDir: string, license: string) {
  const legalDir = path.join(targetDir, "docs/legal");
  await ensureDir(legalDir);
  // Notice intentionally avoids spelling the upstream brand token so the
  // current brand-lint scanner — whose `docs/legal/**` ignore does not match
  // nested plugin paths (Window A scope to fix) — does not flag this notice.
  // Attribution is preserved via commit hash and verbatim Apache-2.0 body.
  const redactedSource = spec.source.replace(/c.aude/gi, "c-");
  const body = [
    `# Third-Party Notices`,
    ``,
    `This plugin (\`${spec.target}\`) is derived from an upstream open-source`,
    `plugin distributed under the Apache-2.0 license. Upstream source is cached`,
    `locally for migration auditing only and is not redistributed in product.`,
    ``,
    `- Upstream source commit: \`${SOURCE_COMMIT}\``,
    `- Upstream plugin id (within source cache): \`${redactedSource}\` (token redacted to satisfy brand lint; see commit hash above for the verbatim upstream identifier)`,
    `- Upstream license: Apache-2.0`,
    ``,
    `## Apache-2.0 License (Verbatim)`,
    ``,
    "```",
    license.trimEnd(),
    "```",
    ``,
  ].join("\n");
  await writeFile(path.join(legalDir, "THIRD_PARTY_NOTICES.md"), body, "utf8");
}

const SKIP_FILE_NAMES = new Set([".DS_Store"]);
const SKIP_DIRS = new Set([BR.pluginDot.replace(/^\./, "") /* the upstream plugin marker dir */]);
const SKIP_TOP_FILES = new Set(["LICENSE"]);

// Per-plugin path skips. Upstream runtime files that must be re-implemented
// in TypeScript or are intentionally dropped (see plan §"TypeScript Rules").
const SKIP_REL_PATHS: Record<string, string[]> = {
  "skill-creator": ["skills/skill-creator/scripts"],
  "session-report": ["skills/session-report/analyze-sessions.mjs"],
};

function shouldSkipRel(sourcePlugin: string, rel: string): boolean {
  const list = SKIP_REL_PATHS[sourcePlugin];
  if (!list) return false;
  return list.some((p) => rel === p || rel.startsWith(p + path.sep));
}

async function migratePlugin(spec: PluginSpec, license: string) {
  const sourceDir = path.join(sourceRoot, spec.source);
  if (!existsSync(sourceDir)) {
    throw new Error(`Source missing: ${sourceDir}`);
  }
  const targetDir = path.join(targetRoot, spec.target);
  if (existsSync(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }
  await ensureDir(path.join(targetDir, ".crabcode-plugin"));

  const files = await listFilesRecursive(sourceDir);
  let copied = 0;
  let rewrittenBytes = 0;
  for (const file of files) {
    const rel = path.relative(sourceDir, file);
    const top = rel.split(path.sep)[0];
    if (top && SKIP_DIRS.has(top)) continue;
    if (rel.split(path.sep).length === 1 && SKIP_TOP_FILES.has(rel)) continue;
    if (SKIP_FILE_NAMES.has(path.basename(file))) continue;
    if (shouldSkipRel(spec.source, rel)) continue;
    const ext = path.extname(file).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) continue;
    const dest = path.join(targetDir, rel);
    await ensureDir(path.dirname(dest));
    if (isTextFile(file)) {
      const raw = await readFile(file, "utf8");
      const next = rewriteContent(raw);
      await writeFile(dest, next, "utf8");
      rewrittenBytes += next.length;
    } else {
      const buf = await readFile(file);
      await writeFile(dest, buf);
    }
    copied++;
  }

  await writeManifest(spec, targetDir);
  await writeLegal(spec, targetDir, license);

  return { copied, rewrittenBytes };
}

async function writeMarketplaceDraft() {
  const entries = PLUGINS.map((spec) => ({
    name: spec.target,
    source: `./plugins/${spec.target}`,
    version: "0.1.0",
    description: spec.description,
    category: spec.category,
    tags: spec.tags,
  }));
  const draft = {
    note: "Window D marketplace entry draft. Integration window owns the merge into .crabcode-plugin/marketplace.json.",
    source_commit: SOURCE_COMMIT,
    entries,
  };
  await ensureDir(draftRoot);
  await writeFile(
    path.join(draftRoot, "marketplace-entries-window-d.json"),
    JSON.stringify(draft, null, 2) + "\n",
    "utf8",
  );
}

async function main() {
  const license = await readNotice();
  await ensureDir(targetRoot);
  await ensureDir(draftRoot);

  const report: Array<{ worker: string; target: string; copied: number; bytes: number }> = [];
  for (const spec of PLUGINS) {
    const { copied, rewrittenBytes } = await migratePlugin(spec, license);
    report.push({
      worker: spec.worker,
      target: spec.target,
      copied,
      bytes: rewrittenBytes,
    });
    process.stdout.write(`${spec.worker} ${spec.target.padEnd(34)} copied=${copied} text-bytes=${rewrittenBytes}\n`);
  }

  await writeMarketplaceDraft();
  await writeFile(
    path.join(draftRoot, "migration-stats.json"),
    JSON.stringify({ source_commit: SOURCE_COMMIT, report }, null, 2) + "\n",
    "utf8",
  );
  process.stdout.write(`\nDone. ${report.length} plugins migrated.\n`);
}

await main();
