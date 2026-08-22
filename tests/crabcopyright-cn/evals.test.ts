import { describe, expect, test } from "bun:test";
import path from "node:path";

const pluginRoot = path.resolve(import.meta.dir, "../../plugins/crabcopyright-cn");

describe("crabcopyright-cn skill eval definitions", () => {
  test("workflow evals have realistic prompts and objective expectations", async () => {
    const data = await Bun.file(path.join(pluginRoot, "evals", "evals.json")).json();
    expect(data.skill_name).toBe("软著申请管家");
    expect(data.evals).toHaveLength(3);
    expect(new Set(data.evals.map((entry: { id: number }) => entry.id)).size).toBe(3);
    for (const entry of data.evals) {
      expect(entry.prompt.length).toBeGreaterThan(40);
      expect(entry.expected_output.length).toBeGreaterThan(30);
      expect(entry.expectations.length).toBeGreaterThanOrEqual(4);
      for (const file of entry.files) expect(await Bun.file(path.join(pluginRoot, file)).exists()).toBe(true);
    }
  });

  test("trigger set balances ten positives with ten hard negatives", async () => {
    const queries = await Bun.file(path.join(pluginRoot, "evals", "trigger-evals.json")).json();
    expect(queries).toHaveLength(20);
    expect(queries.filter((entry: { should_trigger: boolean }) => entry.should_trigger)).toHaveLength(10);
    expect(queries.filter((entry: { should_trigger: boolean }) => !entry.should_trigger)).toHaveLength(10);
    expect(new Set(queries.map((entry: { query: string }) => entry.query)).size).toBe(20);
    const positiveSkills = new Set(
      queries.filter((entry: { should_trigger: boolean }) => entry.should_trigger)
        .map((entry: { expected_skill: string }) => entry.expected_skill),
    );
    expect(positiveSkills).toEqual(new Set([
      "apply-manager", "application-planning", "materials-checklist", "source-code-material",
      "manual-material", "consistency-check", "package-build", "filing-guide",
    ]));
  });
});
