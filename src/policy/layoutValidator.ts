import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { findPluginManifests, isCrabcodeNeutralName, isKebabCase } from "./pluginScan.ts";

export type Severity = "error" | "warning";

export type LayoutIssue = {
  severity: Severity;
  pluginDir: string;
  message: string;
};

const APPROVED_NESTED_FAMILIES = new Set(["crablaw-cn"]);

export async function validateLayout(root: string): Promise<LayoutIssue[]> {
  const absRoot = path.resolve(root);
  const issues: LayoutIssue[] = [];
  const pluginsDir = path.join(absRoot, "plugins");

  let entries: string[] = [];
  try {
    entries = await readdir(pluginsDir);
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = path.join(pluginsDir, entry);
    let stats;
    try {
      stats = await stat(fullPath);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;

    const relativeToPlugins = path.relative(pluginsDir, fullPath);
    if (!isKebabCase(entry)) {
      issues.push({
        severity: "error",
        pluginDir: fullPath,
        message: `plugins/${entry}: directory name must be kebab-case`,
      });
    }
    if (!isCrabcodeNeutralName(entry)) {
      issues.push({
        severity: "error",
        pluginDir: fullPath,
        message: `plugins/${entry}: directory name contains a banned identifier`,
      });
    }

    const directManifest = path.join(fullPath, ".crabcode-plugin", "plugin.json");
    let hasDirectManifest = false;
    try {
      const manifestStat = await stat(directManifest);
      hasDirectManifest = manifestStat.isFile();
    } catch {
      hasDirectManifest = false;
    }

    if (!hasDirectManifest) {
      if (APPROVED_NESTED_FAMILIES.has(entry)) {
        await checkFamily(fullPath, entry, issues);
      } else {
        issues.push({
          severity: "error",
          pluginDir: fullPath,
          message: `plugins/${entry}: missing .crabcode-plugin/plugin.json and not on the nested-family allow list`,
        });
      }
    }

    void relativeToPlugins;
  }

  const records = await findPluginManifests(absRoot);
  for (const record of records) {
    const relPlugin = path.relative(absRoot, record.pluginDir) || ".";
    if (relPlugin === ".") continue;
    if (!relPlugin.startsWith("plugins" + path.sep) && relPlugin !== "plugins") {
      issues.push({
        severity: "error",
        pluginDir: record.pluginDir,
        message: `plugin manifest at ${relPlugin} must live under plugins/`,
      });
    }
    const dirName = path.basename(record.pluginDir);
    if (!isCrabcodeNeutralName(dirName)) {
      issues.push({
        severity: "error",
        pluginDir: record.pluginDir,
        message: `${relPlugin}: directory name contains a banned identifier`,
      });
    }
  }

  return issues;
}

async function checkFamily(
  familyDir: string,
  familyName: string,
  issues: LayoutIssue[],
): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await readdir(familyDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const childDir = path.join(familyDir, entry);
    let stats;
    try {
      stats = await stat(childDir);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;
    if (!isKebabCase(entry)) {
      issues.push({
        severity: "error",
        pluginDir: childDir,
        message: `plugins/${familyName}/${entry}: directory name must be kebab-case`,
      });
    }
    if (!isCrabcodeNeutralName(entry)) {
      issues.push({
        severity: "error",
        pluginDir: childDir,
        message: `plugins/${familyName}/${entry}: directory name contains a banned identifier`,
      });
    }
  }
}

export function formatLayoutIssues(issues: LayoutIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.pluginDir);
      return `${issue.severity.toUpperCase()} ${rel || "."}: ${issue.message}`;
    })
    .join("\n");
}
