import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

export type PluginManifest = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  author?: unknown;
  license?: unknown;
  keywords?: unknown;
  skills?: unknown;
  hooks?: unknown;
  mcpServers?: unknown;
  apps?: unknown;
  interface?: unknown;
};

export type ManifestRecord = {
  manifestPath: string;
  pluginDir: string;
  manifest: PluginManifest | null;
  parseError: string | null;
};

const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "templates",
  "yuanma",
  "bangong",
]);

export async function findPluginManifests(root: string): Promise<ManifestRecord[]> {
  const absRoot = path.resolve(root);
  const records: ManifestRecord[] = [];
  await walk(absRoot, absRoot, records);
  return records.sort((a, b) => a.manifestPath.localeCompare(b.manifestPath));
}

async function walk(root: string, current: string, out: ManifestRecord[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  const hasCrabcodePluginDir = entries.some(
    (entry) => entry.isDirectory() && entry.name === ".crabcode-plugin",
  );
  if (hasCrabcodePluginDir) {
    const manifestPath = path.join(current, ".crabcode-plugin", "plugin.json");
    try {
      const stats = await stat(manifestPath);
      if (stats.isFile()) {
        out.push(await loadManifest(manifestPath, current));
      }
    } catch {
      out.push({
        manifestPath,
        pluginDir: current,
        manifest: null,
        parseError: "missing plugin.json",
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SCAN_SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;
    await walk(root, path.join(current, entry.name), out);
  }
}

async function loadManifest(manifestPath: string, pluginDir: string): Promise<ManifestRecord> {
  let text: string;
  try {
    text = await readFile(manifestPath, "utf8");
  } catch (err) {
    return {
      manifestPath,
      pluginDir,
      manifest: null,
      parseError: `read error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  try {
    const parsed = JSON.parse(text) as PluginManifest;
    return { manifestPath, pluginDir, manifest: parsed, parseError: null };
  } catch (err) {
    return {
      manifestPath,
      pluginDir,
      manifest: null,
      parseError: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function isKebabCase(value: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value);
}

export function isCrabcodeNeutralName(value: string): boolean {
  const lower = value.toLowerCase();
  const banned = ["c" + "laude", "anth" + "ropic", "." + "c" + "laude", "c" + "laude" + "-code"];
  return !banned.some((term) => lower.includes(term));
}
