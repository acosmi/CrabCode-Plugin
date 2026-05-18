import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { PackageJson, PackageJsonFile, ProjectScan } from "../types.ts";
import type { ReadOnlyFileSystem } from "../policy/readOnlyGuard.ts";

export type ScanOptions = {
  cwd: string;
  maxDepth?: number;
  fs?: ReadOnlyFileSystem;
};

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "yuanma",
]);

const LOCK_FILES = ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
const CRABCODE_FILES = [
  "CRABCODE.md",
  ".crabcode/settings.json",
  ".crabcode/skills",
  ".crabcode/agents",
];

const IGNORED_RELATIVE_PREFIXES = ["tests/fixtures/"];

export function createNodeReadOnlyFileSystem(): ReadOnlyFileSystem {
  return { access, readFile, readdir, stat };
}

export async function scanProject(options: ScanOptions): Promise<ProjectScan> {
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
    ...(rootPackageJson ? { packageJson: rootPackageJson.json, packageJsonPath: rootPackageJson.path } : {}),
    packageJsons,
    lockFiles: LOCK_FILES.filter((file) => files.includes(file)),
    cargoManifests: files.filter((file) => path.basename(file) === "Cargo.toml"),
    crabcodeFiles,
    ciFiles: files.filter((file) => file.startsWith(".github/workflows/") || file.startsWith(".gitlab-ci")),
    envFiles: files.filter(isEnvFile),
    mcpJson: files.includes(".mcp.json"),
  };
}

async function assertScannableRoot(fs: ReadOnlyFileSystem, root: string): Promise<void> {
  let rootStat: Awaited<ReturnType<ReadOnlyFileSystem["stat"]>>;
  try {
    rootStat = await fs.stat(root);
  } catch (error) {
    throw new Error(`Cannot scan ${root}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!rootStat.isDirectory()) {
    throw new Error(`Cannot scan ${root}: expected a directory`);
  }
}

async function readPackageJsons(
  fs: ReadOnlyFileSystem,
  root: string,
  files: string[],
): Promise<PackageJsonFile[]> {
  const packageJsonFiles: PackageJsonFile[] = [];
  for (const file of files.filter((item) => path.basename(item) === "package.json")) {
    const json = await readJson<PackageJson>(fs, path.join(root, file));
    if (json) {
      packageJsonFiles.push({ path: file, json });
    }
  }
  return packageJsonFiles.sort((left, right) => left.path.localeCompare(right.path));
}

async function readJson<T>(fs: ReadOnlyFileSystem, filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function isEnvFile(file: string): boolean {
  const base = path.basename(file);
  return base === ".env" || base === ".env.example" || base.startsWith(".env.") || base.endsWith(".env.sample");
}

async function walk(
  root: string,
  current: string,
  fs: ReadOnlyFileSystem,
  maxDepth: number,
  depth = 0,
): Promise<{ files: string[]; directories: string[] }> {
  let entries: Awaited<ReturnType<ReadOnlyFileSystem["readdir"]>>;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return { files: [], directories: [] };
  }

  const files: string[] = [];
  const directories: string[] = [];

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

function toProjectPath(value: string): string {
  return value.split(path.sep).join("/");
}
