import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateManifests } from "../../src/policy/manifestValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "manifest-validator-"));
}

async function writePlugin(
  root: string,
  pluginName: string,
  manifest: Record<string, unknown>,
  dirName?: string,
): Promise<string> {
  const finalDir = dirName ?? pluginName;
  const dir = path.join(root, "plugins", finalDir, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));
  return path.join(root, "plugins", finalDir);
}

describe("manifest validator", () => {
  test("accepts a full manifest", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "Alpha plugin for tests",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["tag-a", "tag-b"],
    });
    const issues = await validateManifests(root);
    expect(issues).toEqual([]);
  });

  test("flags missing required fields as errors", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "missing-fields", {
      name: "missing-fields",
      version: "0.1.0",
      description: "missing license + keywords",
      author: { name: "CrabCode" },
    });
    const issues = await validateManifests(root);
    const fields = issues.filter((i) => i.severity === "error").map((i) => i.field);
    expect(fields).toContain("license");
    expect(fields).toContain("keywords");
  });

  test("warns on legacy plugins instead of erroring", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "matter-core", {
      name: "matter-core",
      version: "0.1.0",
      description: "legacy matter core",
      author: { name: "CrabLaw" },
    });
    const issues = await validateManifests(root);
    expect(issues.every((issue) => issue.severity !== "error" || !["license", "keywords"].includes(issue.field ?? ""))).toBe(true);
    expect(issues.some((issue) => issue.severity === "warning" && issue.field === "license")).toBe(true);
    expect(issues.some((issue) => issue.severity === "warning" && issue.field === "keywords")).toBe(true);
  });

  test("rejects non-kebab-case names", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "BadCase", {
      name: "BadCase",
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["tag"],
    });
    const issues = await validateManifests(root);
    expect(issues.some((i) => i.severity === "error" && i.field === "name")).toBe(true);
  });

  test("rejects banned identifiers in manifest name", async () => {
    const root = await makeTempRoot();
    const banned = "c" + "laude" + "-plugin";
    await writePlugin(root, banned, {
      name: banned,
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["tag"],
    });
    const issues = await validateManifests(root);
    expect(issues.some((i) => i.severity === "error" && i.field === "name" && i.message.includes("banned"))).toBe(true);
  });

  test("rejects directory name mismatch", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "real-name", {
      name: "different-name",
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["tag"],
    }, "wrong-dir");
    const issues = await validateManifests(root);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("directory"))).toBe(true);
  });

  test("rejects malformed JSON", async () => {
    const root = await makeTempRoot();
    const dir = path.join(root, "plugins", "broken", ".crabcode-plugin");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "plugin.json"), "{not json");
    const issues = await validateManifests(root);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("invalid JSON"))).toBe(true);
  });
});
