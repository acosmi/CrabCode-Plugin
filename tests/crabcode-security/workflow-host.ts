import { readFile } from "node:fs/promises";
import path from "node:path";
import { PLUGIN_ROOT } from "./test-helpers.ts";

export interface AgentOptions {
  label?: string;
  phase?: string;
  agentType?: string;
  schema?: unknown;
  effort?: string;
  [key: string]: unknown;
}

export interface AgentCall {
  prompt: string;
  options: AgentOptions;
}

export type AgentHandler = (
  prompt: string,
  options: AgentOptions,
  attempt: number,
) => unknown | Promise<unknown>;

export interface WorkflowRun {
  result: any;
  calls: AgentCall[];
  logs: string[];
  phases: string[];
  scheduledDelays: number[];
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>;

export const emptyThreatModel = {
  entryPoints: [],
  sinks: [],
  assumptions: [],
  trustBoundaries: [],
  hotFiles: [],
};

export const emptyResearch = { findings: [] };

export function finding(
  index: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    file: `src/file-${index}.ts`,
    line: index + 1,
    category: "xss",
    severity: "HIGH",
    confidence: "HIGH",
    title: `Finding ${index}`,
    rationale: `Untrusted input reaches sink ${index}.`,
    evidence: `src/file-${index}.ts:${index + 1}`,
    snippet: `sink(${index})`,
    symbol: `handler${index}`,
    impact: "Impact",
    exploitScenario: "Exploit scenario",
    preconditions: [],
    recommendation: "Validate the input.",
    cweId: "CWE-79",
    ...overrides,
  };
}

export function defaultAgentHandler(
  _prompt: string,
  options: AgentOptions,
  _attempt?: number,
): unknown {
  const label = options.label ?? "";
  if (label.startsWith("inventory")) {
    return {
      components: [
        {
          name: "app",
          paths: ["src"],
          language: "JavaScript",
          role: "application",
          internetFacing: true,
        },
      ],
      securityScanSkippedComponents: [],
    };
  }
  if (label.startsWith("model:")) return emptyThreatModel;
  if (label.startsWith("research:") || label.startsWith("sweep:")) return emptyResearch;
  if (label.startsWith("panel:") || label.startsWith("repanel:") || label.startsWith("redteam:")) {
    return { verdict: "TRUE_POSITIVE", reasoning: "Confirmed at src/file.ts:1." };
  }
  throw new Error(`unexpected simulated agent call: ${label}`);
}

export async function runWorkflow(
  args: unknown,
  handler: AgentHandler = defaultAgentHandler,
): Promise<WorkflowRun> {
  const workflowPath = path.join(PLUGIN_ROOT, "workflows", "scan.js");
  const source = (await readFile(workflowPath, "utf8")).replace(
    /^\s*export\s+const\s+meta/,
    "const meta",
  );
  const calls: AgentCall[] = [];
  const logs: string[] = [];
  const phases: string[] = [];
  const scheduledDelays: number[] = [];
  const attempts = new Map<string, number>();

  const agent = async (prompt: unknown, options: unknown): Promise<unknown> => {
    const normalizedOptions = (options ?? {}) as AgentOptions;
    const label = normalizedOptions.label ?? "";
    const attempt = (attempts.get(label) ?? 0) + 1;
    attempts.set(label, attempt);
    const normalizedPrompt = String(prompt);
    calls.push({ prompt: normalizedPrompt, options: normalizedOptions });
    return handler(normalizedPrompt, normalizedOptions, attempt);
  };

  const parallel = async (
    tasks: Array<() => unknown | Promise<unknown>>,
  ): Promise<unknown[]> => Promise.all(tasks.map((task) => task()));

  const pipeline = async (
    items: unknown[],
    ...stages: Array<(value: any) => unknown | Promise<unknown>>
  ): Promise<unknown[]> =>
    Promise.all(
      items.map(async (item) => {
        let value = item;
        for (const stage of stages) value = await stage(value);
        return value;
      }),
    );

  const setTimeoutWithoutWaiting = (callback: () => void, delay: number): number => {
    scheduledDelays.push(delay);
    queueMicrotask(callback);
    return scheduledDelays.length;
  };

  const execute = new AsyncFunction(
    "args",
    "log",
    "phase",
    "agent",
    "pipeline",
    "parallel",
    "setTimeout",
    source,
  );
  const result = await execute(
    args,
    (message: unknown) => logs.push(String(message)),
    (name: unknown) => phases.push(String(name)),
    agent,
    pipeline,
    parallel,
    setTimeoutWithoutWaiting,
  );

  return { result, calls, logs, phases, scheduledDelays };
}
