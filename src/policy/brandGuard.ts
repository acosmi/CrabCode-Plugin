import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

export type BrandViolation = {
  file: string;
  line: number;
  column: number;
  term: string;
  excerpt: string;
};

export type BrandScanOptions = {
  ignore?: string[];
};

const TERM_PARTS = [
  ["c", "la", "ude"],
  ["c", "la", "ude", " ", "code"],
  ["c", "la", "ude", "-", "code"],
  ["anth", "ropic"],
  ["son", "net"],
  ["op", "us"],
  ["hai", "ku"],
  ["co", "dex"],
  [".", "c", "la", "ude"],
  [".", "co", "dex"],
  ["@", "anth", "ropic"],
];

const DEFAULT_IGNORES = [
  ".git/**",
  ".window-*-workdir/**",
  "bangong/**",
  "coverage/**",
  "**/coverage/**",
  "dist/**",
  "**/dist/**",
  "docs/audit/**",
  "docs/huibao/**",
  "docs/legal/**",
  "**/docs/legal/**",
  "docs/**implementation-plan*.md",
  "docs/**实施方案*.md",
  "docs/**执行日志*.md",
  "node_modules/**",
  "**/node_modules/**",
  "vendor/**",
  "**/vendor/**",
  "yuanma/**",
];

const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"]);

export function prohibitedTerms(): string[] {
  return TERM_PARTS.map((parts) => parts.join(""));
}

export function scanText(text: string, file = "input"): BrandViolation[] {
  const violations: BrandViolation[] = [];
  const lines = text.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const term of prohibitedTerms()) {
      const index = line.toLowerCase().indexOf(term.toLowerCase());
      if (index >= 0) {
        violations.push({
          file,
          line: lineIndex + 1,
          column: index + 1,
          term,
          excerpt: line.trim(),
        });
      }
    }
  }
  return violations;
}

export async function scanPath(targetPath: string, options: BrandScanOptions = {}): Promise<BrandViolation[]> {
  const root = path.resolve(targetPath);
  const ignores = [...DEFAULT_IGNORES, ...(options.ignore ?? [])];
  const stats = await stat(root);
  if (stats.isFile()) {
    return scanFile(root, path.dirname(root), ignores);
  }

  const files = await listFiles(root, root, ignores);
  const results = await Promise.all(files.map((file) => scanFile(file, root, ignores)));
  return results.flat();
}

export function formatBrandViolations(violations: BrandViolation[]): string {
  return violations
    .map((violation) => `${violation.file}:${violation.line}:${violation.column} ${violation.term} ${violation.excerpt}`)
    .join("\n");
}

async function scanFile(filePath: string, root: string, ignores: string[]): Promise<BrandViolation[]> {
  const relative = normalizePath(path.relative(root, filePath));
  if (isIgnored(relative, ignores) || BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return [];
  }
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return [];
  }
  return scanText(text, relative || path.basename(filePath));
}

async function listFiles(root: string, current: string, ignores: string[]): Promise<string[]> {
  const relative = normalizePath(path.relative(root, current));
  if (relative && isIgnored(`${relative}/`, ignores)) {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const childRelative = normalizePath(path.relative(root, fullPath));
    if (isIgnored(entry.isDirectory() ? `${childRelative}/` : childRelative, ignores)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath, ignores)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function isIgnored(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(relativePath, normalizePath(pattern)));
}

function matchesPattern(relativePath: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    return globToRegExp(pattern).test(relativePath);
  }
  return relativePath === pattern || relativePath.startsWith(`${pattern}/`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? "";
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else {
      source += escapeRegex(char);
    }
  }
  source += "$";
  return new RegExp(source);
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}
