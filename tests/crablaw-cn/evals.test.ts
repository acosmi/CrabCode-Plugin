import { describe, expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("plugins/crablaw-cn");

async function json(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}

function frontmatterDescription(text: string): string {
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return block.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
}

describe("CrabLaw eval contracts", () => {
  test("trigger evals contain balanced realistic positives and near-miss negatives", async () => {
    const evals = await json(path.join(root, "evals", "trigger-evals.json"));
    expect(evals.length).toBeGreaterThanOrEqual(20);
    expect(new Set(evals.map((item: any) => item.query)).size).toBe(evals.length);
    const positives = evals.filter((item: any) => item.should_trigger === true);
    const negatives = evals.filter((item: any) => item.should_trigger === false);
    expect(positives.length).toBeGreaterThanOrEqual(10);
    expect(negatives.length).toBeGreaterThanOrEqual(8);
    expect(negatives.every((item: any) => typeof item.near_miss === "string" && item.near_miss.length > 5)).toBe(true);
  });

  test("every positive trigger target is a real manifest skill", async () => {
    const manifest = await json(path.join(root, ".crabcode-plugin", "plugin.json"));
    const skills = new Set(manifest.skills.map((entry: string) => path.basename(entry)));
    const evals = await json(path.join(root, "evals", "trigger-evals.json"));
    const missing = evals
      .filter((item: any) => item.should_trigger)
      .map((item: any) => item.expected_skill)
      .filter((skill: string) => !skills.has(skill));
    expect(missing).toEqual([]);
  });

  test("task evals have discriminating expectations and real synthetic fixtures", async () => {
    const suite = await json(path.join(root, "evals", "evals.json"));
    expect(suite.evals.length).toBeGreaterThanOrEqual(10);
    for (const item of suite.evals) {
      expect(item.prompt.length).toBeGreaterThan(20);
      expect(item.expectations.length).toBeGreaterThanOrEqual(3);
      for (const relative of item.files ?? []) {
        expect((await stat(path.join(root, relative))).isFile()).toBe(true);
      }
    }
  });

  test("new public skill descriptions fit the 250-character trigger budget", async () => {
    const files = [
      path.join(root, "legal-core", "skills", "legal-workbench", "SKILL.md"),
      path.join(root, "matter-core", "skills", "matter-deep-analysis", "SKILL.md"),
    ];
    for (const file of files) {
      const description = frontmatterDescription(await readFile(file, "utf8"));
      expect(description.length).toBeGreaterThan(40);
      expect(description.length).toBeLessThanOrEqual(250);
    }
  });

  test("high-risk prediction and legal-study near misses are negative trigger cases", async () => {
    const evals = await json(path.join(root, "evals", "trigger-evals.json"));
    const prediction = evals.find((item: any) => item.query.includes("精确胜诉率"));
    const legalStudy = evals.find((item: any) => item.query.includes("法考民法"));
    expect(prediction?.should_trigger).toBe(false);
    expect(legalStudy?.should_trigger).toBe(false);
  });
});
