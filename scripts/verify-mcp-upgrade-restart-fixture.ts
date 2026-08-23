import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const PUBLIC_OLD_COMMIT = "2e0b1266dcc4c34f8930cd589ce7aaedd6aa0f10";
const MARKETPLACE_PATH = ".crabcode-plugin/marketplace.json";
const EXPECTED_SAFE_CONFIG = "plugins/crabcode-html-video/.mcp.json";
const SCRIPT_PATH = fileURLToPath(import.meta.url);

type JsonObject = Record<string, unknown>;
type Transport = "http" | "sse" | "stdio" | "unknown";

type RegistryGeneration = {
  schemaVersion: 1;
  generation: number;
  active: {
    commit: string;
    installPath: string;
    tree: string;
  };
  orphanedInstalls: Array<{
    generation: number;
    installPath: string;
    reason: "upgrade-requires-restart";
  }>;
};

type ServerRecord = {
  command: string | null;
  localStdio: boolean;
  origin: string;
  pluginName: string;
  serverName: string;
  transport: Transport;
  url: string | null;
};

type Inventory = {
  configSurfaces: string[];
  externalReferences: string[];
  marketplaceVersion: string | null;
  publishedPluginRootCount: number;
  serverCount: number;
  servers: ServerRecord[];
  transports: {
    http: number;
    localStdio: number;
    remote: number;
    sse: number;
    stdio: number;
    unknown: number;
  };
};

type WorkerReport = {
  activeInventory: Inventory;
  event: "frozen_start" | "frozen_after_registry_switch" | "fresh_start";
  frozenRegistryGeneration: number;
  frozenInstallPath: string;
  observedRegistry: RegistryGeneration;
  orphanPresence: Array<{ exists: boolean; installPath: string }>;
  pid: number;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function repositoryRoot(): string {
  const candidate = resolve(dirname(SCRIPT_PATH), "..");
  const result = runChecked("git", ["-C", candidate, "rev-parse", "--show-toplevel"]);
  return realpathSync(result.trim());
}

function runChecked(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" },
  });
  if (result.error || result.status !== 0) {
    const details = [result.stderr, result.stdout, String(result.error ?? "")]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${command} ${args.join(" ")} failed (status ${String(result.status)}): ${details}`,
    );
  }
  return result.stdout;
}

function gitObject(repo: string, ref: string): { commit: string; tree: string } {
  const commit = runChecked("git", [
    "-C",
    repo,
    "rev-parse",
    "--verify",
    `${ref}^{commit}`,
  ]).trim();
  assertCondition(
    /^[0-9a-f]{40}$/u.test(commit),
    `Git ref ${ref} did not resolve to a full lowercase commit SHA`,
  );
  const tree = runChecked("git", [
    "-C",
    repo,
    "rev-parse",
    "--verify",
    `${commit}^{tree}`,
  ]).trim();
  assertCondition(
    /^[0-9a-f]{40}$/u.test(tree),
    `Git commit ${commit} did not resolve to a full lowercase tree SHA`,
  );
  return { commit, tree };
}

function archiveGitObject(repo: string, commit: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  const tarPath = join(dirname(destination), `${commit}.tar`);
  runChecked("git", [
    "-C",
    repo,
    "archive",
    "--format=tar",
    `--output=${tarPath}`,
    commit,
  ]);
  runChecked("tar", ["-xf", tarPath, "-C", destination]);
  rmSync(tarPath, { force: true });
}

function relativePosix(root: string, file: string): string {
  const value = relative(root, file).split(sep).join("/");
  return value || ".";
}

function resolveInside(root: string, candidate: string, label: string): string {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(root, candidate);
  assertCondition(
    resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`),
    `${label} escapes its plugin root: ${candidate}`,
  );
  return resolvedCandidate;
}

