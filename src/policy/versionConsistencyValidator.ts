import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Cross-file version consistency for every published plugin.
 *
 * A plugin declares its version in up to three places and nothing used to
 * compare them, so a bump that touched only some of them drifted silently:
 *   1. `.crabcode-plugin/marketplace.json` — the entry consumers resolve
 *   2. `<source>/.crabcode-plugin/plugin.json` — the plugin's own manifest
 *   3. `<source>/package.json` — the npm package, present for 25 of 76 plugins
 *
 * Only versions are compared. Package names legitimately differ from plugin
 * names (`discord` ships as `crabcode-channel-discord`), and a plugin without
 * a package.json simply skips leg 3 — absence is not a finding.
 *
 * Legacy drift is frozen in a shrink-only baseline: baselined entries downgrade
 * to warnings, NEW drift is an error, and a baseline entry that no longer drifts
 * is itself an error so the set ratchets to empty instead of rotting.
 *
 * A missing/unparseable marketplace.json yields no issues here — marketplaceValidator
 * owns that check, and duplicating it would double-report the same defect.
 */

export type VersionConsistencyIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

/**
 * Plugins whose package.json version predates this gate.
 *
 * `crabcode-setup` publishes from the repo root: package.json is at 0.3.0 while
 * its manifest and marketplace entry are at 0.1.0. Reconciling them is a release
 * decision (raising the marketplace version republishes to every consumer), so it
 * is baselined rather than silently rewritten.
 */
const PACKAGE_VERSION_BASELINE = new Set<string>(["crabcode-setup"]);

type MarketplaceEntry = {
  name?: unknown;
  source?: unknown;
  version?: unknown;
};

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** `"./"` means the repo root itself; every other source is a repo-relative directory. */
function resolveSourceDir(root: string, source: string): string {
  const trimmed = source.replace(/^\.\//, "").replace(/\/+$/, "");
  return trimmed.length === 0 ? root : path.join(root, trimmed);
}

function readVersion(manifest: Record<string, unknown> | null): string | null {
  const raw = manifest?.version;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export async function validateVersionConsistency(
  root: string,
): Promise<VersionConsistencyIssue[]> {
  const issues: VersionConsistencyIssue[] = [];
  const marketplacePath = path.join(root, ".crabcode-plugin", "marketplace.json");
  if (!existsSync(marketplacePath)) return issues;

  const marketplace = await readJson(marketplacePath);
  const entries = marketplace?.plugins;
  if (!Array.isArray(entries)) return issues;

  /** Baselined plugins actually present and comparable in *this* root. */
  const evaluatedBaseline = new Set<string>();
  /** Of those, the ones still drifting. */
  const driftingBaseline = new Set<string>();

  for (const raw of entries as MarketplaceEntry[]) {
    const name = typeof raw?.name === "string" ? raw.name : null;
    const source = typeof raw?.source === "string" ? raw.source : null;
    if (!name || !source) continue; // shape is marketplaceValidator's job

    const dir = resolveSourceDir(root, source);
    const manifestPath = path.join(dir, ".crabcode-plugin", "plugin.json");
    const relManifest = path.relative(root, manifestPath) || manifestPath;

    if (!existsSync(manifestPath)) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `marketplace entry "${name}" resolves to ${source} but no plugin manifest exists there`,
      });
      continue;
    }

    const manifest = await readJson(manifestPath);
    if (manifest === null) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `plugin manifest for "${name}" is not valid JSON`,
      });
      continue;
    }

    const manifestVersion = readVersion(manifest);
    if (manifestVersion === null) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `plugin manifest for "${name}" has no usable version (must be a non-empty string)`,
      });
      continue;
    }

    // A present-but-non-string version defeats comparison entirely, and
    // marketplaceValidator's required-field check accepts it (isNonEmpty treats any
    // non-null as present). Comparison is this validator's job, so it owns the type.
    if (raw.version !== undefined && typeof raw.version !== "string") {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `"${name}" version must be a string, got ${typeof raw.version}`,
      });
    } else if (typeof raw.version === "string" && raw.version !== manifestVersion) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `"${name}" version ${raw.version} != plugin.json ${manifestVersion}`,
      });
    }

    // Leg 3 — only for plugins that ship an npm package.
    const packagePath = path.join(dir, "package.json");
    if (!existsSync(packagePath)) continue;

    const pkg = await readJson(packagePath);
    const relPackage = path.relative(root, packagePath) || packagePath;
    if (pkg === null) {
      issues.push({
        severity: "error",
        path: relPackage,
        message: `package.json for "${name}" is not valid JSON`,
      });
      continue;
    }

    const packageVersion = readVersion(pkg);
    if (packageVersion === null) {
      issues.push({
        severity: "error",
        path: relPackage,
        message: `package.json for "${name}" has no usable version (must be a non-empty string)`,
      });
      continue;
    }

    const baselined = PACKAGE_VERSION_BASELINE.has(name);
    if (baselined) evaluatedBaseline.add(name);

    if (packageVersion !== manifestVersion) {
      if (baselined) driftingBaseline.add(name);
      issues.push({
        severity: baselined ? "warning" : "error",
        path: relPackage,
        message: baselined
          ? `"${name}" package.json ${packageVersion} != plugin.json ${manifestVersion} (baselined; reconcile and drop from PACKAGE_VERSION_BASELINE)`
          : `"${name}" package.json ${packageVersion} != plugin.json ${manifestVersion}`,
      });
    }
  }

  // Staleness is only decidable for baselined plugins this root actually contains;
  // a root without the plugin (a fixture, a partial checkout) proves nothing.
  for (const name of evaluatedBaseline) {
    if (!driftingBaseline.has(name)) {
      issues.push({
        severity: "error",
        path: "src/policy/versionConsistencyValidator.ts",
        message: `stale PACKAGE_VERSION_BASELINE entry "${name}" — versions now agree, remove it`,
      });
    }
  }

  return issues;
}

export function formatVersionConsistencyIssues(
  issues: VersionConsistencyIssue[],
  root: string,
): string {
  void root;
  return issues
    .map((issue) => `${issue.severity === "error" ? "ERROR" : "warn"} ${issue.path}: ${issue.message}`)
    .join("\n");
}
