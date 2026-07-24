import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateReferences } from "../src/policy/referenceValidator.ts";

type FixtureFile = { rel: string; content: string };

const REGISTRY = {
  version: 1,
  capabilities: [
    {
      id: "office-spreadsheets",
      domain: "办公文档产出/电子表格",
      keywords: ["xlsx", "excel", "电子表格"],
      providers: [{ skill: "office-suite:sheets", status: "available" }],
      providerPlugins: ["office-suite"],
    },
    {
      id: "deep-research",
      domain: "深度调研",
      keywords: ["深度调研"],
      providers: [{ skill: "future-research:deep-research", status: "planned" }],
      providerPlugins: ["future-research"],
    },
  ],
};

async function makeFixture(files: FixtureFile[]): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "crabcode-refs-"));
  const base: FixtureFile[] = [
    { rel: "docs/capability-routing.json", content: JSON.stringify(REGISTRY) },
    { rel: "plugins/office-suite/skills/sheets/SKILL.md", content: "# sheets provider" },
  ];
  for (const file of [...base, ...files]) {
    const full = path.join(root, file.rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.content);
  }
  return root;
}

function messages(issues: Awaited<ReturnType<typeof validateReferences>>, severity: "error" | "warning") {
  return issues.filter((issue) => issue.severity === severity).map((issue) => issue.message);
}

