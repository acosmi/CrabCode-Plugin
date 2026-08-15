import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDocFacts } from "../../src/policy/docFactsValidator.ts";

/**
 * Every assertion here is paired. A gate that reports nothing looks identical
 * to a gate that is not wired up, so each "this is clean" case sits next to a
 * "this is caught" case using the same fixture shape. The negative controls are
 * the point: the audit that motivated this validator was itself caused by a
 * check that only ever confirmed what it already believed.
 */

async function makeRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "doc-facts-"));
}

/** `plugin-dev` is held at error; any other name reports warnings. */
async function writePluginDoc(
  root: string,
  plugin: string,
  body: string,
  relFile = "README.md",
): Promise<void> {
  const pluginRoot = path.join(root, "plugins", plugin);
  const target = path.join(pluginRoot, relFile);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

const errorsOf = (issues: Awaited<ReturnType<typeof validateDocFacts>>) =>
  issues.filter((issue) => issue.severity === "error");

const rulesOf = (issues: Awaited<ReturnType<typeof validateDocFacts>>) =>
  issues.map((issue) => issue.rule);

describe("docFactsValidator — banned claims", () => {
  test("a fictional hook event in an audited plugin is an error", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Register an AgentStop hook.\n");
    const issues = await validateDocFacts(root);
    expect(rulesOf(errorsOf(issues))).toContain("fictional-hook-event");
  });

  test("the real event name it should have been is not flagged", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Register a SubagentStop hook.\n");
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("each remaining banned claim is caught", async () => {
    const cases: Array<[string, string]> = [
      ["fictional-mcp-namespace", "Call mcp__plugin_asana__create_task now.\n"],
      ["fictional-hook-placeholder", "Read $TOOL_INPUT from the hook.\n"],
      ["fictional-hook-decision", 'Emit {"decision": "deny"} to refuse.\n'],
      ["fictional-marketplace-name", "Add the crabcode-marketplace source.\n"],
      ["fictional-debug-flag", "Pass debug-logs to see more.\n"],
      ["unresolved-model-placeholder", "Set model to <model-id> here.\n"],
      ["fictional-api-key-env", "Export AGENT_API_KEY before running.\n"],
      ["fictional-answers-index", 'Read answers["0"] from the result.\n'],
    ];
    for (const [rule, body] of cases) {
      const root = await makeRoot();
      await writePluginDoc(root, "plugin-dev", body);
      const issues = await validateDocFacts(root);
      expect(rulesOf(errorsOf(issues))).toContain(rule);
    }
  });

  test("an unaudited plugin reports the same finding as a warning, not an error", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "some-other-plugin", "Register an AgentStop hook.\n");
    const issues = await validateDocFacts(root);
    expect(errorsOf(issues)).toHaveLength(0);
    expect(issues.map((issue) => issue.severity)).toEqual(["warning"]);
  });

  test("verbatim third-party licence text under docs/legal is exempt", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "Upstream text mentioning AgentStop.\n",
      path.join("docs", "legal", "THIRD_PARTY_NOTICES.md"),
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });
});

describe("docFactsValidator — hook event names", () => {
  test("a prose event list naming an event the runtime never emits is caught", async () => {
    // This is the shape the audit actually missed: the fictional name sat in a
    // sentence, not in a JSON key, so a key-only rule would have walked past it.
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "**Available events**: PreToolUse, Stop, PhaseComplete, SessionEnd\n",
    );
    const issues = await validateDocFacts(root);
    expect(rulesOf(errorsOf(issues))).toContain("unknown-hook-event");
    expect(issues[0]?.message).toContain("PhaseComplete");
  });

  test("a prose event list of real events, with a trailing sentence, is clean", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "**Commonly used events**: PreToolUse, Stop, SubagentStop — the runtime emits 27 in total; see the Hook Development skill.\n",
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("a hooks config key that is not an event is caught", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", '{\n  "BeforeEdit": [{ "type": "command" }]\n}\n');
    const issues = await validateDocFacts(root);
    expect(rulesOf(errorsOf(issues))).toContain("unknown-hook-event");
  });

  test("an ordinary PascalCase key with a string value is not mistaken for an event", async () => {
    // "Authorization" outnumbers every real event in this repo's docs. Keying
    // the rule on the value shape rather than the name is what keeps it quiet.
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      '{\n  "headers": { "Authorization": "Bearer token", "Accept": "application/json" }\n}\n',
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("a real event used as a hooks config key is clean", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", '{\n  "PreToolUse": [{ "type": "command" }]\n}\n');
    expect(await validateDocFacts(root)).toHaveLength(0);
  });
});

