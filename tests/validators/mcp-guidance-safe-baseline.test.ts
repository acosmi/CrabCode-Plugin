import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MCP_PAUSED_PLUGINS } from "../../src/policy/mcpSafeBaseline.ts";

const root = path.resolve(import.meta.dir, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

function json(relative: string): any {
  return JSON.parse(read(relative));
}

function markdownFiles(relativeRoot: string): string[] {
  const absolute = path.join(root, relativeRoot);
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(relativeRoot, entry.name);
    if (entry.isDirectory() && !["node_modules", ".git", "dist"].includes(entry.name)) {
      files.push(...markdownFiles(relative));
    }
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative);
  }
  return files;
}

describe("MCP containment guidance", () => {
  test("classifies every paused README as historical and requires upgrade plus CrabCode restart", () => {
    for (const plugin of MCP_PAUSED_PLUGINS) {
      const readme = read(`plugins/${plugin}/README.md`);
      expect(readme, plugin).toContain("升级插件并重启 CrabCode");
      expect(readme, plugin).toContain("仅重载插件不能证明旧 MCP 客户端或进程已退出");
      expect(readme, plugin).toContain("均仅是历史配置/未来恢复审查参考");
    }
  });

  test("ships proposal-only MCP scaffolding and no executable or copyable JSON examples", () => {
    const forbidden = [
      "templates/plugin-mcp-wrapper/.mcp.json",
      "plugins/plugin-dev/skills/mcp-integration/examples/stdio-server.json",
      "plugins/plugin-dev/skills/mcp-integration/examples/sse-server.json",
      "plugins/plugin-dev/skills/mcp-integration/examples/http-server.json",
      "plugins/crabwork-plugin-management/skills/plugin-customizer/examples/customized-mcp.json",
    ];
    for (const relative of forbidden) expect(existsSync(path.join(root, relative)), relative).toBe(false);

    const proposals = [
      "templates/plugin-mcp-wrapper/MCP-PROPOSAL.md",
      "plugins/plugin-dev/skills/mcp-integration/examples/mcp-integration-proposal.md",
      "plugins/crabwork-plugin-management/skills/plugin-customizer/examples/mcp-integration-proposal.md",
    ];
    for (const relative of proposals) {
      const content = read(relative);
      expect(content, relative).toContain("non-executable");
      expect(content, relative).not.toContain('"mcpServers"');
      expect(content, relative).not.toMatch(/https?:\/\//u);
    }
  });

  test("forces MCP authoring skills to stop at a blocked non-executable proposal", () => {
    const entrypoints = [
      "plugins/plugin-dev/skills/mcp-integration/SKILL.md",
      "plugins/plugin-dev/skills/plugin-structure/SKILL.md",
      "plugins/crabwork-plugin-management/skills/plugin-customizer/SKILL.md",
      "plugins/crabwork-plugin-management/skills/create-crabcode-plugin/SKILL.md",
    ];
    for (const relative of entrypoints) {
      const content = read(relative);
      expect(content, relative).toMatch(/Emergency MCP|MCP containment|Emergency [Cc]ontainment|紧急/u);
      expect(content, relative).toContain("non-executable");
      expect(content, relative).toContain("blocked");
    }
  });

  test("contains no copyable MCP config or connection recipe in authoring guidance and references", () => {
    const guidanceFiles = [
      ...markdownFiles("plugins/plugin-dev/skills/mcp-integration"),
      ...markdownFiles("plugins/plugin-dev/skills/plugin-structure"),
      ...markdownFiles("plugins/crabwork-plugin-management/skills/plugin-customizer"),
      ...markdownFiles("plugins/crabwork-plugin-management/skills/create-crabcode-plugin"),
      ...markdownFiles("plugins/mcp-server-dev"),
      "plugins/plugin-dev/README.md",
      "plugins/plugin-dev/commands/create-plugin.md",
      "plugins/plugin-dev/agents/plugin-validator.md",
      "templates/plugin-mcp-wrapper/MCP-PROPOSAL.md",
    ];
    const forbidden = [
      /"mcpServers"\s*:/u,
      /"type"\s*:\s*"(?:sse|http)"/u,
      /\b(?:npx|uvx)\b[^\n]*\bmcp\b/iu,
      /https?:\/\/[^\s)`]+\/(?:mcp|sse)(?:[/?#]|$)/iu,
      /suggest_connectors/u,
      /Create `\.mcp\.json` at plugin root/u,
      /Add `mcpServers` field/u,
      /Update MCP config/u,
      /Configure MCP server in/u,
      /MCP configs go in/u,
    ];
    for (const relative of guidanceFiles) {
      const content = read(relative);
      for (const pattern of forbidden) {
        expect(content, `${relative} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test("keeps paused connector catalogs and skills historical with no MCPB/install bypass", () => {
    const connectorPlugins = [
      "crabwork-bio-research",
      "crabwork-customer-support",
      "crabwork-data",
      "crabwork-design",
      "crabwork-engineering",
      "crabwork-enterprise-search",
      "crabwork-hr",
      "crabwork-marketing",
      "crabwork-operations",
      "crabwork-product-management",
      "crabwork-productivity",
      "crabwork-sales",
      "crabwork-small-business",
    ];
    for (const plugin of connectorPlugins) {
      const content = read(`plugins/${plugin}/CONNECTORS.md`);
      expect(content, plugin).toContain("当前版本没有可执行 MCP 配置");
      expect(content, plugin).toContain("历史/未来");
    }

    const pausedMarkdown = MCP_PAUSED_PLUGINS.flatMap((plugin) =>
      markdownFiles(`plugins/${plugin}`).filter((relative) => !relative.includes("/docs/legal/"))
    );
    const forbidden = [
      /"mcpServers"\s*:/u,
      /https?:\/\/[^\s)`]+\.(?:mcpb|dxt)(?:[?#]|$)/iu,
      /(?:Download|Install:)[^\n]*\.(?:mcpb|dxt)/iu,
      /`\.mcp\.json` 预配置/u,
      /设置页 → MCP/u,
      /Settings → Connectors/u,
      /crabcode mcp add/u,
    ];
    for (const relative of pausedMarkdown) {
      const content = read(relative);
      for (const pattern of forbidden) {
        expect(content, `${relative} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test("bumps the changed authoring plugins and keeps marketplace versions aligned", () => {
    const marketplace = json(".crabcode-plugin/marketplace.json");
    const versions = new Map<string, string>(
      marketplace.plugins.map((entry: any) => [entry.name, entry.version]),
    );
    expect(json("plugins/plugin-dev/.crabcode-plugin/plugin.json").version).toBe("0.2.3");
    expect(versions.get("plugin-dev")).toBe("0.2.3");
    expect(json("plugins/crabwork-plugin-management/.crabcode-plugin/plugin.json").version).toBe("0.2.2");
    expect(versions.get("crabwork-plugin-management")).toBe("0.2.2");
    expect(json("plugins/mcp-server-dev/.crabcode-plugin/plugin.json").version).toBe("0.1.2");
    expect(versions.get("mcp-server-dev")).toBe("0.1.2");
  });
});
