import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMcpContract } from "../../src/policy/mcpContractValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "mcp-contract-validator-"));
}

async function writePlugin(
  root: string,
  name: string,
  files: Record<string, unknown>,
): Promise<void> {
  const pluginRoot = path.join(root, "plugins", name);
  for (const [relPath, payload] of Object.entries(files)) {
    const target = path.join(pluginRoot, relPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
  }
}

async function writeMarketplace(root: string, plugins: Array<{ name: string; version: string }>): Promise<void> {
  const dir = path.join(root, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "marketplace.json"), JSON.stringify({ plugins }, null, 2));
}

const errorsOf = (issues: Awaited<ReturnType<typeof validateMcpContract>>) =>
  issues.filter((issue) => issue.severity === "error");

describe("mcp contract validator", () => {
  test("accepts a pinned required plugin with a committed distribution artifact", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "alpha", version: "1.0.0" }]);
    await writePlugin(root, "alpha", {
      ".crabcode-plugin/plugin.json": { name: "alpha", version: "1.0.0", requiredMcpServers: ["alpha"] },
      "package.json": { name: "alpha", version: "1.0.0", scripts: { start: "bun --no-env-file dist/server.js" } },
      ".mcp.json": { mcpServers: { alpha: { command: "bun", args: ["--no-env-file", "${CRABCODE_PLUGIN_ROOT}/dist/server.js"] } } },
      "dist/server.js": "// bundled",
    });
    expect(await validateMcpContract(root)).toEqual([]);
  });

  test("rejects required names without a server, installers, floating versions and missing artifacts", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "beta", version: "2.0.0" }]);
    await writePlugin(root, "beta", {
      ".crabcode-plugin/plugin.json": { name: "beta", version: "2.0.0", requiredMcpServers: ["beta", "ghost"] },
      "package.json": { name: "beta", version: "2.0.1", scripts: { start: "bun install && bun src/server.ts" } },
      ".mcp.json": {
        mcpServers: {
          beta: { command: "bun", args: ["run", "--cwd", "${CRABCODE_PLUGIN_ROOT}", "start"] },
          floating: { command: "npx", args: ["-y", "@vendor/server@latest"] },
        },
      },
    });
    const issues = await validateMcpContract(root);
    const messages = errorsOf(issues).map((issue) => issue.message).join("\n");
    expect(messages).toContain('"ghost" has no matching server');
    expect(messages).toContain("runs an installer on launch");
    expect(messages).toContain("floating version");
    expect(messages).toContain("version mismatch: manifest=2.0.0, package.json=2.0.1");
  });

  test("rejects new empty URLs and raw LSP proxies outside the legacy baselines", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "gamma", {
      ".crabcode-plugin/plugin.json": { name: "gamma", version: "0.1.0" },
      ".mcp.json": { mcpServers: { gamma: { type: "http", url: "" } } },
    });
    await writePlugin(root, "delta", {
      ".crabcode-plugin/plugin.json": { name: "delta", version: "0.1.0" },
      ".mcp.json": { "delta-lsp": { type: "stdio", command: "bun", args: ["run", "src/lsp-wrapper.ts"] } },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("empty URL");
    expect(messages).toContain("raw LSP proxy");
  });

  test("downgrades legacy baseline members to warnings and flags stale entries only when the plugin is present", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "crabwork-data", {
      ".crabcode-plugin/plugin.json": { name: "crabwork-data", version: "0.1.0" },
      ".mcp.json": { mcpServers: { snowflake: { type: "http", url: "" } } },
    });
    const withPlaceholder = await validateMcpContract(root);
    expect(errorsOf(withPlaceholder)).toEqual([]);
    expect(withPlaceholder.some((issue) => issue.severity === "warning" && issue.message.includes("legacy baseline"))).toBe(true);

    const fixedRoot = await makeTempRoot();
    await writePlugin(fixedRoot, "crabwork-data", {
      ".crabcode-plugin/plugin.json": { name: "crabwork-data", version: "0.1.0" },
      ".mcp.json": { mcpServers: { snowflake: { type: "http", url: "https://example.invalid/mcp" } } },
    });
    const stale = await validateMcpContract(fixedRoot);
    expect(errorsOf(stale).some((issue) => issue.message.includes("stale EMPTY_URL_BASELINE"))).toBe(true);
  });
});
