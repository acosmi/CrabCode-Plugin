import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateCrabLawRegistry } from "../../src/policy/crabLawRegistryValidator.ts";

async function writeJson(file: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(payload));
}

async function fixture(extraManifestSkills: string[] = []): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-registry-"));
  const plugin = path.join(root, "plugins", "crablaw-cn");
  await writeJson(path.join(root, ".crabcode-plugin", "marketplace.json"), {
    plugins: [
      {
        name: "crablaw-cn",
        groups: [{ name: "legal-core", skills: ["legal-workbench"] }],
      },
    ],
  });
  await writeJson(path.join(plugin, ".crabcode-plugin", "plugin.json"), {
    name: "crablaw-cn",
    skills: ["./legal-core/skills/legal-workbench", ...extraManifestSkills],
    agents: ["./matter-core/agents/reviewer.md"],
  });
  await mkdir(path.join(plugin, "legal-core", "references"), { recursive: true });
  await writeFile(path.join(plugin, "legal-core", "references", "policy.md"), "# policy");
  await mkdir(path.join(plugin, "matter-core", "agents"), { recursive: true });
  await writeFile(path.join(plugin, "matter-core", "agents", "reviewer.md"), "# reviewer");
  await writeJson(path.join(plugin, "legal-core", "capability-registry.json"), {
    version: 1,
    plugin: "crablaw-cn",
    controlPlane: "legal-workbench",
    flagship: "legal-workbench",
    coreModes: [{ id: "review", profile: "legal-core/references/policy.md", agents: ["reviewer"] }],
    deepAnalysisArtifacts: [],
    legacyNamespaces: {},
    domains: [
      {
        id: "legal-core",
        defaultCapability: "legal-workbench",
        capabilities: ["legal-workbench"],
      },
    ],
  });
  return root;
}

describe("CrabLaw capability registry", () => {
  test("accepts a registry aligned with manifest, marketplace and declared agents", async () => {
    expect(await validateCrabLawRegistry(await fixture())).toEqual([]);
  });

  test("rejects a manifest skill omitted from the registry", async () => {
    const issues = await validateCrabLawRegistry(await fixture(["./matter-core/skills/extra"]));
    expect(issues.some((issue) => issue.message.includes("manifest skills missing from registry"))).toBe(true);
  });

  test("rejects a core profile that escapes the plugin root", async () => {
    const root = await fixture();
    const registryPath = path.join(root, "plugins", "crablaw-cn", "legal-core", "capability-registry.json");
    const registry = JSON.parse(await Bun.file(registryPath).text());
    registry.coreModes[0].profile = "../../../../outside.md";
    await writeJson(registryPath, registry);
    const issues = await validateCrabLawRegistry(root);
    expect(issues.some((issue) => issue.message.includes("inside the plugin"))).toBe(true);
  });

  test("the real repository registry is aligned", async () => {
    expect(await validateCrabLawRegistry(path.resolve("."))).toEqual([]);
  });

  test("all ten substantive matter types have stable default routes", async () => {
    const registry = JSON.parse(
      await Bun.file("plugins/crablaw-cn/legal-core/capability-registry.json").text(),
    );
    const routes = Object.fromEntries(
      registry.domains
        .filter((domain: any) => domain.matterType)
        .map((domain: any) => [domain.matterType, domain.defaultCapability]),
    );
    expect(routes).toEqual({
      contract: "review",
      "data-compliance": "data-activity-triage",
      "labor-employment": "employment-contract-review",
      corporate: "diligence-issue-extraction",
      litigation: "matter-intake",
      ip: "infringement-triage",
      regulatory: "gap-surfacer",
      "ai-governance": "use-case-triage",
      product: "is-this-a-problem",
      "legal-aid": "aid-intake",
    });
  });
});
