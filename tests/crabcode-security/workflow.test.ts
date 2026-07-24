import { describe, expect, test } from "bun:test";
import {
  defaultAgentHandler,
  emptyResearch,
  finding,
  runWorkflow,
  type AgentHandler,
} from "./workflow-host.ts";

const baseArgs = {
  scanRoot: "/fixture/repository",
  runDir: "/fixture/repository/CRABCODE-SECURITY-2026-07-23/.crabcode-security-run",
  mode: "scan",
};

function labels(run: Awaited<ReturnType<typeof runWorkflow>>): string[] {
  return run.calls.map((call) => call.options.label ?? "");
}

function researchLabels(run: Awaited<ReturnType<typeof runWorkflow>>): string[] {
  return labels(run).filter(
    (label) => label.startsWith("research:") || label.startsWith("sweep:"),
  );
}

describe("scan.js host contract and proportional shape", () => {
  test("bare invocation returns menu guidance without dispatching an agent", async () => {
    const run = await runWorkflow({});
    expect(run.calls).toEqual([]);
    expect(run.result).toEqual({
      started: false,
      reason: "no-args",
      next: expect.stringContaining("/crabcode-security"),
    });
  });

  test("short-circuits only a parsable zero-file diff", async () => {
    const empty = await runWorkflow({
      ...baseArgs,
      mode: "changes",
      effort: "medium",
      range: "HEAD",
      diffFileCount: "0",
    });
    expect(empty.calls).toEqual([]);
    expect(empty.result.coverage).toMatchObject({
      emptyDiff: true,
      diffFiles: 0,
      researchersDispatched: 0,
    });

    const unreadable = await runWorkflow({
      ...baseArgs,
      mode: "changes",
      effort: "low",
      range: "HEAD",
      diffFileCount: "not-a-count",
      diffLineCount: 0,
    });
    expect(researchLabels(unreadable)).toEqual(["research:repository:all"]);
    expect(unreadable.result.coverage.emptyDiff).toBe(false);
    expect(unreadable.result.coverage.diffSizeRejected).toContain("not-a-count");
  });

  test("uses the exact 5-file/300-line medium diff boundary", async () => {
    const small = await runWorkflow({
      ...baseArgs,
      mode: "changes",
      effort: "medium",
      range: "HEAD",
      diffFileCount: 5,
      diffLineCount: 300,
    });
    expect(small.result.coverage.collapsed).toBe("small-diff");
    expect(small.result.coverage.researchersDispatched).toBe(1);
    expect(researchLabels(small)).toEqual(["research:repository:all"]);
    expect(small.phases).not.toContain("Inventory");
    expect(small.phases).not.toContain("Threat model");

    const full = await runWorkflow({
      ...baseArgs,
      mode: "changes",
      effort: "medium",
      range: "HEAD",
      diffFileCount: 6,
      diffLineCount: 300,
    });
    expect(full.result.coverage.collapsed).toBeNull();
    expect(full.result.coverage.researchersDispatched).toBe(4);
    expect(labels(full).filter((label) => label.startsWith("research:"))).toHaveLength(3);
    expect(labels(full).filter((label) => label.startsWith("sweep:"))).toEqual(["sweep:1"]);
    expect(full.phases).toContain("Inventory");
    expect(full.phases).toContain("Threat model");
  });

  test("low and a five-file medium scope each use one all-category researcher", async () => {
    const low = await runWorkflow({ ...baseArgs, effort: "low" });
    expect(researchLabels(low)).toEqual(["research:repository:all"]);
    expect(low.result.coverage.researchersDispatched).toBe(1);

    const scoped = await runWorkflow({
      ...baseArgs,
      effort: "medium",
      scope: ["src"],
      scopeFileCount: "5",
    });
    expect(scoped.result.coverage.collapsed).toBe("small-scope");
    expect(researchLabels(scoped)).toEqual(["research:repository:all"]);
    expect(scoped.result.coverage.researchersDispatched).toBe(1);
  });

  test("high uses two researchers per managed-language category plus two sweeps", async () => {
    const run = await runWorkflow({
      ...baseArgs,
      effort: "high",
      topLevelDirs: ["src"],
    });
    const research = labels(run).filter((label) => label.startsWith("research:"));
    const sweeps = labels(run).filter((label) => label.startsWith("sweep:"));
    expect(research).toHaveLength(6);
    expect(research.some((label) => label.includes("memory-and-unsafe"))).toBe(false);
    expect(sweeps).toEqual(["sweep:1", "sweep:2"]);
    expect(run.result.coverage).toMatchObject({
      researchersPerCell: 2,
      researchersDispatched: 8,
      researchersReturned: 8,
    });
    expect(run.calls.every((call) => call.options.schema !== undefined)).toBe(true);
    expect(
      run.calls.every((call) =>
        String(call.options.agentType).startsWith("crabcode-security:"),
      ),
    ).toBe(true);
  });

  test("adds the attack-surface secrets sweep only for a non-diff scan", async () => {
    const wholeTree = await runWorkflow({
      ...baseArgs,
      effort: "high",
      focus: "attack-surface",
      topLevelDirs: ["src"],
    });
    expect(labels(wholeTree)).toContain("sweep:secrets");
    const secret = wholeTree.calls.find((call) => call.options.label === "sweep:secrets");
    expect(secret?.prompt).toContain("including tests, fixtures, and configuration");
    expect(wholeTree.result.coverage.researchersDispatched).toBe(9);

    const diff = await runWorkflow({
      ...baseArgs,
      mode: "changes",
      effort: "high",
      focus: "attack-surface",
      range: "HEAD",
      diffFileCount: 6,
      diffLineCount: 301,
    });
    expect(labels(diff)).not.toContain("sweep:secrets");
    expect(diff.result.coverage.researchersDispatched).toBe(8);
  });
});

