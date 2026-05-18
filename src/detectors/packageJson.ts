import type { DetectionResult, PackageJson, ProjectScan, ProjectSignal } from "../types.ts";

const PACKAGE_MANAGERS: Record<string, string> = {
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "package-lock.json": "npm",
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
};

const FRAMEWORK_DEPS: Record<string, string> = {
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
  vue: "Vue",
};

const TEST_DEPS = ["@playwright/test", "vitest", "jest", "mocha", "cypress"];

export function detectPackageJson(scan: ProjectScan): DetectionResult {
  if (scan.packageJsons.length === 0) {
    return {};
  }

  const deps = collectAllDependencies(scan);
  const languages = new Set<string>(["JavaScript"]);
  const frameworks = new Set<string>();
  const testCommands: string[] = [];
  const buildCommands: string[] = [];
  const signals: ProjectSignal[] = [
    {
      id: "package-json",
      label: "Node package metadata",
      confidence: "high" as const,
      evidence: scan.packageJsons.map((item) => item.path).slice(0, 5),
    },
  ];

  if (deps.has("typescript") || scan.files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx"))) {
    languages.add("TypeScript");
    signals.push({
      id: "typescript",
      label: "TypeScript project",
      confidence: "high",
      evidence: evidence([
        ...scan.packageJsons.filter((item) => collectDependencies(item.json).has("typescript")).map((item) => item.path),
        ...scan.files.filter((file) => pathLooksLikeTsConfig(file)),
      ]),
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
      evidence: TEST_DEPS.filter((dependency) => deps.has(dependency)),
    });
  }

  const workspaces = scan.packageJsons.filter((item) => isWorkspace(item.json));
  if (workspaces.length > 0 || scan.packageJsons.length > 1) {
    signals.push({
      id: "monorepo",
      label: "Workspace or monorepo layout",
      confidence: workspaces.length > 0 ? "medium" : "low",
      evidence: workspaces.length > 0 ? workspaces.map((item) => `${item.path} workspaces`) : scan.packageJsons.map((item) => item.path).slice(0, 5),
    });
  }

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    packageManagers: scan.lockFiles.map((file) => PACKAGE_MANAGERS[file]).filter((value): value is string => Boolean(value)),
    testCommands,
    buildCommands,
    signals,
  };
}

export function collectAllDependencies(scan: ProjectScan): Set<string> {
  return new Set(scan.packageJsons.flatMap((item) => [...collectDependencies(item.json)]));
}

export function collectDependencies(packageJson: PackageJson): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
}

function isTestScript(name: string, command: string, deps: Set<string>): boolean {
  const text = `${name} ${command}`.toLowerCase();
  return text.includes("test") || TEST_DEPS.some((dependency) => deps.has(dependency) && text.includes(dependency.split("/").pop() ?? dependency));
}

function isBuildScript(name: string, command: string): boolean {
  const text = `${name} ${command}`.toLowerCase();
  return text.includes("build") || text.includes("typecheck") || text.includes("lint");
}

function isWorkspace(packageJson: PackageJson): boolean {
  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces.length > 0;
  }
  return Boolean(packageJson.workspaces && typeof packageJson.workspaces === "object" && packageJson.workspaces.packages?.length);
}

function evidence(values: string[]): string[] {
  return values.length ? values : ["package.json"];
}

function pathLooksLikeTsConfig(file: string): boolean {
  return file === "tsconfig.json" || file.endsWith("/tsconfig.json");
}

function formatScriptEvidence(packageJsonPath: string, name: string, command: string): string {
  return packageJsonPath === "package.json"
    ? `${name}: ${command}`
    : `${packageJsonPath} ${name}: ${command}`;
}