function transportOf(server: JsonObject): Transport {
  const type = typeof server.type === "string" ? server.type.toLowerCase() : "";
  if (type === "sse") return "sse";
  if (type === "http" || type === "streamable-http") return "http";
  if (typeof server.command === "string" || type === "stdio") return "stdio";
  if (typeof server.url === "string" && /^https?:\/\//iu.test(server.url)) return "http";
  return "unknown";
}

function isLocalStdio(server: JsonObject, pluginRoot: string): boolean {
  if (transportOf(server) !== "stdio" || typeof server.command !== "string") return false;
  if (!Array.isArray(server.args)) return false;

  return server.args.some((argument) => {
    if (typeof argument !== "string") return false;
    const prefix = "${CRABCODE_PLUGIN_ROOT}/";
    if (!argument.startsWith(prefix)) return false;
    const target = resolveInside(pluginRoot, argument.slice(prefix.length), "stdio target");
    return existsSync(target) && statSync(target).isFile();
  });
}

function inventoryPublishedMcp(archiveRoot: string): Inventory {
  const marketplaceFile = join(archiveRoot, MARKETPLACE_PATH);
  const marketplace = readJson(marketplaceFile);
  assertCondition(isObject(marketplace), `${MARKETPLACE_PATH} must be a JSON object`);
  assertCondition(Array.isArray(marketplace.plugins), `${MARKETPLACE_PATH}.plugins must be an array`);

  const metadata = isObject(marketplace.metadata) ? marketplace.metadata : {};
  const configSurfaces = new Set<string>();
  const externalReferences = new Set<string>();
  const servers: ServerRecord[] = [];
  const visitedExternalFiles = new Set<string>();

  const addServerMap = (
    value: unknown,
    pluginName: string,
    pluginRoot: string,
    originFile: string,
  ): void => {
    if (!isObject(value)) {
      externalReferences.add(`${pluginName}:${relativePosix(archiveRoot, originFile)}:invalid-inline-value`);
      return;
    }
    const map = isObject(value.mcpServers) ? value.mcpServers : value;
    for (const [serverName, rawServer] of Object.entries(map)) {
      if (!isObject(rawServer)) {
        externalReferences.add(
          `${pluginName}:${relativePosix(archiveRoot, originFile)}:${serverName}:invalid-server`,
        );
        continue;
      }
      const transport = transportOf(rawServer);
      servers.push({
        command: typeof rawServer.command === "string" ? rawServer.command : null,
        localStdio: isLocalStdio(rawServer, pluginRoot),
        origin: relativePosix(archiveRoot, originFile),
        pluginName,
        serverName,
        transport,
        url: typeof rawServer.url === "string" ? rawServer.url : null,
      });
    }
  };

  const addDeclaration = (
    value: unknown,
    pluginName: string,
    pluginRoot: string,
    originFile: string,
  ): void => {
    if (Array.isArray(value)) {
      for (const child of value) addDeclaration(child, pluginName, pluginRoot, originFile);
      return;
    }
    if (typeof value === "string") {
      if (/^(?:https?:\/\/|[^?#]+\.(?:mcpb|dxt)(?:[?#].*)?$)/iu.test(value)) {
        externalReferences.add(`${pluginName}:${relativePosix(archiveRoot, originFile)}:${value}`);
        return;
      }
      const externalFile = resolveInside(pluginRoot, value, "manifest mcpServers path");
      if (!existsSync(externalFile) || !statSync(externalFile).isFile()) {
        externalReferences.add(
          `${pluginName}:${relativePosix(archiveRoot, originFile)}:${value}:missing`,
        );
        return;
      }
      if (visitedExternalFiles.has(externalFile)) return;
      visitedExternalFiles.add(externalFile);
      configSurfaces.add(`${pluginName}:${relativePosix(archiveRoot, externalFile)}`);
      addDeclaration(readJson(externalFile), pluginName, pluginRoot, externalFile);
      return;
    }
    addServerMap(value, pluginName, pluginRoot, originFile);
  };

  for (const rawPlugin of marketplace.plugins) {
    assertCondition(isObject(rawPlugin), "marketplace plugin entry must be an object");
    assertCondition(typeof rawPlugin.name === "string", "marketplace plugin name must be a string");
    assertCondition(typeof rawPlugin.source === "string", `${rawPlugin.name}.source must be local`);
    assertCondition(
      rawPlugin.source === "." || rawPlugin.source === "./" || rawPlugin.source.startsWith("./"),
      `${rawPlugin.name}.source must be a repository-local path for this fixture`,
    );
    const pluginRoot = resolveInside(archiveRoot, rawPlugin.source, "marketplace source");
    assertCondition(
      existsSync(pluginRoot) && statSync(pluginRoot).isDirectory(),
      `${rawPlugin.name}.source does not resolve to a directory`,
    );

    const rootConfig = join(pluginRoot, ".mcp.json");
    if (existsSync(rootConfig) && statSync(rootConfig).isFile()) {
      configSurfaces.add(`${rawPlugin.name}:${relativePosix(archiveRoot, rootConfig)}`);
      addDeclaration(readJson(rootConfig), rawPlugin.name, pluginRoot, rootConfig);
    }

    for (const manifestRelative of [".crabcode-plugin/plugin.json"]) {
      const manifestFile = join(pluginRoot, manifestRelative);
      if (!existsSync(manifestFile) || !statSync(manifestFile).isFile()) continue;
      const manifest = readJson(manifestFile);
      assertCondition(isObject(manifest), `${relativePosix(archiveRoot, manifestFile)} must be an object`);
      if (Object.prototype.hasOwnProperty.call(manifest, "mcpServers")) {
        configSurfaces.add(`${rawPlugin.name}:${relativePosix(archiveRoot, manifestFile)}#mcpServers`);
        addDeclaration(manifest.mcpServers, rawPlugin.name, pluginRoot, manifestFile);
      }
    }

    if (Object.prototype.hasOwnProperty.call(rawPlugin, "mcpServers")) {
      configSurfaces.add(`${rawPlugin.name}:${MARKETPLACE_PATH}#mcpServers`);
      addDeclaration(rawPlugin.mcpServers, rawPlugin.name, pluginRoot, marketplaceFile);
    }
  }

  servers.sort((left, right) =>
    [left.pluginName, left.origin, left.serverName]
      .join("\0")
      .localeCompare([right.pluginName, right.origin, right.serverName].join("\0")),
  );
  const count = (transport: Transport) =>
    servers.filter((server) => server.transport === transport).length;

  return {
    configSurfaces: [...configSurfaces].sort(),
    externalReferences: [...externalReferences].sort(),
    marketplaceVersion: typeof metadata.version === "string" ? metadata.version : null,
    publishedPluginRootCount: marketplace.plugins.length,
    serverCount: servers.length,
    servers,
    transports: {
      http: count("http"),
      localStdio: servers.filter((server) => server.localStdio).length,
      remote: count("http") + count("sse"),
      sse: count("sse"),
      stdio: count("stdio"),
      unknown: count("unknown"),
    },
  };
}

function readRegistry(file: string): RegistryGeneration {
  const value = readJson(file);
  assertCondition(isObject(value), "registry must be a JSON object");
  assertCondition(value.schemaVersion === 1, "registry schemaVersion must be 1");
  assertCondition(Number.isInteger(value.generation), "registry generation must be an integer");
  assertCondition(isObject(value.active), "registry active entry is required");
  assertCondition(typeof value.active.commit === "string", "registry active commit is required");
  assertCondition(typeof value.active.tree === "string", "registry active tree is required");
  assertCondition(
    typeof value.active.installPath === "string" && isAbsolute(value.active.installPath),
    "registry active installPath must be absolute",
  );
  assertCondition(Array.isArray(value.orphanedInstalls), "registry orphanedInstalls must be an array");
  return value as unknown as RegistryGeneration;
}

function workerReport(
  event: WorkerReport["event"],
  frozen: RegistryGeneration,
  observed: RegistryGeneration,
): WorkerReport {
  return {
    activeInventory: inventoryPublishedMcp(frozen.active.installPath),
    event,
    frozenRegistryGeneration: frozen.generation,
    frozenInstallPath: frozen.active.installPath,
    observedRegistry: observed,
    orphanPresence: observed.orphanedInstalls.map((entry) => ({
      exists: existsSync(entry.installPath),
      installPath: entry.installPath,
    })),
    pid: process.pid,
  };
}

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function runWorker(mode: string, registryFile: string): Promise<void> {
  const startup = readRegistry(registryFile);
  if (mode === "fresh") {
    emit(workerReport("fresh_start", startup, startup));
    return;
  }
  assertCondition(mode === "frozen", `unknown worker mode: ${mode}`);
  emit(workerReport("frozen_start", startup, startup));

  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const rawLine of input) {
    const command = rawLine.trim();
    if (command === "inspect") {
      emit(workerReport("frozen_after_registry_switch", startup, readRegistry(registryFile)));
    } else if (command === "exit") {
      return;
    } else if (command) {
      throw new Error(`unknown worker command: ${command}`);
    }
  }
}

function writeRegistry(file: string, value: RegistryGeneration): void {
  const temporary = `${file}.next`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

function workerArguments(mode: "frozen" | "fresh", registryFile: string): string[] {
  return [SCRIPT_PATH, "--worker", mode, "--registry", registryFile];
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length
    ? (process.argv[index + 1] ?? null)
    : null;
}

async function nextJsonLine(
  iterator: AsyncIterator<string>,
  child: ChildProcessWithoutNullStreams,
  stderr: () => string,
): Promise<WorkerReport> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("worker output timed out")), 30_000);
      }),
    ]);
    assertCondition(!result.done, `worker ${String(child.pid)} exited without a report: ${stderr()}`);
    return JSON.parse(result.value) as WorkerReport;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForExit(child: ChildProcessWithoutNullStreams, stderr: () => string): Promise<void> {
  if (child.exitCode === null) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        once(child, "exit"),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("worker exit timed out")), 30_000);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  assertCondition(child.exitCode === 0, `worker exited ${String(child.exitCode)}: ${stderr()}`);
}

