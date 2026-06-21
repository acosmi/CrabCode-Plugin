import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject, renderReport } from "../src/index.ts";
import { scanText, scanPath } from "../src/policy/brandGuard.ts";
import { assertAnalyzerSourcesReadOnly } from "../src/policy/readOnlyGuard.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (name: string) => path.join(root, "tests", "fixtures", name);

describe("project analysis", () => {
  test("detects TypeScript frontend projects", async () => {
    const report = await analyzeProject({ cwd: fixture("ts-vite") });

    expect(report.profile.languages).toContain("TypeScript");
    expect(report.profile.frameworks).toContain("React");
    expect(report.profile.frameworks).toContain("Vite");
    expect(report.recommendations.some((item) => item.id === "hook-typescript-typecheck")).toBe(true);
    expect(report.recommendations.some((item) => item.id === "hook-sensitive-file-guard")).toBe(true);

    const markdown = renderReport(report, "markdown");
    expect(scanText(markdown)).toEqual([]);
  });

  test("detects Rust workspaces", async () => {
    const report = await analyzeProject({ cwd: fixture("rust-workspace") });

    expect(report.profile.languages).toContain("Rust");
    expect(report.profile.packageManagers).toContain("cargo");
    expect(report.recommendations.some((item) => item.id === "skill-rust-verify")).toBe(true);
    expect(report.recommendations.some((item) => item.id === "agent-repository-explorer")).toBe(true);
  });

  test("prefers refining existing CrabCode skills", async () => {
    const report = await analyzeProject({ cwd: fixture("existing-crabcode-skills") });

    expect(report.profile.crabcodeFiles).toContain("CRABCODE.md");
    expect(report.profile.crabcodeFiles).toContain(".crabcode/skills");
    expect(report.recommendations.some((item) => item.id === "workflow-refine-existing-skills")).toBe(true);
    expect(report.recommendations.some((item) => item.id === "workflow-init-context")).toBe(false);
  });

  test("detects nested workspace frontend packages", async () => {
    const report = await analyzeProject({ cwd: fixture("nested-workspace") });

    expect(report.profile.frameworks).toContain("React");
    expect(report.profile.frameworks).toContain("Vite");
    expect(report.profile.testCommands).toContain("apps/web/package.json test: vitest run");
    expect(report.recommendations.some((item) => item.id === "mcp-browser-automation")).toBe(true);
    expect(report.recommendations.some((item) => item.id === "agent-repository-explorer")).toBe(true);
  });

  test("rejects missing scan roots", async () => {
    await expect(analyzeProject({ cwd: path.join(os.tmpdir(), "missing-crabcode-setup-root") })).rejects.toThrow("Cannot scan");
  });

  test("sanitizes target repository evidence before rendering", async () => {
    const token = ["c", "la", "ude"].join("");
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "crabcode-brand-sanitize-"));
    await mkdir(path.join(tempRoot, "src", "components"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "package.json"),
      JSON.stringify({
        scripts: { [`test:${token}`]: "vitest run" },
        dependencies: { react: "latest" },
        devDependencies: { typescript: "latest", vite: "latest", vitest: "latest" },
      }),
    );
    await writeFile(path.join(tempRoot, "src", "components", `${token}-view.tsx`), "export const View = 1;\n");

    const report = await analyzeProject({ cwd: tempRoot });
    const markdown = renderReport(report, "markdown");
    const json = renderReport(report, "json");

    expect(scanText(markdown)).toEqual([]);
    expect(scanText(json)).toEqual([]);
    expect(markdown).toContain("[redacted]");
  });
});

describe("policy checks", () => {
  test("brand guard reports prohibited product terms", () => {
    const token = ["c", "la", "ude"].join("");
    expect(scanText(`avoid ${token} here`)).toHaveLength(1);
  });

  test("brand guard ignores audit reports and nested legal notices", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "crabcode-brand-ignore-"));
    const token = ["c", "la", "ude"].join("");
    await mkdir(path.join(tempRoot, "plugins", "alpha", "docs", "legal"), { recursive: true });
    await mkdir(path.join(tempRoot, "docs", "audit"), { recursive: true });
    await mkdir(path.join(tempRoot, "docs", "huibao"), { recursive: true });
    await writeFile(path.join(tempRoot, "plugins", "alpha", "docs", "legal", "THIRD_PARTY_NOTICES.md"), token);
    await writeFile(path.join(tempRoot, "docs", "audit", "report.md"), token);
    await writeFile(path.join(tempRoot, "docs", "huibao", "report.md"), token);
    await writeFile(path.join(tempRoot, "docs", "2026-01-01-x-实施方案存档.md"), token);
    await writeFile(path.join(tempRoot, "docs", "2026-01-01-x-执行日志.md"), token);

    expect(await scanPath(tempRoot)).toEqual([]);
  });

  test("brand guard passes repository product files", async () => {
    expect(await scanPath(root)).toEqual([]);
  });

  test("analyzer sources stay read-only", async () => {
    expect(await assertAnalyzerSourcesReadOnly(root)).toEqual([]);
  });
});