describe("scan.js candidate caps and adversarial voting", () => {
  test("applies the 400 raw cap before deduplication", async () => {
    const duplicates = Array.from({ length: 400 }, (_, index) =>
      finding(index, {
        file: "src/duplicate.ts",
        line: 10,
        category: "xss",
        severity: "HIGH",
      }),
    );
    const droppedUnique = finding(401, {
      file: "src/unique-low.ts",
      line: 99,
      category: "csrf",
      severity: "LOW",
    });
    const handler: AgentHandler = (prompt, options, attempt) => {
      if (options.label?.startsWith("research:")) {
        return { findings: [...duplicates, droppedUnique] };
      }
      return defaultAgentHandler(prompt, options, attempt);
    };

    const run = await runWorkflow({ ...baseArgs, effort: "low" }, handler);
    expect(run.result.votes).toMatchObject({
      candidates: 401,
      candidates_deduped: 1,
      unreviewed_candidate_sites: 1,
    });
    expect(run.result.coverage.candidatesDroppedByCap).toBe(1);
    expect(run.result.findings).toHaveLength(1);
    expect(labels(run).filter((label) => label.startsWith("panel:"))).toHaveLength(3);
  });

  test("verifies no more than 45 deduplicated candidates", async () => {
    const handler: AgentHandler = (prompt, options, attempt) => {
      if (options.label?.startsWith("research:")) {
        return { findings: Array.from({ length: 46 }, (_, index) => finding(index)) };
      }
      return defaultAgentHandler(prompt, options, attempt);
    };

    const run = await runWorkflow({ ...baseArgs, effort: "low" }, handler);
    expect(run.result.findings).toHaveLength(45);
    expect(run.result.votes).toMatchObject({
      candidates: 46,
      candidates_deduped: 46,
      unreviewed_candidate_sites: 1,
    });
    expect(run.result.coverage.unverifiedByCap).toBe(1);
    expect(labels(run).filter((label) => label.startsWith("panel:"))).toHaveLength(135);
  });

  test("requires all three panel voters even when two returned votes are positive", async () => {
    const handler: AgentHandler = (prompt, options, attempt) => {
      const label = options.label ?? "";
      if (label.startsWith("research:")) return { findings: [finding(0)] };
      if (label.startsWith("panel:F1:v3")) return null;
      return defaultAgentHandler(prompt, options, attempt);
    };

    const run = await runWorkflow({ ...baseArgs, effort: "low" }, handler);
    expect(run.result.findings).toEqual([]);
    expect(run.result.votes.rounds.F1.panel).toEqual({
      true: 2,
      false: 0,
      voters: 2,
    });
    expect(labels(run).filter((label) => label.startsWith("panel:F1:v3"))).toEqual([
      "panel:F1:v3",
      "panel:F1:v3:retry1",
      "panel:F1:v3:retry2",
    ]);
    expect(run.scheduledDelays).toHaveLength(2);
    expect(run.logs.some((line) => line.includes("only 2/3 voters returned"))).toBe(true);
  });

  test("keeps exactly a two-of-three complete panel quorum", async () => {
    const handler: AgentHandler = (prompt, options, attempt) => {
      const label = options.label ?? "";
      if (label.startsWith("research:")) return { findings: [finding(0)] };
      if (label === "panel:F1:v3") {
        return { verdict: "FALSE_POSITIVE", reasoning: "One lens disagrees." };
      }
      return defaultAgentHandler(prompt, options, attempt);
    };
    const run = await runWorkflow({ ...baseArgs, effort: "low" }, handler);
    expect(run.result.findings).toHaveLength(1);
    expect(run.result.votes.rounds.F1.panel).toEqual({
      true: 2,
      false: 1,
      voters: 3,
    });
  });

  test("max preserves the first-panel keep when repanel and red-team votes are incomplete", async () => {
    const handler: AgentHandler = (prompt, options, attempt) => {
      const label = options.label ?? "";
      if (label.startsWith("research:")) return { findings: [finding(0)] };
      if (label === "panel:F1:v3") {
        return { verdict: "FALSE_POSITIVE", reasoning: "Marginal first panel." };
      }
      if (label.startsWith("repanel:F1:v3")) return null;
      if (label.startsWith("redteam:F1")) return null;
      return defaultAgentHandler(prompt, options, attempt);
    };

    const run = await runWorkflow(
      {
        ...baseArgs,
        mode: "changes",
        effort: "max",
        range: "HEAD",
        diffFileCount: 5,
        diffLineCount: 300,
      },
      handler,
    );
    expect(run.result.findings).toHaveLength(1);
    expect(run.result.votes.rounds.F1.adversarial).toEqual({
      repanel: { true: 2, false: 0, voters: 2 },
      redteam: "no-vote",
    });
    expect(run.scheduledDelays).toHaveLength(4);
    expect(run.logs.filter((line) => line.includes("first-panel verdict stands"))).toHaveLength(2);
  });

  test("does not retry an agent exception as though it were a falsy result", async () => {
    let calls = 0;
    const handler: AgentHandler = (_prompt, options) => {
      if (options.label?.startsWith("research:")) {
        calls += 1;
        throw new Error("simulated host exception");
      }
      return emptyResearch;
    };
    await expect(runWorkflow({ ...baseArgs, effort: "low" }, handler)).rejects.toThrow(
      "simulated host exception",
    );
    expect(calls).toBe(1);
  });
});

describe("scan.js inventory completeness", () => {
  test("offers exactly one correction then records a still-incomplete partition", async () => {
    const handler: AgentHandler = (prompt, options, attempt) => {
      if (options.label?.startsWith("inventory")) {
        return {
          components: [
            {
              name: "component-a",
              paths: ["a"],
              language: "JavaScript",
              role: "application",
            },
          ],
          securityScanSkippedComponents: [],
        };
      }
      return defaultAgentHandler(prompt, options, attempt);
    };

    const run = await runWorkflow(
      {
        ...baseArgs,
        effort: "medium",
        topLevelDirs: ["a", "b"],
      },
      handler,
    );
    expect(labels(run).filter((label) => label.startsWith("inventory"))).toEqual([
      "inventory",
      "inventory:complete1",
    ]);
    expect(run.result.coverage).toMatchObject({
      completenessCheckOutcome: "partial",
      unaccountedTopLevelDirs: ["b"],
    });
    expect(run.result.coverage.inventoryRejected).toHaveLength(2);
    expect(
      run.calls.find((call) => call.options.label === "inventory:complete1")?.prompt,
    ).toContain("YOUR PREVIOUS ANSWER WAS REJECTED");
  });
});