function assertOldInventory(inventory: Inventory, phase: string): void {
  assertCondition(inventory.transports.http > 0, `${phase}: old Git bytes must contain HTTP MCP`);
  assertCondition(inventory.transports.sse > 0, `${phase}: old Git bytes must contain SSE MCP`);
  assertCondition(inventory.transports.remote > 0, `${phase}: old active remote count must be positive`);
}

function assertSafeInventory(inventory: Inventory): void {
  assertCondition(
    inventory.configSurfaces.length === 1 &&
      inventory.configSurfaces[0] === `crabcode-html-video:${EXPECTED_SAFE_CONFIG}`,
    `HEAD is not the committed safe release: expected only ${EXPECTED_SAFE_CONFIG}; got ${inventory.configSurfaces.join(", ") || "none"}. Commit the complete remediation before running this fixture.`,
  );
  assertCondition(inventory.serverCount === 1, `safe HEAD must publish exactly one MCP server`);
  assertCondition(inventory.transports.stdio === 1, `safe HEAD must publish one stdio server`);
  assertCondition(inventory.transports.localStdio === 1, `safe HEAD stdio server must load local plugin bytes`);
  assertCondition(inventory.transports.http === 0, `safe HEAD must publish zero HTTP servers`);
  assertCondition(inventory.transports.sse === 0, `safe HEAD must publish zero SSE servers`);
  assertCondition(inventory.transports.remote === 0, `safe HEAD active remote count must be zero`);
  assertCondition(inventory.transports.unknown === 0, `safe HEAD must contain no unknown MCP transport`);
  assertCondition(inventory.externalReferences.length === 0, `safe HEAD must contain no external MCP reference`);
  const [server] = inventory.servers;
  assertCondition(
    server?.pluginName === "crabcode-html-video" &&
      server.serverName === "html-video" &&
      server.command === "bun" &&
      server.localStdio,
    "safe HEAD MCP server must be the bundled crabcode-html-video/html-video sidecar",
  );
}

