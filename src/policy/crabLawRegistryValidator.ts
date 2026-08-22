import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export type CrabLawRegistryIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

type Domain = {
  id?: unknown;
  defaultCapability?: unknown;
  capabilities?: unknown;
};

type CoreMode = {
  id?: unknown;
  profile?: unknown;
  agents?: unknown;
};

type Registry = {
  version?: unknown;
  plugin?: unknown;
  controlPlane?: unknown;
  flagship?: unknown;
  domains?: unknown;
  coreModes?: unknown;
  legacyNamespaces?: unknown;
  deepAnalysisArtifacts?: unknown;
};

type Manifest = {
  name?: unknown;
  skills?: unknown;
  agents?: unknown;
};

type Marketplace = { plugins?: unknown };

const FAMILY = "crablaw-cn";
const REGISTRY_RELATIVE = "legal-core/capability-registry.json";
const ARTIFACT_SCHEMAS: Record<string, string> = {
  "analysis-plan": "analysis-plan.schema.json",
  "document-index": "document-index.schema.json",
  "fact-chronology": "fact-chronology.schema.json",
  "issue-tree": "issue-tree.schema.json",
  "claim-evidence-map": "claim-evidence-map.schema.json",
  "case-comparison": "case-comparison.schema.json",
  "analysis-findings": "analysis-finding.schema.json",
  "specialist-findings": "specialist-findings.schema.json",
  "run-manifest": "run-manifest.schema.json",
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function basenames(entries: string[]): Set<string> {
  return new Set(entries.map((entry) => path.basename(entry.replace(/\/+$/, ""))));
}

function fileStems(entries: string[]): Set<string> {
  return new Set(entries.map((entry) => path.basename(entry, path.extname(entry))));
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function validateCrabLawRegistry(root: string): Promise<CrabLawRegistryIssue[]> {
  const issues: CrabLawRegistryIssue[] = [];
  const pluginRoot = path.join(path.resolve(root), "plugins", FAMILY);
  const manifestPath = path.join(pluginRoot, ".crabcode-plugin", "plugin.json");
  if (!(await fileExists(manifestPath))) return issues;

  const registryPath = path.join(pluginRoot, REGISTRY_RELATIVE);
  let registry: Registry;
  let manifest: Manifest;
  let marketplace: Marketplace;
  try {
    [registry, manifest, marketplace] = await Promise.all([
      readJson<Registry>(registryPath),
      readJson<Manifest>(manifestPath),
      readJson<Marketplace>(path.join(path.resolve(root), ".crabcode-plugin", "marketplace.json")),
    ]);
  } catch (error) {
    issues.push({
      severity: "error",
      path: registryPath,
      message: `unable to parse registry/manifest/marketplace: ${error instanceof Error ? error.message : String(error)}`,
    });
    return issues;
  }

  if (registry.version !== 1 || registry.plugin !== FAMILY) {
    issues.push({ severity: "error", path: registryPath, message: "registry must declare version 1 and plugin crablaw-cn" });
  }

  const manifestSkills = basenames(strings(manifest.skills));
  const manifestAgents = fileStems(strings(manifest.agents));
  const domains = Array.isArray(registry.domains) ? (registry.domains as Domain[]) : [];
  const registrySkills: string[] = [];
  const domainIds = new Set<string>();
  for (const domain of domains) {
    const id = typeof domain.id === "string" ? domain.id : "";
    if (!id || domainIds.has(id)) {
      issues.push({ severity: "error", path: registryPath, message: `domain id is missing or duplicated: ${id || "<empty>"}` });
      continue;
    }
    domainIds.add(id);
    const capabilities = strings(domain.capabilities);
    registrySkills.push(...capabilities);
    if (typeof domain.defaultCapability !== "string" || !capabilities.includes(domain.defaultCapability)) {
      issues.push({ severity: "error", path: registryPath, message: `domain ${id} defaultCapability must be one of its capabilities` });
    }
  }

  const duplicates = registrySkills.filter((item, index) => registrySkills.indexOf(item) !== index);
  if (duplicates.length > 0) {
    issues.push({ severity: "error", path: registryPath, message: `registry capability appears in multiple domains: ${[...new Set(duplicates)].join(", ")}` });
  }
  const registrySkillSet = new Set(registrySkills);
  const missingFromRegistry = [...manifestSkills].filter((skill) => !registrySkillSet.has(skill));
  const missingFromManifest = [...registrySkillSet].filter((skill) => !manifestSkills.has(skill));
  if (missingFromRegistry.length > 0) {
    issues.push({ severity: "error", path: registryPath, message: `manifest skills missing from registry: ${missingFromRegistry.join(", ")}` });
  }
  if (missingFromManifest.length > 0) {
    issues.push({ severity: "error", path: registryPath, message: `registry skills missing from manifest: ${missingFromManifest.join(", ")}` });
  }

  for (const field of ["controlPlane", "flagship"] as const) {
    const value = registry[field];
    if (typeof value !== "string" || !manifestSkills.has(value)) {
      issues.push({ severity: "error", path: registryPath, message: `${field} must resolve to a manifest skill` });
    }
  }

  const coreModes = Array.isArray(registry.coreModes) ? (registry.coreModes as CoreMode[]) : [];
  const modeIds = new Set<string>();
  for (const mode of coreModes) {
    const id = typeof mode.id === "string" ? mode.id : "";
    if (!id || modeIds.has(id)) {
      issues.push({ severity: "error", path: registryPath, message: `core mode id is missing or duplicated: ${id || "<empty>"}` });
    }
    modeIds.add(id);
    const resolvedProfile = typeof mode.profile === "string" ? path.resolve(pluginRoot, mode.profile) : "";
    const profileContained =
      resolvedProfile === pluginRoot || resolvedProfile.startsWith(`${pluginRoot}${path.sep}`);
    if (!profileContained || !(await fileExists(resolvedProfile))) {
      issues.push({ severity: "error", path: registryPath, message: `core mode ${id} profile does not resolve inside the plugin` });
    }
    for (const agent of strings(mode.agents)) {
      if (!manifestAgents.has(agent)) {
        issues.push({ severity: "error", path: registryPath, message: `core mode ${id} agent is not declared in manifest: ${agent}` });
      }
    }
  }

  const legacy = registry.legacyNamespaces;
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    issues.push({ severity: "error", path: registryPath, message: "legacyNamespaces must be an object" });
  } else {
    for (const [namespace, target] of Object.entries(legacy as Record<string, unknown>)) {
      if (!domainIds.has(namespace) || namespace === "legal-core" || target !== FAMILY) {
        issues.push({ severity: "error", path: registryPath, message: `invalid legacy namespace mapping: ${namespace} -> ${String(target)}` });
      }
    }
  }

  for (const artifact of strings(registry.deepAnalysisArtifacts)) {
    const schema = ARTIFACT_SCHEMAS[artifact];
    if (schema && !(await fileExists(path.join(pluginRoot, "legal-core", "schemas", schema)))) {
      issues.push({ severity: "error", path: registryPath, message: `artifact ${artifact} schema is missing: ${schema}` });
    }
  }

  const entries = Array.isArray(marketplace.plugins) ? (marketplace.plugins as Array<Record<string, unknown>>) : [];
  const marketEntry = entries.find((entry) => entry.name === FAMILY);
  const groups = Array.isArray(marketEntry?.groups) ? (marketEntry.groups as Domain[]) : [];
  const grouped = new Map(groups.map((group) => [String(group.id ?? (group as Record<string, unknown>).name ?? ""), strings(group.capabilities ?? (group as Record<string, unknown>).skills)]));
  for (const domain of domains) {
    const id = typeof domain.id === "string" ? domain.id : "";
    const marketSkills = grouped.get(id);
    if (!marketSkills || JSON.stringify([...marketSkills].sort()) !== JSON.stringify(strings(domain.capabilities).sort())) {
      issues.push({ severity: "error", path: registryPath, message: `registry domain ${id} must match its marketplace group exactly` });
    }
  }

  return issues;
}

export function formatCrabLawRegistryIssues(issues: CrabLawRegistryIssue[], root: string): string {
  return issues
    .map((issue) => `${issue.severity.toUpperCase()} ${path.relative(root, issue.path)}: ${issue.message}`)
    .join("\n");
}
