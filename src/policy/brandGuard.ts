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

// A reviewed exception: a functional third-party endpoint or false positive that
// must keep a prohibited term until the tracked follow-up lands. Precision is
// file+term so any NEW term appearing in the same file still gets reported.
export type BrandAllowlistEntry = {
  file: string;
  terms: string[];
  reason: string;
  tracking: string;
};

export type BrandScanReport = {
  violations: BrandViolation[];
  staleAllowlistEntries: BrandAllowlistEntry[];
};

const ALLOWLIST_FILE = "brand-allowlist.json";

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
  "brand-allowlist.json",
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
  return (await scanPathDetailed(targetPath, options)).violations;
}

export async function scanPathDetailed(
  targetPath: string,
  options: BrandScanOptions = {},
): Promise<BrandScanReport> {
  const root = path.resolve(targetPath);
  const ignores = [...DEFAULT_IGNORES, ...(options.ignore ?? [])];
  const stats = await stat(root);
  if (stats.isFile()) {
    return { violations: await scanFile(root, path.dirname(root), ignores), staleAllowlistEntries: [] };
  }

  const files = await listFiles(root, root, ignores);
  const results = await Promise.all(files.map((file) => scanFile(file, root, ignores)));
  const raw = results.flat();

  const allowlist = await loadAllowlist(root);
  if (allowlist.length === 0) {
    return { violations: raw, staleAllowlistEntries: [] };
  }

  const usedEntries = new Set<BrandAllowlistEntry>();
  const violations = raw.filter((violation) => {
    const entry = allowlist.find(
      (candidate) =>
        candidate.file === violation.file &&
        candidate.terms.some((term) => term.toLowerCase() === violation.term.toLowerCase()),
    );
    if (entry) {
      usedEntries.add(entry);
      return false;
    }
    return true;
  });

  return {
    violations,
    staleAllowlistEntries: allowlist.filter((entry) => !usedEntries.has(entry)),
  };
}

// Malformed files and malformed entries are dropped (fail closed): the hits they
// were meant to cover resurface as violations instead of being silently allowed.
async function loadAllowlist(root: string): Promise<BrandAllowlistEntry[]> {
  let raw: string;
  try {
    raw = await readFile(path.join(root, ALLOWLIST_FILE), "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isAllowlistEntry).map((entry) => ({
    ...entry,
    file: normalizePath(entry.file),
  }));
}

function isAllowlistEntry(value: unknown): value is BrandAllowlistEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.file === "string" &&
    Array.isArray(entry.terms) &&
    entry.terms.length > 0 &&
    entry.terms.every((term) => typeof term === "string") &&
    typeof entry.reason === "string" &&
    typeof entry.tracking === "string"
  );
}

export function formatBrandViolations(violations: BrandViolation[]): string {
  return violations
    .map((violation) => `${violation.file}:${violation.line}:${violation.column} ${violation.term} ${violation.excerpt}`)
    .join("\n");
}

export function formatStaleAllowlistEntries(entries: BrandAllowlistEntry[]): string {
  return entries
    .map(
      (entry) =>
        `STALE-ALLOWLIST ${entry.file} [${entry.terms.join(", ")}] 未命中任何违规,条目已失效请清理(tracking: ${entry.tracking})`,
    )
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
