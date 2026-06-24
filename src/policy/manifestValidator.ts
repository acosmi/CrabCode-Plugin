import path from "node:path";
import { findPluginManifests, isKebabCase, isCrabcodeNeutralName } from "./pluginScan.ts";
import type { ManifestRecord, PluginManifest } from "./pluginScan.ts";

export type Severity = "error" | "warning";

export type ManifestIssue = {
  severity: Severity;
  manifestPath: string;
  pluginDir: string;
  field?: string | undefined;
  message: string;
};

const REQUIRED_FIELDS = ["name", "version", "description", "author", "license", "keywords"] as const;
const HARD_REQUIRED = new Set(["name", "version", "description", "author"]);

const LEGACY_RELAXED_PLUGINS = new Set([
  "matter-core",
  "cn-contract",
  "cn-data-compliance",
  "cn-labor-employment",
  "crabcode-security-review",
]);

// CrabCode loader auto-loads these standard locations when the manifest OMITS the
// field. Declaring a field whose value equals its standard auto-load path is always
// redundant and, for hooks/agents, actively breaks runtime loading:
//   - hooks: ./hooks/hooks.json is loaded unconditionally -> a manifest reference to
//     the same path triggers "Duplicate hooks file detected" (loader strict error).
//   - agents: the standard ./agents directory is auto-scanned; the manifest `agents`
//     field is .md-file-only by schema, so a directory value fails manifest validation.
//   - commands/skills: directory auto-loaded when omitted -> declaring the standard
//     directory is redundant noise.
// This lint catches the recurring porting mistake (upstream plugins that ship an
// explicit standard-path declaration) at source-repo CI time, before it reaches users.
const STANDARD_AUTOLOAD_DECLARATIONS: ReadonlyArray<{ field: string; standard: readonly string[] }> = [
  { field: "hooks", standard: ["./hooks/hooks.json"] },
  { field: "agents", standard: ["./agents"] },
  { field: "commands", standard: ["./commands"] },
  { field: "skills", standard: ["./skills"] },
];

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export async function validateManifests(root: string): Promise<ManifestIssue[]> {
  const records = await findPluginManifests(root);
  const issues: ManifestIssue[] = [];
  for (const record of records) {
    issues.push(...inspectRecord(record, root));
  }
  return issues;
}

function inspectRecord(record: ManifestRecord, root: string): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const relativeDir = path.relative(root, record.pluginDir) || ".";

  if (record.parseError) {
    issues.push({
      severity: "error",
      manifestPath: record.manifestPath,
      pluginDir: record.pluginDir,
      message: record.parseError,
    });
    return issues;
  }

  const manifest = record.manifest as PluginManifest | null;
  if (!manifest || typeof manifest !== "object") {
    issues.push({
      severity: "error",
      manifestPath: record.manifestPath,
      pluginDir: record.pluginDir,
      message: "manifest is not an object",
    });
    return issues;
  }

  const name = typeof manifest.name === "string" ? manifest.name : null;
  const isLegacy = name !== null && LEGACY_RELAXED_PLUGINS.has(name);

  for (const field of REQUIRED_FIELDS) {
    const value = manifest[field];
    const present = field === "keywords" ? Array.isArray(value) && value.length > 0 : isNonEmpty(value);
    if (!present) {
      const severity: Severity =
        HARD_REQUIRED.has(field) || !isLegacy ? "error" : "warning";
      issues.push({
        severity,
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field,
        message: `manifest missing required field "${field}"`,
      });
    }
  }

  if (name !== null) {
    if (!isKebabCase(name)) {
      issues.push({
        severity: "error",
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field: "name",
        message: `manifest name "${name}" must be kebab-case`,
      });
    }
    if (!isCrabcodeNeutralName(name)) {
      issues.push({
        severity: "error",
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field: "name",
        message: `manifest name "${name}" contains a banned identifier`,
      });
    }
    const dirBase = path.basename(record.pluginDir);
    if (dirBase !== "." && dirBase !== name && relativeDir !== ".") {
      issues.push({
        severity: "error",
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field: "name",
        message: `manifest name "${name}" must equal plugin directory "${dirBase}"`,
      });
    }
  }

  const manifestFields = manifest as Record<string, unknown>;
  for (const { field, standard } of STANDARD_AUTOLOAD_DECLARATIONS) {
    const value = manifestFields[field];
    if (typeof value === "string" && standard.includes(stripTrailingSlash(value))) {
      issues.push({
        severity: "error",
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field,
        message: `manifest "${field}" declares the standard auto-loaded path "${value}"; the standard ${field}/ location is loaded automatically — remove this redundant declaration (it triggers duplicate-load / schema errors at runtime)`,
      });
    }
  }

  if (manifest.author !== undefined) {
    if (typeof manifest.author !== "object" || manifest.author === null) {
      issues.push({
        severity: "error",
        manifestPath: record.manifestPath,
        pluginDir: record.pluginDir,
        field: "author",
        message: `manifest author must be an object`,
      });
    } else {
      const author = manifest.author as { name?: unknown };
      if (typeof author.name !== "string" || author.name.trim() === "") {
        issues.push({
          severity: "error",
          manifestPath: record.manifestPath,
          pluginDir: record.pluginDir,
          field: "author.name",
          message: `manifest author.name is required`,
        });
      }
    }
  }

  return issues;
}

function isNonEmpty(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

export function formatManifestIssues(issues: ManifestIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.manifestPath);
      const field = issue.field ? ` [${issue.field}]` : "";
      return `${issue.severity.toUpperCase()} ${rel}${field}: ${issue.message}`;
    })
    .join("\n");
}
