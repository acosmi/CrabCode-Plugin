import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateLayout } from "../../src/policy/layoutValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "layout-validator-"));
}

async function writePluginManifest(
  root: string,
  relPath: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  const dir = path.join(root, relPath, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "plugin.json"), JSON.stringify(manifest));
}

describe("layout validator", () => {
  test("accepts kebab-case neutral plugin directory", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "plugins/alpha-plugin", { name: "alpha-plugin" });
    const issues = await validateLayout(root);
    expect(issues).toEqual([]);
  });

  test("flags non-kebab-case directory", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "plugins/BadName", { name: "BadName" });
    const issues = await validateLayout(root);
    expect(issues.some((i) => i.message.includes("kebab-case"))).toBe(true);
  });

  test("flags banned identifier in directory name", async () => {
    const root = await makeTempRoot();
    const banned = "c" + "laude" + "-helper";
    await writePluginManifest(root, `plugins/${banned}`, { name: banned });
    const issues = await validateLayout(root);
    expect(issues.some((i) => i.message.includes("banned"))).toBe(true);
  });

  test("flags banned identifiers in nested plugin path segments", async () => {
    const root = await makeTempRoot();
    const banned = "revise-" + "c" + "laude" + "-md.md";
    await writePluginManifest(root, "plugins/alpha-plugin", { name: "alpha-plugin" });
    await mkdir(path.join(root, "plugins", "alpha-plugin", "commands"), { recursive: true });
    await writeFile(path.join(root, "plugins", "alpha-plugin", "commands", banned), "");
    const issues = await validateLayout(root);
    expect(issues.some((i) => i.message.includes("path segment"))).toBe(true);
  });

  test("accepts approved nested family crablaw-cn", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "plugins/crablaw-cn/matter-core", {
      name: "matter-core",
    });
    const issues = await validateLayout(root);
    expect(issues).toEqual([]);
  });

  test("accepts approved nested family crabfin-cn", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "plugins/crabfin-cn/fin-core", {
      name: "fin-core",
    });
    const issues = await validateLayout(root);
    expect(issues).toEqual([]);
  });

  test("rejects unapproved nested family", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "plugins/random-family/something", {
      name: "something",
    });
    const issues = await validateLayout(root);
    expect(issues.some((i) => i.message.includes("nested-family"))).toBe(true);
  });

  test("rejects manifest outside plugins/", async () => {
    const root = await makeTempRoot();
    await writePluginManifest(root, "rogue-dir", { name: "rogue-dir" });
    const issues = await validateLayout(root);
    expect(issues.some((i) => i.message.includes("must live under plugins/"))).toBe(true);
  });
});
