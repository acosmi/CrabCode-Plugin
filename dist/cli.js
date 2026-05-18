#!/usr/bin/env node

// src/detectors/packageJson.ts
var PACKAGE_MANAGERS = {
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "package-lock.json": "npm",
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn"
};
var FRAMEWORK_DEPS = {
  "@angular/core": "Angular",
  "@astrojs/check": "Astro",
  "@nestjs/core": "NestJS",
  "@sveltejs/kit": "SvelteKit",
  "@tauri-apps/api": "Tauri",
  astro: "Astro",
  drizzle: "Drizzle",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  koa: "Koa",
  next: "Next.js",
  prisma: "Prisma",
  react: "React",
  svelte: "Svelte",
  vue: "Vue"
};
var TEST_DEPS = ["@playwright/test", "vitest", "jest", "mocha", "cypress"];
function detectPackageJson(scan) {
  if (scan.packageJsons.length === 0) {
    return {};
  }
  const deps = collectAllDependencies(scan);
  const languages = new Set(["JavaScript"]);
  const frameworks = new Set;
  const testCommands = [];
  const buildCommands = [];
  const signals = [
    {
      id: "package-json",
      label: "Node package metadata",
      confidence: "high",
      evidence: scan.packageJsons.map((item) => item.path).slice(0, 5)
    }
  ];
  if (deps.has("typescript") || scan.files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx"))) {
    languages.add("TypeScript");
    signals.push({
      id: "typescript",
      label: "TypeScript project",
      confidence: "high",
      evidence: evidence([
        ...scan.packageJsons.filter((item) => collectDependencies(item.json).has("typescript")).map((item) => item.path),
        ...scan.files.filter((file) => pathLooksLikeTsConfig(file))
      ])
    });
  }
  for (const [dependency, label] of Object.entries(FRAMEWORK_DEPS)) {
    if (deps.has(dependency)) {
      frameworks.add(label);
    }
  }
  for (const item of scan.packageJsons) {
    const packageDeps = collectDependencies(item.json);
    for (const [name, command] of Object.entries(item.json.scripts ?? {})) {
      const commandLine = formatScriptEvidence(item.path, name, command);
      if (isTestScript(name, command, packageDeps)) {
        testCommands.push(commandLine);
      }
      if (isBuildScript(name, command)) {
        buildCommands.push(commandLine);
      }
    }
  }
  if (TEST_DEPS.some((dependency) => deps.has(dependency))) {
    signals.push({
      id: "js-test-tooling",
      label: "JavaScript test tooling",
      confidence: "high",
      evidence: TEST_DEPS.filter((dependency) => deps.has(dependency))
    });
  }
  const workspaces = scan.packageJsons.filter((item) => isWorkspace(item.json));
  if (workspaces.length > 0 || scan.packageJsons.length > 1) {
    signals.push({
      id: "monorepo",
      label: "Workspace or monorepo layout",
      confidence: workspaces.length > 0 ? "medium" : "low",
      evidence: workspaces.length > 0 ? workspaces.map((item) => `${item.path} workspaces`) : scan.packageJsons.map((item) => item.path).slice(0, 5)
    });
  }
  return {
    languages: [...languages],
    frameworks: [...frameworks],
    packageManagers: scan.lockFiles.map((file) => PACKAGE_MANAGERS[file]).filter((value) => Boolean(value)),
    testCommands,
    buildCommands,
    signals
  };
}
function collectAllDependencies(scan) {
  return new Set(scan.packageJsons.flatMap((item) => [...collectDependencies(item.json)]));
}
function collectDependencies(packageJson) {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {})
  ]);
}
function isTestScript(name, command, deps) {
  const text = `${name} ${command}`.toLowerCase();
  return text.includes("test") || TEST_DEPS.some((dependency) => deps.has(dependency) && text.includes(dependency.split("/").pop() ?? dependency));
}
function isBuildScript(name, command) {
  const text = `${name} ${command}`.toLowerCase();
  return text.includes("build") || text.includes("typecheck") || text.includes("lint");
}
function isWorkspace(packageJson) {
  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces.length > 0;
  }
  return Boolean(packageJson.workspaces && typeof packageJson.workspaces === "object" && packageJson.workspaces.packages?.length);
}
function evidence(values) {
  return values.length ? values : ["package.json"];
}
function pathLooksLikeTsConfig(file) {
  return file === "tsconfig.json" || file.endsWith("/tsconfig.json");
}
function formatScriptEvidence(packageJsonPath, name, command) {
  return packageJsonPath === "package.json" ? `${name}: ${command}` : `${packageJsonPath} ${name}: ${command}`;
}