describe("docFactsValidator — /plugin subcommands", () => {
  test("the top-level update form is caught", async () => {
    // The parser falls through to the menu instead of erroring, so this one
    // fails silently in the user's hands — the reason it is checked at all.
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Run `/plugin update` to refresh.\n");
    const issues = await validateDocFacts(root);
    expect(rulesOf(errorsOf(issues))).toContain("unknown-plugin-subcommand");
  });

  test("the marketplace form that does exist is clean", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Run `/plugin marketplace update` to refresh.\n");
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("a nonexistent marketplace action is caught", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Run `/plugin marketplace sync` now.\n");
    const issues = await validateDocFacts(root);
    expect(rulesOf(errorsOf(issues))).toContain("unknown-plugin-subcommand");
  });

  test("real subcommands are clean", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "Use `/plugin install x@crabcode-plugins-official`, `/plugin enable x`, `/plugin validate .`\n",
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });
});

describe("docFactsValidator — counter-example markers", () => {
  test("a marker on the same line suppresses the finding", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "AgentStop does not exist. <!-- doc-facts-allow: fictional-hook-event -->\n",
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("a marker on the preceding line suppresses the finding", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "<!-- doc-facts-allow: fictional-hook-event -->\nAgentStop does not exist.\n",
    );
    expect(await validateDocFacts(root)).toHaveLength(0);
  });

  test("a marker only suppresses the rule it names", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "AgentStop and <model-id>. <!-- doc-facts-allow: fictional-hook-event -->\n",
    );
    const errors = errorsOf(await validateDocFacts(root));
    expect(rulesOf(errors)).toEqual(["unresolved-model-placeholder"]);
  });

  test("a marker that suppresses nothing is reported so it cannot outlive its text", async () => {
    const root = await makeRoot();
    await writePluginDoc(
      root,
      "plugin-dev",
      "The event is SubagentStop. <!-- doc-facts-allow: fictional-hook-event -->\n",
    );
    const issues = await validateDocFacts(root);
    expect(rulesOf(issues)).toContain("stale-allow-marker");
  });

  test("a marker naming a rule that does not exist is reported", async () => {
    const root = await makeRoot();
    await writePluginDoc(root, "plugin-dev", "Text. <!-- doc-facts-allow: no-such-rule -->\n");
    const issues = await validateDocFacts(root);
    expect(rulesOf(issues)).toContain("unknown-allow-marker");
  });
});

describe("docFactsValidator — facts stay sourced from the product", () => {
  test("the exported hook event list is the 27 the runtime emits", async () => {
    const facts = await import("../../src/policy/facts/hook-events.json", {
      with: { type: "json" },
    });
    expect(facts.default.events).toHaveLength(27);
    expect(facts.default.events).toContain("SubagentStop");
    expect(facts.default.events).not.toContain("AgentStop");
    expect(facts.default.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  test("the exported subcommand list excludes the top-level update that does not exist", async () => {
    const facts = await import("../../src/policy/facts/plugin-subcommands.json", {
      with: { type: "json" },
    });
    expect(facts.default.subcommands).toContain("marketplace");
    expect(facts.default.subcommands).not.toContain("update");
    expect(facts.default.marketplaceActions).toContain("update");
  });
});
