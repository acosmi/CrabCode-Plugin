import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMarketplace } from "../../src/policy/marketplaceValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "marketplace-validator-"));
}

async function writeMarketplace(root: string, payload: unknown): Promise<void> {
  const dir = path.join(root, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "marketplace.json"), JSON.stringify(payload, null, 2));
}

async function writeCategories(root: string, categories: unknown): Promise<void> {
  const dir = path.join(root, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "categories.json"), JSON.stringify(categories, null, 2));
}

async function writePluginAt(
  root: string,
  relPath: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  const dir = path.join(root, relPath, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));
}

describe("marketplace validator", () => {
  test("accepts a valid marketplace", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "crabcode-plugins-test",
      plugins: [
        {
          name: "alpha-plugin",
          source: "./plugins/alpha-plugin",
          version: "0.1.0",
          description: "alpha",
          category: "productivity",
          tags: ["a"],
        },
      ],
    });
    await writePluginAt(root, "plugins/alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "alpha",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["a"],
    });
    const issues = await validateMarketplace(root);
    expect(issues).toEqual([]);
  });

  test("flags missing required entry fields", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [{ name: "incomplete", source: "./plugins/incomplete" }],
    });
    await writePluginAt(root, "plugins/incomplete", {
      name: "incomplete",
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["x"],
    });
    const issues = await validateMarketplace(root);
    const fields = issues.filter((i) => i.severity === "error").map((i) => i.field);
    expect(fields).toContain("version");
    expect(fields).toContain("description");
    expect(fields).toContain("category");
    expect(fields).toContain("tags");
  });

  test("flags missing source path", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "ghost-plugin",
          source: "./plugins/ghost-plugin",
          version: "0.1.0",
          description: "missing dir",
          category: "tools",
          tags: ["x"],
        },
      ],
    });
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.severity === "error" && i.field === "source" && i.message.includes("does not exist"))).toBe(true);
  });

  test("flags entry-vs-manifest name mismatch", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "entry-name",
          source: "./plugins/entry-name",
          version: "0.1.0",
          description: "x",
          category: "tools",
          tags: ["x"],
        },
      ],
    });
    await writePluginAt(root, "plugins/entry-name", {
      name: "manifest-name",
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["x"],
    });
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("does not match"))).toBe(true);
  });

  test("flags duplicate entry names", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        { name: "dup", source: "./plugins/dup", version: "0.1.0", description: "x", category: "c", tags: ["t"] },
        { name: "dup", source: "./plugins/dup", version: "0.1.0", description: "x", category: "c", tags: ["t"] },
      ],
    });
    await writePluginAt(root, "plugins/dup", {
      name: "dup",
      version: "0.1.0",
      description: "x",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["x"],
    });
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("duplicate"))).toBe(true);
  });

  test("rejects relative escape sources", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "escape",
          source: "../outside",
          version: "0.1.0",
          description: "x",
          category: "c",
          tags: ["t"],
        },
      ],
    });
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.severity === "error" && i.field === "source")).toBe(true);
  });

  test("emits warning when marketplace missing", async () => {
    const root = await makeTempRoot();
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  test("accepts a category declared in categories.json", async () => {
    const root = await makeTempRoot();
    await writeCategories(root, [{ id: "productivity", displayName: "效率" }]);
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "alpha-plugin",
          source: "./plugins/alpha-plugin",
          version: "0.1.0",
          description: "alpha",
          category: "productivity",
          tags: ["a"],
        },
      ],
    });
    await writePluginAt(root, "plugins/alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "alpha",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["a"],
    });
    const issues = await validateMarketplace(root);
    expect(issues).toEqual([]);
  });

  test("flags a category not declared in categories.json", async () => {
    const root = await makeTempRoot();
    await writeCategories(root, [{ id: "productivity", displayName: "效率" }]);
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "alpha-plugin",
          source: "./plugins/alpha-plugin",
          version: "0.1.0",
          description: "alpha",
          category: "made-up-category",
          tags: ["a"],
        },
      ],
    });
    await writePluginAt(root, "plugins/alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "alpha",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["a"],
    });
    const issues = await validateMarketplace(root);
    expect(
      issues.some(
        (i) => i.severity === "error" && i.field === "category" && i.message.includes("not declared"),
      ),
    ).toBe(true);
  });

  test("skips category whitelist when categories.json is absent (backward compatible)", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "alpha-plugin",
          source: "./plugins/alpha-plugin",
          version: "0.1.0",
          description: "alpha",
          category: "anything-goes",
          tags: ["a"],
        },
      ],
    });
    await writePluginAt(root, "plugins/alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "alpha",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["a"],
    });
    const issues = await validateMarketplace(root);
    expect(issues.some((i) => i.field === "category")).toBe(false);
  });

  test("flags a duplicate category id in categories.json", async () => {
    const root = await makeTempRoot();
    await writeCategories(root, [
      { id: "productivity", displayName: "效率" },
      { id: "productivity", displayName: "重复" },
    ]);
    await writeMarketplace(root, {
      name: "test",
      plugins: [
        {
          name: "alpha-plugin",
          source: "./plugins/alpha-plugin",
          version: "0.1.0",
          description: "alpha",
          category: "productivity",
          tags: ["a"],
        },
      ],
    });
    await writePluginAt(root, "plugins/alpha-plugin", {
      name: "alpha-plugin",
      version: "0.1.0",
      description: "alpha",
      author: { name: "CrabCode" },
      license: "Apache-2.0",
      keywords: ["a"],
    });
    const issues = await validateMarketplace(root);
    expect(
      issues.some((i) => i.severity === "error" && i.message.includes("duplicate category id")),
    ).toBe(true);
  });
});
