import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
 * Ratcheted to zero on 2026-07-27 — `crabcode-setup` was reconciled to 0.3.0 across
 * all three files, so every version drift is now a hard error. Keep the set (and its
 * stale check) so a future legacy import can be baselined explicitly rather than by
 * loosening the rule.
 */
const PACKAGE_VERSION_BASELINE = new Set<string>([]);
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

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

function nextPatch(version: string): string | null {
  const match = STRICT_SEMVER.exec(version);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function gitZeroSeparated(root: string, args: string[]): string[] {
  const output = execFileSync("git", ["-C", root, ...args]);
  return output.toString("utf8").split("\0").filter(Boolean);
}

function gitText(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

type RemediationEntry = {
  pluginId?: unknown;
  previousVersion?: unknown;
  remediationVersion?: unknown;
};

async function validateRemediationVersionContract(
  root: string,
  marketplace: Record<string, unknown>,
): Promise<VersionConsistencyIssue[]> {
  const issues: VersionConsistencyIssue[] = [];
  const evidencePath = path.join(
    root,
    "docs/audit/evidence/2026-08-23-mcp-remediation/remediation-release.json",
  );
  if (!existsSync(evidencePath)) return issues;
  const evidence = await readJson(evidencePath);
  if (!evidence) {
    return [{
      severity: "error",
      path: path.relative(root, evidencePath),
      message: "remediation release evidence is not valid JSON",
    }];
  }
  const baseline = evidence?.baseline as Record<string, unknown> | undefined;
  const remediation = evidence?.remediation as Record<string, unknown> | undefined;
  const changedEntries = evidence?.changedPlugins;
  const baselineCommit = typeof baseline?.commit === "string" ? baseline.commit : null;
  const baselineTree = typeof baseline?.tree === "string" ? baseline.tree : null;
  const baselineMarketplaceVersion = typeof baseline?.marketplaceVersion === "string"
    ? baseline.marketplaceVersion
    : null;
  const remediationMarketplaceVersion = typeof remediation?.marketplaceVersion === "string"
    ? remediation.marketplaceVersion
    : null;
  if (
    !baselineCommit ||
    !/^[0-9a-f]{40}$/u.test(baselineCommit) ||
    !baselineTree ||
    !/^[0-9a-f]{40}$/u.test(baselineTree) ||
    !baselineMarketplaceVersion ||
    !STRICT_SEMVER.test(baselineMarketplaceVersion) ||
    !remediationMarketplaceVersion ||
    !STRICT_SEMVER.test(remediationMarketplaceVersion) ||
    !Array.isArray(changedEntries)
  ) {
    return [{
      severity: "error",
      path: path.relative(root, evidencePath),
      message: "remediation release evidence lacks a strict baseline commit/tree/marketplace version or changedPlugins array",
    }];
  }

  let actualBaselineTree: string;
  let baselineMarketplace: Record<string, unknown>;
  let changedPaths: Set<string>;
  try {
    actualBaselineTree = gitText(root, ["rev-parse", `${baselineCommit}^{tree}`]);
    baselineMarketplace = JSON.parse(gitText(root, [
      "show",
      `${baselineCommit}:.crabcode-plugin/marketplace.json`,
    ])) as Record<string, unknown>;
    changedPaths = new Set([
      ...gitZeroSeparated(root, [
        "diff",
        "--name-only",
        "-z",
        ["--no-", "ren", "ames"].join(""),
        baselineCommit,
        "--",
      ]),
      ...gitZeroSeparated(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    ]);
  } catch (error) {
    return [{
      severity: "error",
      path: path.relative(root, evidencePath),
      message: `unable to verify remediation versions against baseline Git objects (${error instanceof Error ? error.message : String(error)})`,
    }];
  }
  if (actualBaselineTree !== baselineTree) {
    issues.push({
      severity: "error",
      path: path.relative(root, evidencePath),
      message: `remediation baseline tree mismatch: evidence=${baselineTree}, git=${actualBaselineTree}`,
    });
  }

  const currentEntries = Array.isArray(marketplace.plugins)
    ? marketplace.plugins as MarketplaceEntry[]
    : [];
  const baselineEntries = Array.isArray(baselineMarketplace.plugins)
    ? baselineMarketplace.plugins as MarketplaceEntry[]
    : [];
  const baselineByName = new Map<string, MarketplaceEntry>();
  for (const entry of baselineEntries) {
    if (typeof entry.name === "string") baselineByName.set(entry.name, entry);
  }
  const evidenceByName = new Map<string, RemediationEntry>();
  for (const raw of changedEntries as RemediationEntry[]) {
    if (typeof raw?.pluginId !== "string" || evidenceByName.has(raw.pluginId)) {
      issues.push({
        severity: "error",
        path: path.relative(root, evidencePath),
        message: "changedPlugins contains a missing or duplicate pluginId",
      });
      continue;
    }
    evidenceByName.set(raw.pluginId, raw);
  }
  if (evidence.changedPluginCount !== evidenceByName.size) {
    issues.push({
      severity: "error",
      path: path.relative(root, evidencePath),
      message: `changedPluginCount=${String(evidence.changedPluginCount)} does not equal unique changedPlugins=${evidenceByName.size}`,
    });
  }

  const derivedChanged = new Set<string>();
  for (const entry of currentEntries) {
    if (
      typeof entry.name !== "string" ||
      typeof entry.source !== "string" ||
      typeof entry.version !== "string"
    ) continue;
    const baselineEntry = baselineByName.get(entry.name);
    if (!baselineEntry || typeof baselineEntry.version !== "string") {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `remediation contract cannot derive baseline version for new or missing plugin "${entry.name}"`,
      });
      continue;
    }
    const source = entry.source.replace(/^\.\//u, "").replace(/\/+$/u, "");
    const sourceChanged = source.length === 0
      ? changedPaths.size > 0
      : [...changedPaths].some((changed) => changed === source || changed.startsWith(`${source}/`));
    const sourcePointerChanged = baselineEntry.source !== entry.source;
    const changed = sourceChanged || sourcePointerChanged;
    const expectedVersion = changed ? nextPatch(baselineEntry.version) : baselineEntry.version;
    if (!expectedVersion) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `baseline version for "${entry.name}" is not strict X.Y.Z: ${baselineEntry.version}`,
      });
      continue;
    }
    if (entry.version !== expectedVersion) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `plugin "${entry.name}" ${changed ? "changed distributable source bytes" : "did not change source bytes"}; expected version ${expectedVersion}, got ${entry.version}`,
      });
    }
    if (!changed) continue;
    derivedChanged.add(entry.name);
    const declared = evidenceByName.get(entry.name);
    if (
      !declared ||
      declared.previousVersion !== baselineEntry.version ||
      declared.remediationVersion !== expectedVersion
    ) {
      issues.push({
        severity: "error",
        path: path.relative(root, evidencePath),
        message: `changed plugin "${entry.name}" must be listed with previous=${baselineEntry.version} and remediation=${expectedVersion}`,
      });
    }
  }
  for (const pluginId of evidenceByName.keys()) {
    if (!derivedChanged.has(pluginId)) {
      issues.push({
        severity: "error",
        path: path.relative(root, evidencePath),
        message: `changedPlugins lists "${pluginId}" but its marketplace source has no bytes changed from the baseline`,
      });
    }
  }

  const baselineMetadata = baselineMarketplace.metadata as Record<string, unknown> | undefined;
  const currentMetadata = marketplace.metadata as Record<string, unknown> | undefined;
  const expectedMarketplaceVersion = nextPatch(baselineMarketplaceVersion);
  if (
    baselineMetadata?.version !== baselineMarketplaceVersion ||
    currentMetadata?.version !== remediationMarketplaceVersion ||
    remediationMarketplaceVersion !== expectedMarketplaceVersion
  ) {
    issues.push({
      severity: "error",
      path: ".crabcode-plugin/marketplace.json",
      message: `marketplace remediation version must be nextPatch(${baselineMarketplaceVersion})=${String(expectedMarketplaceVersion)}`,
    });
  }

  return issues;
}

/**
 * `baseline` defaults to the shipped set and exists so the ratchet stays testable once
 * that set is empty: a fixture may not name a member of an emptied baseline, and this
 * validator — unlike mcpContractValidator — has only one, so there is no populated
 * sibling to anchor on. Production callers pass `root` alone.
 */
export async function validateVersionConsistency(
  root: string,
  baseline: ReadonlySet<string> = PACKAGE_VERSION_BASELINE,
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
    if (!STRICT_SEMVER.test(manifestVersion)) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `plugin manifest for "${name}" version must be strict X.Y.Z, got ${manifestVersion}`,
      });
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
    } else if (typeof raw.version === "string" && !STRICT_SEMVER.test(raw.version)) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `"${name}" marketplace version must be strict X.Y.Z, got ${raw.version}`,
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
    if (!STRICT_SEMVER.test(packageVersion)) {
      issues.push({
        severity: "error",
        path: relPackage,
        message: `package.json for "${name}" version must be strict X.Y.Z, got ${packageVersion}`,
      });
    }

    const baselined = baseline.has(name);
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

  issues.push(...(await validateRemediationVersionContract(root, marketplace!)));

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
