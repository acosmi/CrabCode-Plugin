import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isCrabcodeNeutralName, isKebabCase } from "./pluginScan.ts";

export type Severity = "error" | "warning";

export type MarketplaceIssue = {
  severity: Severity;
  marketplacePath: string;
  entryName?: string | undefined;
  field?: string | undefined;
  message: string;
};

type RawEntry = {
  name?: unknown;
  source?: unknown;
  version?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  author?: unknown;
};

type RawMarketplace = {
  name?: unknown;
  owner?: unknown;
  metadata?: unknown;
  plugins?: unknown;
};

const REQUIRED_ENTRY_FIELDS = ["name", "source", "version", "description", "category", "tags"] as const;

export async function validateMarketplace(root: string): Promise<MarketplaceIssue[]> {
  const absRoot = path.resolve(root);
  const marketplacePath = path.join(absRoot, ".crabcode-plugin", "marketplace.json");
  const issues: MarketplaceIssue[] = [];

  let text: string;
  try {
    text = await readFile(marketplacePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      issues.push({
        severity: "warning",
        marketplacePath,
        message: ".crabcode-plugin/marketplace.json not found",
      });
      return issues;
    }
    issues.push({
      severity: "error",
      marketplacePath,
      message: `read error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return issues;
  }

  let parsed: RawMarketplace;
  try {
    parsed = JSON.parse(text) as RawMarketplace;
  } catch (err) {
    issues.push({
      severity: "error",
      marketplacePath,
      message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
    return issues;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    issues.push({
      severity: "error",
      marketplacePath,
      message: "marketplace must be an object",
    });
    return issues;
  }

  if (typeof parsed.name !== "string" || parsed.name.trim() === "") {
    issues.push({
      severity: "error",
      marketplacePath,
      field: "name",
      message: "marketplace name is required",
    });
  }

  if (!Array.isArray(parsed.plugins)) {
    issues.push({
      severity: "error",
      marketplacePath,
      field: "plugins",
      message: "marketplace.plugins must be an array",
    });
    return issues;
  }

  const categoryWhitelist = await loadCategoryWhitelist(absRoot, issues);

  const seenNames = new Set<string>();
  for (const [index, raw] of parsed.plugins.entries()) {
    const prefix = `plugins[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issues.push({
        severity: "error",
        marketplacePath,
        message: `${prefix} must be an object`,
      });
      continue;
    }
    const entry = raw as RawEntry;
    const name = typeof entry.name === "string" ? entry.name : undefined;

    for (const field of REQUIRED_ENTRY_FIELDS) {
      const value = entry[field];
      const present = field === "tags" ? Array.isArray(value) && value.length > 0 : isNonEmpty(value);
      if (!present) {
        issues.push({
          severity: "error",
          marketplacePath,
          entryName: name,
          field,
          message: `${prefix} missing required field "${field}"`,
        });
      }
    }

    if (name !== undefined) {
      if (seenNames.has(name)) {
        issues.push({
          severity: "error",
          marketplacePath,
          entryName: name,
          field: "name",
          message: `duplicate marketplace entry name "${name}"`,
        });
      }
      seenNames.add(name);
      if (!isKebabCase(name)) {
        issues.push({
          severity: "error",
          marketplacePath,
          entryName: name,
          field: "name",
          message: `entry name "${name}" must be kebab-case`,
        });
      }
      if (!isCrabcodeNeutralName(name)) {
        issues.push({
          severity: "error",
          marketplacePath,
          entryName: name,
          field: "name",
          message: `entry name "${name}" contains a banned identifier`,
        });
      }
    }

    if (
      categoryWhitelist &&
      typeof entry.category === "string" &&
      entry.category.trim() !== "" &&
      !categoryWhitelist.has(entry.category)
    ) {
      issues.push({
        severity: "error",
        marketplacePath,
        entryName: name,
        field: "category",
        message: `category "${entry.category}" is not declared in .crabcode-plugin/categories.json`,
      });
    }

    if (typeof entry.source === "string") {
      issues.push(...(await verifySource(absRoot, marketplacePath, name, entry.source)));
    }
  }

  return issues;
}

/**
 * Load the set of allowed category ids from `.crabcode-plugin/categories.json`.
 * Returns `null` when the file is absent (whitelist enforcement is skipped for
 * backward compatibility) or when it cannot be parsed (an error is recorded and
 * per-entry checks are skipped to avoid a flood of follow-on errors).
 */
async function loadCategoryWhitelist(
  absRoot: string,
  issues: MarketplaceIssue[],
): Promise<Set<string> | null> {
  const categoriesPath = path.join(absRoot, ".crabcode-plugin", "categories.json");

  let text: string;
  try {
    text = await readFile(categoriesPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    issues.push({
      severity: "error",
      marketplacePath: categoriesPath,
      message: `read error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    issues.push({
      severity: "error",
      marketplacePath: categoriesPath,
      message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }

  if (!Array.isArray(parsed)) {
    issues.push({
      severity: "error",
      marketplacePath: categoriesPath,
      message: "categories.json must be an array",
    });
    return null;
  }

  const ids = new Set<string>();
  for (const [index, raw] of parsed.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issues.push({
        severity: "error",
        marketplacePath: categoriesPath,
        message: `categories[${index}] must be an object`,
      });
      continue;
    }
    const id = (raw as { id?: unknown }).id;
    if (typeof id !== "string" || id.trim() === "") {
      issues.push({
        severity: "error",
        marketplacePath: categoriesPath,
        field: "id",
        message: `categories[${index}] missing string "id"`,
      });
      continue;
    }
    if (ids.has(id)) {
      issues.push({
        severity: "error",
        marketplacePath: categoriesPath,
        entryName: id,
        field: "id",
        message: `duplicate category id "${id}"`,
      });
    }
    ids.add(id);
  }

  return ids;
}

async function verifySource(
  root: string,
  marketplacePath: string,
  entryName: string | undefined,
  source: string,
): Promise<MarketplaceIssue[]> {
  const issues: MarketplaceIssue[] = [];
  if (!source.startsWith("./")) {
    issues.push({
      severity: "error",
      marketplacePath,
      entryName,
      field: "source",
      message: `source "${source}" must start with "./" (relative to repo root)`,
    });
  }
  const resolved = path.resolve(root, source);
  if (!resolved.startsWith(root)) {
    issues.push({
      severity: "error",
      marketplacePath,
      entryName,
      field: "source",
      message: `source "${source}" escapes the marketplace root`,
    });
    return issues;
  }
  try {
    const stats = await stat(resolved);
    if (!stats.isDirectory()) {
      issues.push({
        severity: "error",
        marketplacePath,
        entryName,
        field: "source",
        message: `source "${source}" is not a directory`,
      });
      return issues;
    }
  } catch {
    issues.push({
      severity: "error",
      marketplacePath,
      entryName,
      field: "source",
      message: `source "${source}" does not exist`,
    });
    return issues;
  }

  const manifestPath = path.join(resolved, ".crabcode-plugin", "plugin.json");
  try {
    const manifestText = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText) as { name?: unknown };
    if (typeof manifest.name !== "string") {
      issues.push({
        severity: "error",
        marketplacePath,
        entryName,
        field: "source",
        message: `${path.relative(root, manifestPath)} missing string name`,
      });
    } else if (entryName !== undefined && manifest.name !== entryName) {
      issues.push({
        severity: "error",
        marketplacePath,
        entryName,
        field: "name",
        message: `entry name "${entryName}" does not match manifest name "${manifest.name}" at ${path.relative(root, manifestPath)}`,
      });
    }
  } catch (err) {
    issues.push({
      severity: "error",
      marketplacePath,
      entryName,
      field: "source",
      message: `cannot read manifest for source "${source}": ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return issues;
}

function isNonEmpty(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

export function formatMarketplaceIssues(issues: MarketplaceIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.marketplacePath);
      const entry = issue.entryName ? ` (${issue.entryName})` : "";
      const field = issue.field ? ` [${issue.field}]` : "";
      return `${issue.severity.toUpperCase()} ${rel}${entry}${field}: ${issue.message}`;
    })
    .join("\n");
}
