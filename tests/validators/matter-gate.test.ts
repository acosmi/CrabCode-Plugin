import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMatterGate } from "../../src/policy/matterGateValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "matter-gate-"));
}

async function writeSkill(
  root: string,
  board: string,
  skill: string,
  body: string,
): Promise<void> {
  const dir = path.join(root, "plugins", "crablaw-cn", board, "skills", skill);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body);
}

const GATE_SECTION = [
  "## Matter Gate",
  "",
  "Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate).",
].join("\n");

describe("matter gate validator", () => {
  test("accepts a substantive skill with a referencing Matter Gate", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "cn-corporate", "resolution-review", `# x\n\n${GATE_SECTION}\n`);
    const issues = await validateMatterGate(root);
    expect(issues).toEqual([]);
  });

  test("flags a substantive skill missing the Matter Gate section", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "cn-corporate", "resolution-review", "# x\n\nno gate here\n");
    const issues = await validateMatterGate(root);
    expect(issues.some((i) => i.message.includes("missing a '## Matter Gate'"))).toBe(true);
  });

  test("flags a Matter Gate section that does not reference PRACTICE.md", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "cn-ip", "patent-review", "# x\n\n## Matter Gate\n\nbare heading\n");
    const issues = await validateMatterGate(root);
    expect(issues.some((i) => i.message.includes("must reference"))).toBe(true);
  });

  test("exempts gate-exempt board cn-legal-study", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "cn-legal-study", "case-study", "# x\n\nno gate, education content\n");
    const issues = await validateMatterGate(root);
    expect(issues).toEqual([]);
  });

  test("exempts gate-exempt board builder-hub", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "builder-hub", "skill-installer", "# x\n\nno gate, meta-tooling\n");
    const issues = await validateMatterGate(root);
    expect(issues).toEqual([]);
  });

  test("exempts intake skills that establish the matter prerequisites", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "matter-core", "new-matter", "# x\n\nno gate, intake\n");
    await writeSkill(root, "cn-contract", "cold-start-interview", "# x\n\nno gate, intake\n");
    const issues = await validateMatterGate(root);
    expect(issues).toEqual([]);
  });

  test("still requires the gate on substantive matter-core skills", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "matter-core", "matter-deep-analysis", "# x\n\nno gate\n");
    const issues = await validateMatterGate(root);
    expect(issues.some((i) => i.message.includes("matter-deep-analysis"))).toBe(true);
  });

  test("returns no issues when the family is absent", async () => {
    const root = await makeTempRoot();
    const issues = await validateMatterGate(root);
    expect(issues).toEqual([]);
  });
});
