import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PRESENTATION_MAX_RASTER_BYTES,
  validatePresentation,
} from "../../src/policy/presentationValidator.ts";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XWbqAAAAAElFTkSuQmCC",
  "base64",
);

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "presentation-validator-"));
}

type FixtureOverrides = {
  entry?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  skill?: string;
  writeIcons?: boolean;
};

async function writeFixture(root: string, overrides: FixtureOverrides = {}): Promise<string> {
  const pluginRoot = path.join(root, "plugins", "writer");
  const skillRoot = path.join(pluginRoot, "skills", "article-writer");
  await mkdir(path.join(root, ".crabcode-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".crabcode-plugin"), { recursive: true });
  await mkdir(skillRoot, { recursive: true });
  if (overrides.writeIcons !== false) {
    await mkdir(path.join(pluginRoot, "assets"), { recursive: true });
    await writeFile(path.join(pluginRoot, "assets", "icon.png"), PNG);
  }
  const manifest = {
    name: "writer",
    version: "1.2.3",
    description: "writer",
    author: { name: "CrabCode" },
    license: "Apache-2.0",
    keywords: ["writing"],
    skills: ["./skills/article-writer"],
    ...overrides.manifest,
  };
  await writeFile(
    path.join(pluginRoot, ".crabcode-plugin", "plugin.json"),
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(
    path.join(skillRoot, "SKILL.md"),
    overrides.skill ??
      [
        "---",
        "name: 原创文章写作",
        "description: Keep this detailed model-facing trigger text unchanged.",
        "short-description: 围绕可靠资料创作结构清晰且有独立判断的原创文章",
        "---",
        "",
        "# Article writer",
        "",
      ].join("\n"),
  );
  const entry = {
    name: "writer",
    source: "./plugins/writer",
    version: "1.2.3",
    displayName: "原创写作工作流",
    shortDescription: "从资料研究到成稿审校的一体化原创写作能力",
    defaultPrompt: ["帮我写一篇原创观点文章", "审校这篇文章"],
    brandColor: "#8957e5",
    description: "writer",
    category: "content",
    tags: ["writing"],
    tier: "workflow",
    composerIcon: "./assets/icon.png",
    logo: "./assets/icon.png",
    groups: [
      { name: "authoring", displayName: "内容创作", skills: ["article-writer"] },
    ],
    ...overrides.entry,
  };
  await writeFile(
    path.join(root, ".crabcode-plugin", "marketplace.json"),
    JSON.stringify({ name: "test", plugins: [entry] }, null, 2),
  );
  return pluginRoot;
}

describe("presentation validator", () => {
  test("accepts a fully localized workflow with safe local raster assets", async () => {
    const root = await makeTempRoot();
    await writeFixture(root);
    expect(await validatePresentation(root)).toEqual([]);
  });

  test("rejects non-Chinese workflow copy, invalid brand color, and more than three prompts", async () => {
    const root = await makeTempRoot();
    await writeFixture(root, {
      entry: {
        displayName: "Writer",
        shortDescription: "Write articles",
        brandColor: "purple",
        defaultPrompt: ["一", "二", "三", "四"],
      },
    });
    const issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "displayName")).toBe(true);
    expect(issues.some((entry) => entry.field === "shortDescription")).toBe(true);
    expect(issues.some((entry) => entry.field === "brandColor")).toBe(true);
    expect(issues.some((entry) => entry.field === "defaultPrompt")).toBe(true);
  });

  test("rejects absolute and escaping raster paths", async () => {
    const root = await makeTempRoot();
    await writeFixture(root, {
      entry: { composerIcon: "/tmp/icon.png", logo: "./../outside.png" },
    });
    const issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "composerIcon" && entry.message.includes("must start"))).toBe(true);
    expect(issues.some((entry) => entry.field === "logo" && entry.message.includes("escapes"))).toBe(true);
  });

  test("rejects directories, false magic bytes, and oversized rasters", async () => {
    const root = await makeTempRoot();
    const pluginRoot = await writeFixture(root);
    await mkdir(path.join(pluginRoot, "assets", "directory.png"));
    await writeFile(path.join(pluginRoot, "assets", "fake.png"), "not a png");
    const oversized = Buffer.alloc(PRESENTATION_MAX_RASTER_BYTES + 1);
    PNG.copy(oversized, 0, 0, 8);
    await writeFile(path.join(pluginRoot, "assets", "large.png"), oversized);

    await writeFixture(root, { entry: { composerIcon: "./assets/directory.png" } });
    let issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "composerIcon" && entry.message.includes("regular file"))).toBe(true);

    await writeFixture(root, { entry: { composerIcon: "./assets/fake.png" } });
    issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "composerIcon" && entry.message.includes("does not match"))).toBe(true);

    await writeFixture(root, { entry: { composerIcon: "./assets/large.png" } });
    issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "composerIcon" && entry.message.includes("bytes"))).toBe(true);
  });

  test("rejects a raster symlink that resolves outside the plugin root", async () => {
    const root = await makeTempRoot();
    const pluginRoot = await writeFixture(root);
    const outside = path.join(root, "outside.png");
    await writeFile(outside, PNG);
    await symlink(outside, path.join(pluginRoot, "assets", "linked.png"));
    await writeFixture(root, { entry: { composerIcon: "./assets/linked.png" } });
    const issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "composerIcon" && entry.message.includes("outside"))).toBe(true);
  });

  test("rejects an English skill title and trigger-template short description", async () => {
    const root = await makeTempRoot();
    await writeFixture(root, {
      skill: [
        "---",
        "name: article-writer",
        "description: Keep this detailed model-facing trigger text unchanged.",
        "short-description: This skill should be used when 用户需要创作原创文章",
        "---",
        "",
      ].join("\n"),
    });
    const issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field?.endsWith(".name"))).toBe(true);
    expect(
      issues.some(
        (entry) => entry.field?.endsWith(".short-description") && entry.message.includes("trigger template"),
      ),
    ).toBe(true);
  });

  test("rejects marketplace/manifest version drift and undeclared group skills", async () => {
    const root = await makeTempRoot();
    await writeFixture(root, {
      entry: {
        version: "1.2.4",
        groups: [{ name: "authoring", displayName: "内容创作", skills: ["missing-skill"] }],
      },
    });
    const issues = await validatePresentation(root);
    expect(issues.some((entry) => entry.field === "version")).toBe(true);
    expect(issues.some((entry) => entry.field?.startsWith("groups") && entry.message.includes("undeclared"))).toBe(true);
  });

  test("keeps legacy workflows compatible until they opt in with local presentation assets", async () => {
    const root = await makeTempRoot();
    await writeFixture(root, {
      entry: { composerIcon: undefined, logo: undefined },
      skill: [
        "---",
        "name: article-writer",
        "description: Legacy model-facing description.",
        "---",
        "",
      ].join("\n"),
      writeIcons: false,
    });
    expect(await validatePresentation(root)).toEqual([]);
  });
});