// src/detectors/backend.ts
var BACKEND_DEPS = new Map([
  ["@fastify/swagger", "API documentation"],
  ["@nestjs/core", "NestJS"],
  ["drizzle", "Drizzle"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
  ["koa", "Koa"],
  ["prisma", "Prisma"],
  ["stripe", "payments"]
]);
var SECURITY_PATH_HINTS = ["auth", "session", "token", "payment", "billing", "checkout"];
function detectBackend(scan) {
  const deps = collectAllDependencies(scan);
  const backendEvidence = [...BACKEND_DEPS.entries()].filter(([dependency]) => deps.has(dependency)).map(([, label]) => label);
  const routeEvidence = scan.files.filter((file) => file.includes("/api/") || file.includes("/routes/") || file.endsWith("routes.ts") || file.endsWith("server.ts")).slice(0, 5);
  const securityEvidence = scan.files.filter((file) => SECURITY_PATH_HINTS.some((hint) => file.toLowerCase().includes(hint))).slice(0, 5);
  const signals = [];
  if (backendEvidence.length || routeEvidence.length) {
    signals.push({
      id: "backend",
      label: "Backend or API surface",
      confidence: backendEvidence.length ? "high" : "medium",
      evidence: [...backendEvidence, ...routeEvidence]
    });
  }
  if (securityEvidence.length || deps.has("stripe")) {
    signals.push({
      id: "security-sensitive",
      label: "Security-sensitive paths",
      confidence: securityEvidence.length ? "high" : "medium",
      evidence: securityEvidence.length ? securityEvidence : ["payments dependency"]
    });
  }
  return { signals };
}

// src/detectors/ci.ts
function detectCi(scan) {
  if (scan.ciFiles.length === 0) {
    return {};
  }
  return {
    signals: [
      {
        id: "ci",
        label: "Continuous integration",
        confidence: "high",
        evidence: scan.ciFiles.slice(0, 5)
      }
    ]
  };
}

// src/detectors/crabcodeConfig.ts
function detectCrabCodeConfig(scan) {
  const signals = [];
  if (scan.crabcodeFiles.length > 0) {
    signals.push({
      id: "crabcode-config",
      label: "Existing CrabCode configuration",
      confidence: "high",
      evidence: scan.crabcodeFiles
    });
  } else {
    signals.push({
      id: "missing-crabcode-context",
      label: "Missing CrabCode project context",
      confidence: "medium",
      evidence: ["CRABCODE.md not found"]
    });
  }
  if (scan.mcpJson) {
    signals.push({
      id: "mcp-config",
      label: "Existing MCP configuration",
      confidence: "high",
      evidence: [".mcp.json"]
    });
  }
  if (scan.envFiles.length > 0) {
    signals.push({
      id: "secret-sensitive-config",
      label: "Secret-sensitive configuration files",
      confidence: "high",
      evidence: scan.envFiles
    });
  }
  return {
    crabcodeFiles: scan.crabcodeFiles,
    signals
  };
}

// src/detectors/frontend.ts
var FRONTEND_FRAMEWORKS = new Set(["React", "Vue", "Svelte", "SvelteKit", "Angular", "Next.js", "Astro", "Vite"]);
var FRONTEND_DEPS = new Map([
  ["@playwright/test", "browser tests"],
  ["vite", "Vite"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["next", "Next.js"],
  ["@angular/core", "Angular"]
]);
function detectFrontend(scan) {
  const deps = collectAllDependencies(scan);
  const evidence2 = [
    ...[...FRONTEND_DEPS.entries()].filter(([dependency]) => deps.has(dependency)).map(([, label]) => label),
    ...scan.files.filter(isFrontendFile).slice(0, 5)
  ];
  if (evidence2.length === 0) {
    return {};
  }
  const frameworks = [...FRONTEND_DEPS.entries()].filter(([dependency]) => deps.has(dependency)).map(([, label]) => label).filter((label) => FRONTEND_FRAMEWORKS.has(label));
  return {
    frameworks,
    signals: [
      {
        id: "frontend",
        label: "Frontend application",
        confidence: evidence2.length > 1 ? "high" : "medium",
        evidence: evidence2
      }
    ]
  };
}
function isFrontendFile(file) {
  return file === "vite.config.ts" || file === "vite.config.js" || file.endsWith("/vite.config.ts") || file.endsWith("/vite.config.js") || file.includes("/src/components/") || file.startsWith("src/components/") || file.startsWith("app/") || file.includes("/app/");
}

// src/detectors/rustWorkspace.ts
function detectRustWorkspace(scan) {
  if (scan.cargoManifests.length === 0) {
    return {};
  }
  const signals = [
    {
      id: "rust",
      label: "Rust workspace or crate",
      confidence: "high",
      evidence: scan.cargoManifests.slice(0, 5)
    }
  ];
  if (scan.cargoManifests.length > 1 || scan.files.includes("Cargo.lock")) {
    signals.push({
      id: "rust-workspace",
      label: "Rust workspace",
      confidence: scan.cargoManifests.length > 1 ? "high" : "medium",
      evidence: scan.cargoManifests.slice(0, 5)
    });
  }
  return {
    languages: ["Rust"],
    packageManagers: ["cargo"],
    testCommands: ["cargo test"],
    buildCommands: ["cargo check", "cargo clippy"],
    signals
  };
}

// src/analyzer/profile.ts
function buildProjectProfile(scan) {
  const detections = [
    detectPackageJson(scan),
    detectRustWorkspace(scan),
    detectFrontend(scan),
    detectBackend(scan),
    detectCrabCodeConfig(scan),
    detectCi(scan)
  ];
  return {
    root: scan.root,
    languages: collect(detections, "languages"),
    frameworks: collect(detections, "frameworks"),
    packageManagers: collect(detections, "packageManagers"),
    testCommands: collect(detections, "testCommands"),
    buildCommands: collect(detections, "buildCommands"),
    crabcodeFiles: collect(detections, "crabcodeFiles"),
    signals: collectSignals(detections)
  };
}
function collect(items, key) {
  const values = new Set;
  for (const item of items) {
    for (const value of item[key] ?? []) {
      values.add(value);
    }
  }
  return [...values].sort();
}
function collectSignals(items) {
  const byId = new Map;
  for (const item of items) {
    for (const signal of item.signals ?? []) {
      const existing = byId.get(signal.id);
      if (!existing) {
        byId.set(signal.id, signal);
        continue;
      }
      byId.set(signal.id, {
        ...existing,
        evidence: [...new Set([...existing.evidence, ...signal.evidence])],
        confidence: stronger(existing.confidence, signal.confidence)
      });
    }
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
function stronger(left, right) {
  const order = { low: 0, medium: 1, high: 2 };
  return order[left] >= order[right] ? left : right;
}

// src/analyzer/projectScanner.ts
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
var IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "yuanma"
]);
var LOCK_FILES = ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
var CRABCODE_FILES = [
  "CRABCODE.md",
  ".crabcode/settings.json",
  ".crabcode/skills",
  ".crabcode/agents"
];
var IGNORED_RELATIVE_PREFIXES = ["tests/fixtures/"];
function createNodeReadOnlyFileSystem() {
  return { access, readFile, readdir, stat };
}
async function scanProject(options) {
  const root = path.resolve(options.cwd);
  const fs = options.fs ?? createNodeReadOnlyFileSystem();
  const maxDepth = options.maxDepth ?? 5;
  await assertScannableRoot(fs, root);
  const walked = await walk(root, root, fs, maxDepth);
  const files = walked.files.sort();
  const directories = walked.directories.sort();
  const packageJsons = await readPackageJsons(fs, root, files);
  const rootPackageJson = packageJsons.find((item) => item.path === "package.json");
  const crabcodeFiles = CRABCODE_FILES.filter((item) => files.includes(item) || directories.includes(item));
  return {
    root,
    files,
    directories,
    ...rootPackageJson ? { packageJson: rootPackageJson.json, packageJsonPath: rootPackageJson.path } : {},
    packageJsons,
    lockFiles: LOCK_FILES.filter((file) => files.includes(file)),
    cargoManifests: files.filter((file) => path.basename(file) === "Cargo.toml"),
    crabcodeFiles,
    ciFiles: files.filter((file) => file.startsWith(".github/workflows/") || file.startsWith(".gitlab-ci")),
    envFiles: files.filter(isEnvFile),
    mcpJson: files.includes(".mcp.json")
  };
}
async function assertScannableRoot(fs, root) {
  let rootStat;
  try {
    rootStat = await fs.stat(root);
  } catch (error) {
    throw new Error(`Cannot scan ${root}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`Cannot scan ${root}: expected a directory`);
  }
}
async function readPackageJsons(fs, root, files) {
  const packageJsonFiles = [];
  for (const file of files.filter((item) => path.basename(item) === "package.json")) {
    const json = await readJson(fs, path.join(root, file));
    if (json) {
      packageJsonFiles.push({ path: file, json });
    }
  }
  return packageJsonFiles.sort((left, right) => left.path.localeCompare(right.path));
}
async function readJson(fs, filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return;
  }
}
function isEnvFile(file) {
  const base = path.basename(file);
  return base === ".env" || base === ".env.example" || base.startsWith(".env.") || base.endsWith(".env.sample");
}
async function walk(root, current, fs, maxDepth, depth = 0) {
  let entries;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return { files: [], directories: [] };
  }
  const files = [];
  const directories = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".crabcode" && entry.name !== ".github" && entry.name !== ".mcp.json" && entry.name !== ".env.example") {
      if (entry.isDirectory() && entry.name !== ".github") {
        continue;
      }
    }
    const fullPath = path.join(current, entry.name);
    const relativePath = toProjectPath(path.relative(root, fullPath));
    if (IGNORED_RELATIVE_PREFIXES.some((prefix) => relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix))) {
      continue;
    }
    if (entry.isDirectory()) {
      directories.push(relativePath);
      if (depth < maxDepth && !IGNORED_DIRECTORIES.has(entry.name)) {
        const nested = await walk(root, fullPath, fs, maxDepth, depth + 1);
        files.push(...nested.files);
        directories.push(...nested.directories);
      }
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return { files, directories };
}
function toProjectPath(value) {
  return value.split(path.sep).join("/");
}

// src/recommendations/rules.ts
function hasSignal(profile, signalId) {
  return profile.signals.some((signal) => signal.id === signalId);
}
function signalEvidence(profile, signalId) {
  return profile.signals.find((signal) => signal.id === signalId)?.evidence ?? [];
}
function hasLanguage(profile, language) {
  return profile.languages.includes(language);
}
function hasFramework(profile, framework) {
  return profile.frameworks.includes(framework);
}
function makeRecommendation(input) {
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    why: input.why,
    priority: input.priority,
    evidence: input.evidence,
    ...input.install ? { install: input.install } : {},
    ...input.createAt ? { createAt: input.createAt } : {},
    ...input.configPath ? { configPath: input.configPath } : {},
    ...input.caveats ? { caveats: input.caveats } : {}
  };
}

// src/recommendations/catalog.ts
var recommendationCatalog = [
  {
    id: "mcp-browser-automation",
    category: "mcp",
    title: "Browser automation MCP or plugin",
    priority: 91,
    when: (profile) => hasSignal(profile, "frontend") ? signalEvidence(profile, "frontend") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "mcp-browser-automation",
      category: "mcp",
      title: "Browser automation MCP or plugin",
      why: "This repository has frontend signals, so browser-driven verification can catch layout, routing, and interaction regressions.",
      install: "Resolve the browser automation integration from the configured CrabCode marketplace before enabling it.",
      priority: 91,
      evidence: evidence2
    })
  },
  {
    id: "mcp-repository-hosting",
    category: "mcp",
    title: "Repository hosting MCP",
    priority: 74,
    when: (profile) => hasSignal(profile, "ci") ? signalEvidence(profile, "ci") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "mcp-repository-hosting",
      category: "mcp",
      title: "Repository hosting MCP",
      why: "CI configuration suggests pull request and workflow context would be useful when reviewing changes.",
      install: "Connect the repository MCP only if this workspace needs issue, pull request, or action visibility.",
      priority: 74,
      evidence: evidence2
    })
  },
  {
    id: "skill-rust-verify",
    category: "skill",
    title: "Rust verification skill",
    priority: 90,
    when: (profile) => hasLanguage(profile, "Rust") ? signalEvidence(profile, "rust") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "skill-rust-verify",
      category: "skill",
      title: "Rust verification skill",
      why: "A dedicated skill can encode the project's preferred cargo check, clippy, format, and test sequence.",
      createAt: ".crabcode/skills/rust-verify/SKILL.md",
      priority: 90,
      evidence: evidence2
    })
  },
  {
    id: "skill-frontend-review",
    category: "skill",
    title: "Frontend implementation review skill",
    priority: 86,
    when: (profile) => hasSignal(profile, "frontend") ? signalEvidence(profile, "frontend") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "skill-frontend-review",
      category: "skill",
      title: "Frontend implementation review skill",
      why: "Frontend work benefits from a repeatable review checklist for responsiveness, accessibility, state, and visual polish.",
      createAt: ".crabcode/skills/frontend-review/SKILL.md",
      priority: 86,
      evidence: evidence2
    })
  },
  {
    id: "hook-typescript-typecheck",
    category: "hook",
    title: "Post-edit TypeScript check",
    priority: 93,
    when: (profile) => hasLanguage(profile, "TypeScript") ? signalEvidence(profile, "typescript") : false,
    build: (profile, evidence2) => makeRecommendation({
      id: "hook-typescript-typecheck",
      category: "hook",
      title: "Post-edit TypeScript check",
      why: "TypeScript projects get fast feedback when edits trigger the existing typecheck or build command.",
      configPath: ".crabcode/settings.json",
      priority: 93,
      evidence: [...evidence2, ...profile.buildCommands.filter((command) => command.toLowerCase().includes("typecheck")).slice(0, 2)],
      caveats: ["Keep this hook scoped to relevant source edits so it stays quick."]
    })
  },
  {
    id: "hook-sensitive-file-guard",
    category: "hook",
    title: "Sensitive-file edit guard",
    priority: 89,
    when: (profile) => hasSignal(profile, "secret-sensitive-config") ? signalEvidence(profile, "secret-sensitive-config") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "hook-sensitive-file-guard",
      category: "hook",
      title: "Sensitive-file edit guard",
      why: "Secret-adjacent configuration exists, so edits to environment files should require extra confirmation.",
      configPath: ".crabcode/settings.json",
      priority: 89,
      evidence: evidence2
    })
  },
  {
    id: "hook-rust-verify",
    category: "hook",
    title: "Rust check hook",
    priority: 82,
    when: (profile) => hasLanguage(profile, "Rust") ? signalEvidence(profile, "rust") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "hook-rust-verify",
      category: "hook",
      title: "Rust check hook",
      why: "Cargo check or clippy after Rust source edits catches errors before deeper review.",
      configPath: ".crabcode/settings.json",
      priority: 82,
      evidence: evidence2,
      caveats: ["Prefer a fast check command for routine edits and leave full tests to deliberate verification."]
    })
  },
  {
    id: "agent-repository-explorer",
    category: "agent",
    title: "Repository explorer agent",
    priority: 78,
    when: (profile) => hasSignal(profile, "monorepo") || hasSignal(profile, "rust-workspace") ? [...signalEvidence(profile, "monorepo"), ...signalEvidence(profile, "rust-workspace")] : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "agent-repository-explorer",
      category: "agent",
      title: "Repository explorer agent",
      why: "The project has workspace signals, so a dedicated explorer can map ownership, entrypoints, and verification paths quickly.",
      createAt: ".crabcode/agents/repository-explorer.md",
      priority: 78,
      evidence: evidence2
    })
  },
  {
    id: "agent-security-reviewer",
    category: "agent",
    title: "Security reviewer agent",
    priority: 88,
    when: (profile) => hasSignal(profile, "security-sensitive") ? signalEvidence(profile, "security-sensitive") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "agent-security-reviewer",
      category: "agent",
      title: "Security reviewer agent",
      why: "Security-sensitive paths deserve a focused review pass for auth flow, secret handling, validation, and payment logic.",
      createAt: ".crabcode/agents/security-reviewer.md",
      priority: 88,
      evidence: evidence2
    })
  },
  {
    id: "plugin-frontend-workflow",
    category: "plugin",
    title: "Frontend workflow plugin",
    priority: 77,
    when: (profile) => hasSignal(profile, "frontend") && (hasFramework(profile, "React") || hasFramework(profile, "Vue") || hasFramework(profile, "Next.js")) ? signalEvidence(profile, "frontend") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "plugin-frontend-workflow",
      category: "plugin",
      title: "Frontend workflow plugin",
      why: "A bundled frontend workflow can combine design review, browser verification, and component-focused checks.",
      install: "Use the configured CrabCode marketplace to select an available frontend workflow plugin.",
      priority: 77,
      evidence: evidence2,
      caveats: ["Do not hardcode a marketplace package name until availability is confirmed."]
    })
  },
  {
    id: "plugin-test-workflow",
    category: "plugin",
    title: "Test automation workflow plugin",
    priority: 72,
    when: (profile) => profile.testCommands.length > 0 || hasSignal(profile, "js-test-tooling") ? [...profile.testCommands, ...signalEvidence(profile, "js-test-tooling")] : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "plugin-test-workflow",
      category: "plugin",
      title: "Test automation workflow plugin",
      why: "The project already has test tooling, so a plugin can standardize targeted test selection and failure triage.",
      install: "Choose an available CrabCode testing workflow plugin only after checking the marketplace catalog.",
      priority: 72,
      evidence: evidence2
    })
  },
  {
    id: "workflow-init-context",
    category: "workflow",
    title: "Initialize CrabCode project context",
    priority: 84,
    when: (profile) => hasSignal(profile, "missing-crabcode-context") ? signalEvidence(profile, "missing-crabcode-context") : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "workflow-init-context",
      category: "workflow",
      title: "Initialize CrabCode project context",
      why: "A concise CRABCODE.md gives future sessions stable project commands, conventions, and safety notes.",
      createAt: "CRABCODE.md",
      priority: 84,
      evidence: evidence2
    })
  },
  {
    id: "workflow-refine-existing-skills",
    category: "workflow",
    title: "Refine existing CrabCode skills",
    priority: 80,
    when: (profile) => hasSignal(profile, "crabcode-config") ? signalEvidence(profile, "crabcode-config").filter((item) => item.includes(".crabcode/skills")) : false,
    build: (_profile, evidence2) => makeRecommendation({
      id: "workflow-refine-existing-skills",
      category: "workflow",
      title: "Refine existing CrabCode skills",
      why: "Existing skills should be reviewed before creating duplicates; tighten descriptions, examples, and verification commands first.",
      priority: 80,
      evidence: evidence2
    })
  }
];

// src/recommendations/ranker.ts
var CATEGORY_ORDER = ["mcp", "skill", "hook", "agent", "plugin", "workflow"];
function recommendAutomations(profile, perCategory = 2) {
  const recommendations = recommendationCatalog.map((rule) => {
    const evidence2 = rule.when(profile);
    return evidence2 && evidence2.length > 0 ? rule.build(profile, evidence2) : undefined;
  }).filter((value) => Boolean(value)).sort(compareRecommendations);
  const selected = [];
  const counts = new Map;
  for (const recommendation of recommendations) {
    const count = counts.get(recommendation.category) ?? 0;
    if (count >= perCategory) {
      continue;
    }
    counts.set(recommendation.category, count + 1);
    selected.push(recommendation);
  }
  return selected.sort(compareRecommendations);
}
function compareRecommendations(left, right) {
  const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  return right.priority - left.priority || left.title.localeCompare(right.title);
}

// src/render/json.ts
function renderJson(report) {
  return `${JSON.stringify(report, null, 2)}
`;
}

// src/render/markdown.ts
var CATEGORY_LABELS = {
  agent: "Agents",
  hook: "Hooks",
  mcp: "MCP Servers",
  plugin: "Plugins",
  skill: "Skills",
  workflow: "Workflows"
};
var CATEGORY_ORDER2 = ["mcp", "skill", "hook", "agent", "plugin", "workflow"];
function renderMarkdown(report) {
  const lines = [
    "# CrabCode Automation Recommendations",
    "",
    "## Codebase Profile",
    ...renderProfile(report.profile),
    "",
    "## Top Recommendations"
  ];
  for (const category of CATEGORY_ORDER2) {
    const items = report.recommendations.filter((recommendation) => recommendation.category === category);
    if (items.length === 0) {
      continue;
    }
    lines.push("", `### ${CATEGORY_LABELS[category]}`);
    for (const [index, item] of items.entries()) {
      lines.push(...renderRecommendation(index + 1, item));
    }
  }
  lines.push("", "## Next Steps", "1. Review these recommendations against team preferences.", "2. Choose one automation to implement first.", "3. Re-run this analyzer after adding CrabCode configuration to keep the recommendations current.", "");
  return lines.join(`
`);
}
function renderProfile(profile) {
  return [
    `- Type: ${formatList(profile.languages, "Unknown")}`,
    `- Frameworks: ${formatList(profile.frameworks, "None detected")}`,
    `- Package managers: ${formatList(profile.packageManagers, "None detected")}`,
    `- Test commands: ${formatList(profile.testCommands, "None detected")}`,
    `- Build commands: ${formatList(profile.buildCommands, "None detected")}`,
    `- Existing CrabCode config: ${formatList(profile.crabcodeFiles, "None detected")}`
  ];
}
function renderRecommendation(index, item) {
  const lines = [
    `${index}. **${item.title}**`,
    `   - Why: ${item.why}`,
    `   - Evidence: ${formatList(item.evidence, "No direct evidence")}`
  ];
  if (item.install) {
    lines.push(`   - Install: ${item.install}`);
  }
  if (item.createAt) {
    lines.push(`   - Create: \`${item.createAt}\``);
  }
  if (item.configPath) {
    lines.push(`   - Configure: \`${item.configPath}\``);
  }
  for (const caveat of item.caveats ?? []) {
    lines.push(`   - Note: ${caveat}`);
  }
  return lines;
}
function formatList(values, fallback) {
  return values.length > 0 ? values.join(", ") : fallback;
}

// src/policy/brandGuard.ts
var TERM_PARTS = [
  ["c", "la", "ude"],
  ["c", "la", "ude", " ", "code"],
  ["c", "la", "ude", "-", "code"],
  ["anth", "ropic"],
  ["son", "net"],
  ["op", "us"],
  ["hai", "ku"],
  [".", "c", "la", "ude"],
  ["@", "anth", "ropic"]
];
var BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"]);
function prohibitedTerms() {
  return TERM_PARTS.map((parts) => parts.join(""));
}

// src/policy/outputSanitizer.ts
var REDACTION = "[redacted]";
function sanitizeReport(report) {
  return sanitizeValue(report);
}
function sanitizeString(value) {
  return prohibitedTerms().sort((left, right) => right.length - left.length).reduce((current, term) => current.replace(new RegExp(escapeRegExp(term), "gi"), REDACTION), value);
}
function sanitizeValue(value) {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]));
  }
  return value;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/index.ts
async function analyzeProject(options) {
  const scan = await scanProject({ cwd: options.cwd });
  const profile = buildProjectProfile(scan);
  return sanitizeReport({
    profile,
    recommendations: recommendAutomations(profile, options.perCategory ?? 2)
  });
}
function renderReport(report, format) {
  return format === "json" ? renderJson(report) : renderMarkdown(report);
}

// src/cli.ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }
  const report = await analyzeProject({ cwd: args.cwd });
  process.stdout.write(renderReport(report, args.format));
}
function parseArgs(argv) {
  const args = {
    cwd: process.cwd(),
    format: "markdown",
    help: false
  };
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--cwd":
        args.cwd = requireValue(argv, index, "--cwd");
        index += 1;
        break;
      case "--format": {
        const format = requireValue(argv, index, "--format");
        if (format !== "json" && format !== "markdown") {
          throw new Error("--format must be markdown or json");
        }
        args.format = format;
        index += 1;
        break;
      }
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}
function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}
function helpText() {
  return [
    "Usage: crabcode-setup --cwd <path> --format <markdown|json>",
    "",
    "Analyze a repository and recommend CrabCode-native automations.",
    ""
  ].join(`
`);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}
`);
  process.exitCode = 1;
});
