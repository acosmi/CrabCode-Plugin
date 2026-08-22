import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))));

describe("Personal-host local port generator", () => {
  test("flattens eight skills, rewrites host paths and refuses overwrite", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "crabcopyright-codex-port-"));
    roots.push(parent);
    const target = path.join(parent, "crabcopyright-cn");
    const pluginRoot = path.resolve(import.meta.dir, "..");
    const run = () => Bun.spawnSync({
      cmd: ["bun", "run", "scripts/build-codex-port.ts", "--out", target, "--version", "0.3.0+codex.test"],
      cwd: pluginRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const first = run();
    if (first.exitCode !== 0) throw new Error(first.stderr.toString());
    const manifest = JSON.parse(await readFile(path.join(target, ".codex-plugin", "plugin.json"), "utf8"));
    expect(manifest.version).toBe("0.3.0+codex.test");
    const skills = (await readdir(path.join(target, "skills"))).sort();
    expect(skills).toEqual([
      "application-planning", "apply-manager", "consistency-check", "filing-guide",
      "manual-material", "materials-checklist", "package-build", "source-code-material",
    ]);
    for (const skill of skills) {
      const content = await readFile(path.join(target, "skills", skill, "SKILL.md"), "utf8");
      expect(content).toContain(`name: ${skill}`);
      expect(content).not.toContain("allowed-tools:");
      expect(content).not.toContain("argument-hint:");
      expect(content).not.toContain("${CRABCODE_PLUGIN_ROOT}");
      expect(content).not.toContain("crabcode-office-suite");
    }
    expect(await Bun.file(path.join(target, "dist", "source-core.js")).exists()).toBe(true);
    const coldStart = Bun.spawnSync({
      cmd: ["node", path.join(target, "dist", "source-core.js")],
      stdout: "pipe", stderr: "pipe",
    });
    expect(coldStart.exitCode).toBe(2);
    expect(coldStart.stderr.toString()).toContain("用法");

    const second = run();
    expect(second.exitCode).not.toBe(0);
    expect(second.stderr.toString()).toContain("拒绝覆盖");
  });
});
