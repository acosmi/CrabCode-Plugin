import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateReferences } from "../../src/policy/referenceValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "reference-mcp-namespace-"));
}

/**
 * Write a plugin that documents one MCP tool reference and declares no
 * .mcp.json, so the only thing deciding pass/fail is how the validator
 * classifies the server segment.
 */
async function writePluginReferencing(root: string, toolRef: string): Promise<void> {
  const pluginRoot = path.join(root, "plugins", "docs-only");
  await mkdir(path.join(pluginRoot, ".crabcode-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".crabcode-plugin", "plugin.json"),
    JSON.stringify({ name: "docs-only", version: "0.1.0", description: "fixture" }, null, 2),
  );
  await writeFile(
    path.join(pluginRoot, "README.md"),
    `# docs-only\n\nUse ${toolRef} for the thing.\n`,
  );

  const marketplaceDir = path.join(root, ".crabcode-plugin");
  await mkdir(marketplaceDir, { recursive: true });
  await writeFile(
    path.join(marketplaceDir, "marketplace.json"),
    JSON.stringify(
      { plugins: [{ name: "docs-only", source: "./plugins/docs-only", version: "0.1.0" }] },
      null,
      2,
    ),
  );
}

const mcpErrorsOf = (issues: Awaited<ReturnType<typeof validateReferences>>) =>
  issues.filter((issue) => issue.severity === "error" && issue.message.includes("mcp__"));

describe("reference validator — MCP server namespace classification", () => {
  // A plugin-provided server's wire namespace is derived at runtime as
  // `p_` + a 24-hex digest, so it can never match an authored .mcp.json key.
  // Documenting that shape must not be reported as a dangling reference.
  test("skips the derived plugin namespace p_<24 hex>", async () => {
    const root = await makeTempRoot();
    await writePluginReferencing(root, "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task");
    expect(mcpErrorsOf(await validateReferences(root))).toEqual([]);
  });

  // The exemption must stay narrow. These two controls are the reason the
  // check still has teeth: without them, "skips p_ names" could silently widen
  // into "skips anything starting with p_".
  test("still flags an undeclared ordinary server", async () => {
    const root = await makeTempRoot();
    await writePluginReferencing(root, "mcp__totallyfakeserver__do_thing");
    const errors = mcpErrorsOf(await validateReferences(root));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("totallyfakeserver");
  });

  test("still flags a p_ prefix that is not a 24-hex digest", async () => {
    const root = await makeTempRoot();
    await writePluginReferencing(root, "mcp__p_nothexadecimal__do_thing");
    const errors = mcpErrorsOf(await validateReferences(root));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("p_nothexadecimal");
  });

  test("still flags a digest of the wrong length", async () => {
    const root = await makeTempRoot();
    await writePluginReferencing(root, "mcp__p_1f4c9a2b__do_thing");
    const errors = mcpErrorsOf(await validateReferences(root));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("p_1f4c9a2b");
  });
});
