import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const script = path.resolve("scripts/check-crablaw-source-overlap.py");

function run(upstream: string, target: string) {
  return Bun.spawnSync([
    "python3",
    script,
    "--upstream-root",
    upstream,
    "--target-root",
    target,
    "--shingle-size",
    "64",
    "--json",
  ], { stdout: "pipe", stderr: "pipe" });
}

describe("CrabLaw source overlap gate", () => {
  test("passes unrelated text and fails a copied long normalized passage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "crablaw-overlap-"));
    const upstream = path.join(root, "upstream");
    const target = path.join(root, "target");
    await mkdir(upstream);
    await mkdir(target);
    await writeFile(path.join(upstream, "source.md"), "这是用于测试来源隔离的长段落。".repeat(12));
    await writeFile(path.join(target, "different.md"), "完全不同的仓库原生实现内容。".repeat(12));
    expect(run(upstream, target).exitCode).toBe(0);
    await writeFile(path.join(target, "copied.md"), "这是用于测试来源隔离的长段落。".repeat(12));
    expect(run(upstream, target).exitCode).toBe(1);
  });
});