async function runFixture(): Promise<JsonObject> {
  const repo = repositoryRoot();
  const oldObject = gitObject(repo, PUBLIC_OLD_COMMIT);
  assertCondition(
    oldObject.commit === PUBLIC_OLD_COMMIT,
    `public old commit resolved unexpectedly: ${oldObject.commit}`,
  );
  const safeObject = gitObject(repo, "HEAD");
  const temporaryRoot = mkdtempSync(join(tmpdir(), "crabcode-mcp-upgrade-"));
  let report: JsonObject | null = null;

  try {
    const oldInstall = join(temporaryRoot, "generation-1-old");
    const safeInstall = join(temporaryRoot, "generation-2-safe");
    const registryFile = join(temporaryRoot, "registry.json");
    archiveGitObject(repo, oldObject.commit, oldInstall);
    archiveGitObject(repo, safeObject.commit, safeInstall);

    const generationOne: RegistryGeneration = {
      schemaVersion: 1,
      generation: 1,
      active: { ...oldObject, installPath: oldInstall },
      orphanedInstalls: [],
    };
    writeRegistry(registryFile, generationOne);

    let stderrA = "";
    const processA = spawn(process.execPath, workerArguments("frozen", registryFile), {
      cwd: repo,
      env: { ...process.env, TZ: "UTC" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    processA.stderr.setEncoding("utf8");
    processA.stderr.on("data", (chunk: string) => {
      stderrA += chunk;
    });
    const linesA = createInterface({ input: processA.stdout, crlfDelay: Infinity });
    const iteratorA = linesA[Symbol.asyncIterator]();

    try {
      const processAStart = await nextJsonLine(iteratorA, processA, () => stderrA);
      assertCondition(processAStart.event === "frozen_start", "process A did not report frozen_start");
      assertCondition(processAStart.observedRegistry.generation === 1, "process A must start on generation 1");
      assertOldInventory(processAStart.activeInventory, "process A startup");

      const generationTwo: RegistryGeneration = {
        schemaVersion: 1,
        generation: 2,
        active: { ...safeObject, installPath: safeInstall },
        orphanedInstalls: [
          {
            generation: 1,
            installPath: oldInstall,
            reason: "upgrade-requires-restart",
          },
        ],
      };
      writeRegistry(registryFile, generationTwo);
      processA.stdin.write("inspect\n");
      const processAAfterSwitch = await nextJsonLine(iteratorA, processA, () => stderrA);
      assertCondition(
        processAAfterSwitch.event === "frozen_after_registry_switch",
        "process A did not inspect after registry switch",
      );
      assertCondition(processAAfterSwitch.pid === processAStart.pid, "process A identity changed");
      assertCondition(
        processAAfterSwitch.frozenRegistryGeneration === 1 &&
          processAAfterSwitch.observedRegistry.generation === 2,
        "process A must observe registry generation 2 while remaining frozen on generation 1",
      );
      assertCondition(
        processAAfterSwitch.frozenInstallPath === oldInstall &&
          processAAfterSwitch.observedRegistry.active.installPath === safeInstall,
        "process A must keep the old install path after the registry points at the safe install",
      );
      assertOldInventory(processAAfterSwitch.activeInventory, "process A after switch");
      assertCondition(
        JSON.stringify(processAAfterSwitch.activeInventory) ===
          JSON.stringify(processAStart.activeInventory),
        "process A active MCP inventory changed without a restart",
      );

      const processBResult = spawnSync(
        process.execPath,
        workerArguments("fresh", registryFile),
        {
          cwd: repo,
          encoding: "utf8",
          env: { ...process.env, TZ: "UTC" },
          timeout: 30_000,
        },
      );
      assertCondition(
        !processBResult.error && processBResult.status === 0,
        `process B failed (status ${String(processBResult.status)}): ${processBResult.stderr}\n${String(processBResult.error ?? "")}`,
      );
      const processB = JSON.parse(processBResult.stdout.trim()) as WorkerReport;
      assertCondition(processB.event === "fresh_start", "process B did not report fresh_start");
      assertCondition(processA.exitCode === null, "process A must remain alive while process B starts");
      assertCondition(processB.pid !== processAStart.pid, "process B must be a distinct subprocess");
      assertCondition(processB.observedRegistry.generation === 2, "process B must start on generation 2");
      assertCondition(processB.frozenInstallPath === safeInstall, "process B must activate the safe install path");
      assertCondition(
        processB.orphanPresence.length === 1 &&
          processB.orphanPresence[0]?.installPath === oldInstall &&
          processB.orphanPresence[0]?.exists,
        "process B must observe the old generation as a still-present orphan",
      );
      assertSafeInventory(processB.activeInventory);

      report = {
        schemaVersion: 1,
        evidenceKind: "real-git-bytes-plus-dual-process-fixture",
        git: {
          archiveMechanism: "git archive --format=tar",
          oldPublic: oldObject,
          safeHead: safeObject,
        },
        lifecycle: {
          processA: {
            afterRegistrySwitch: processAAfterSwitch,
            startup: processAStart,
          },
          processB,
          registryTransition: "generation-1-old -> generation-2-safe + generation-1-orphan",
        },
        evidenceComposition: {
          directHostCodeExecuted: false,
          fixtureClaim: "real Git bytes + generation-scoped registry + two concurrent OS processes",
          hostSuiteCompanionEvidence: "CrabCode host 57-test MCP/plugin unit suite (recorded separately)",
          limitation:
            "This fixture models the observed host generation/restart contract; it does not import or execute CrabCode host source code.",
        },
        assertions: {
          oldProcessRemainsRemotePositiveUntilRestart: true,
          restartActivatesSafeLocalStdioOnly: true,
          restartedActiveRemoteCount: 0,
          oldInstallRemainsPresentOnlyAsOrphan: true,
        },
      };

      processA.stdin.end("exit\n");
      await waitForExit(processA, () => stderrA);
      linesA.close();
    } finally {
      if (processA.exitCode === null) {
        processA.stdin.end("exit\n");
        await waitForExit(processA, () => stderrA).catch(() => processA.kill());
      }
      linesA.close();
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }

  assertCondition(report !== null, "fixture did not produce a report");
  return {
    ...report,
    cleanup: {
      temporaryWorkspaceRemoved: !existsSync(temporaryRoot),
    },
  };
}

try {
  const workerMode = option("--worker");
  if (workerMode) {
    const registryFile = option("--registry");
    assertCondition(registryFile, "--registry is required in worker mode");
    await runWorker(workerMode, registryFile);
  } else {
    process.stdout.write(`${JSON.stringify(await runFixture(), null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(
    `mcp-upgrade-restart-fixture: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