describe("reference validator", () => {
  test("reports dead fully-qualified skill references", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/writer/SKILL.md", content: "路由到 `office-suite:missing-skill` 完成交付。" },
    ]);
    const issues = await validateReferences(root);
    const errors = messages(issues, "error");
    expect(errors.some((message) => message.includes("office-suite:missing-skill"))).toBe(true);
  });

  test("accepts fully-qualified agent and workflow references", async () => {
    const root = await makeFixture([
      { rel: "plugins/office-suite/agents/reviewer.md", content: "# reviewer" },
      { rel: "plugins/office-suite/workflows/audit.js", content: "export const meta = {};" },
      {
        rel: "plugins/alpha/skills/writer/SKILL.md",
        content: "委派 Agent(office-suite:reviewer) 后运行 Workflow(office-suite:audit)。",
      },
    ]);
    const issues = await validateReferences(root);
    expect(messages(issues, "error")).toEqual([]);
  });

  test("keeps skill, agent, and workflow namespaces type-safe", async () => {
    const root = await makeFixture([
      { rel: "plugins/office-suite/agents/reviewer.md", content: "# reviewer" },
      { rel: "plugins/office-suite/workflows/audit.js", content: "export const meta = {};" },
      {
        rel: "plugins/alpha/skills/writer/SKILL.md",
        content:
          "不存在的引用 `office-suite:missing`，错误类型 Agent(office-suite:audit)，以及 Workflow(office-suite:reviewer)。",
      },
    ]);
    const errors = messages(await validateReferences(root), "error");
    expect(errors.some((message) => message.includes("office-suite:missing"))).toBe(true);
    expect(errors.some((message) => message.includes("对应代理不存在"))).toBe(true);
    expect(errors.some((message) => message.includes("对应工作流不存在"))).toBe(true);
  });

  test("does not accept arbitrary nested agents or workflows as plugin callables", async () => {
    const root = await makeFixture([
      { rel: "plugins/office-suite/docs/agents/ghost.md", content: "# not loadable" },
      { rel: "plugins/office-suite/vendor/workflows/ghost.js", content: "export const meta = {};" },
      {
        rel: "plugins/alpha/skills/writer/SKILL.md",
        content: "调用 Agent(office-suite:ghost) 与 Workflow(office-suite:ghost)。",
      },
    ]);
    const errors = messages(await validateReferences(root), "error");
    expect(errors.some((message) => message.includes("对应代理不存在"))).toBe(true);
    expect(errors.some((message) => message.includes("对应工作流不存在"))).toBe(true);
  });

  test("reports references to planned provider plugins as dead links", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/writer/SKILL.md", content: "调用 `future-research:deep-research` 做调研。" },
    ]);
    const issues = await validateReferences(root);
    const errors = messages(issues, "error");
    expect(errors.some((message) => message.includes("planned"))).toBe(true);
  });

  test("ignores fqn-shaped tokens whose plugin does not exist", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/writer/SKILL.md", content: "示例 `github:issue-ref` 与 `some:thing` 均非插件引用。" },
    ]);
    const issues = await validateReferences(root);
    expect(messages(issues, "error")).toEqual([]);
  });

  test("warns when capability keywords appear without routing", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/reporter/SKILL.md", content: "输出一份 xlsx 报表交付给客户。" },
    ]);
    const issues = await validateReferences(root);
    const warnings = messages(issues, "warning");
    expect(warnings.some((message) => message.includes("office-spreadsheets=none"))).toBe(true);
  });

  test("routing reference or explicit exemption silences the warning", async () => {
    const root = await makeFixture([
      {
        rel: "plugins/alpha/skills/routed/SKILL.md",
        content: "需要 xlsx 交付时调用 `office-suite:sheets`。",
      },
      {
        rel: "plugins/alpha/skills/exempt/SKILL.md",
        content: "<!-- capability-route: office-spreadsheets=none(纯概念表格,无文件交付) -->\n表格化审查以 excel 风格呈现,但只输出 markdown。",
      },
      {
        rel: "plugins/alpha/skills/pending-ok/SKILL.md",
        content: "<!-- capability-route: deep-research=pending(provider 未就位,升级路径见正文) -->\n必要时开展深度调研。",
      },
    ]);
    const issues = await validateReferences(root);
    expect(messages(issues, "warning")).toEqual([]);
    expect(messages(issues, "error")).toEqual([]);
  });

  test("keyword matching respects ascii word boundaries", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/writer/SKILL.md", content: "An excellent guide to pptx-free workflows." },
    ]);
    const issues = await validateReferences(root);
    const warnings = messages(issues, "warning");
    expect(warnings.some((message) => message.includes("excel"))).toBe(false);
  });

  test("flags undeclared bare mcp tool references but allows declared and plugin-namespaced ones", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/broken/SKILL.md", content: "调用 mcp__office__excel_read 读取。" },
      {
        rel: "plugins/beta/skills/declared/SKILL.md",
        content: "调用 mcp__crm__list_deals 拉取商机。",
      },
      { rel: "plugins/beta/.mcp.json", content: JSON.stringify({ mcpServers: { crm: { url: "https://x" } } }) },
      {
        rel: "plugins/gamma/skills/teaching/SKILL.md",
        content: "工具命名格式为 mcp__plugin_name_server__tool。",
      },
    ]);
    const issues = await validateReferences(root);
    const errors = messages(issues, "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("mcp__office__*");
  });

  test("flags upstream container mount paths", async () => {
    const root = await makeFixture([
      { rel: "plugins/alpha/skills/legacy/SKILL.md", content: "运行 python /mnt/skills/public/xlsx/recalc.py 重算。" },
    ]);
    const issues = await validateReferences(root);
    expect(messages(issues, "error").some((message) => message.includes("/mnt/skills"))).toBe(true);
  });

  test("warns on stale pending markers once a provider is available", async () => {
    const root = await makeFixture([
      {
        rel: "plugins/alpha/skills/stale/SKILL.md",
        content: "<!-- capability-route: office-spreadsheets=pending(等待就位) -->\n输出 xlsx 报表。",
      },
    ]);
    const issues = await validateReferences(root);
    const warnings = messages(issues, "warning");
    expect(warnings.some((message) => message.includes("provider 已就位"))).toBe(true);
  });

  test("warns on markers referencing unknown capability ids", async () => {
    const root = await makeFixture([
      {
        rel: "plugins/alpha/skills/typo/SKILL.md",
        content: "<!-- capability-route: office-spreadsheet=none(拼写错误) -->\n输出 xlsx 报表。",
      },
    ]);
    const issues = await validateReferences(root);
    const warnings = messages(issues, "warning");
    expect(warnings.some((message) => message.includes("office-spreadsheet"))).toBe(true);
    expect(warnings.some((message) => message.includes("office-spreadsheets=none"))).toBe(true);
  });
});
