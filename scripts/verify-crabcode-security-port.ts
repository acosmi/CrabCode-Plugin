#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_FILE_COUNT = 25;
const SOURCE_LOCK_RELATIVE_PATH =
  "plugins/crabcode-security/docs/legal/SOURCE-LOCK.json";
const DEFAULT_REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));

export const CRABCODE_SECURITY_PORT_VERIFIER_VERSION = "1";

type JsonObject = Record<string, unknown>;

interface LockedFile {
  sourcePath: string;
  sourceRelativePath: string;
  targetPath: string;
  targetRelativePath: string;
  mode: string;
  size: number;
  sha256: string;
  gitBlobSha1: string;
  targetSize: number;
  targetSha256: string;
  targetMode: string;
}

interface Selector {
  collectionJsonPointer: string;
  predicate: {
    field: string;
    operator: string;
    value: string;
  };
  expectedMatches: number;
  observedMatches: number;
}

interface CanonicalEntry {
  size: number;
  sha256: string;
}

interface ToolRecord {
  path: string;
  version: string;
  size: number;
  sha256: string;
}

interface SourceLock {
  schemaVersion: number;
  lockKind: string;
  upstream: {
    commit: string;
    commitTreeGitSha1: string;
    plugin: {
      path: string;
      treeGitSha1: string;
      fileCount: number;
      byteCount: number;
      manifest: {
        algorithm: string;
        digest: string;
      };
    };
    marketplace: {
      path: string;
      size: number;
      sha256: string;
      gitBlobSha1: string;
      selector: Selector;
      canonicalEntry: CanonicalEntry & {
        snapshotPath: string;
        snapshotFileSize: number;
        snapshotFileSha256: string;
      };
    };
  };
  port: {
    targetRoot: string;
    mappingCardinality: string;
    expectedSourceFiles: number;
    observedSourceFiles: number;
    observedUniqueTargetPaths: number;
    unmappedSourcePaths: string[];
    duplicatedTargetPaths: string[];
    targetSnapshot: {
      fileCount: number;
      byteCount: number;
      manifest: {
        algorithm: string;
        digest: string;
      };
    };
    replay: {
      patchPath: string;
      patchSize: number;
      patchSha256: string;
      stripComponents: number;
      expectedResultFileCount: number;
      normalization: {
        baseline: string;
        target: string;
        pathRoots: string;
        excludedEvidence: string;
      };
      tools: {
        generator: ToolRecord;
        sealer: ToolRecord;
        verifier: ToolRecord;
      };
      environment: {
        bunVersion: string;
        gitVersion: string;
        platform: string;
        locale: string;
      };
      sealResult: {
        status: "pending" | "passed" | "failed";
        verificationChecks: number;
        upstreamCommit: string;
        replayedFileCount: number;
      };
    };
    targetMarketplace: {
      releaseStatus: "staged-not-active";
      stagedEntryPath: string;
      canonicalEntry: CanonicalEntry;
    };
    promotionGateSnapshot: {
      activeMarketplacePath: string;
      selector: Selector;
    };
  };
  files: LockedFile[];
}

interface GitTreeEntry {
  mode: string;
  type: string;
  object: string;
  size: number;
  path: string;
}

export interface VerificationOptions {
  upstreamCheckout: string;
  repositoryRoot?: string;
}

export interface VerificationReport {
  ok: boolean;
  checks: number;
  errors: string[];
  upstreamCheckout: string;
  repositoryRoot: string;
}

class Audit {
  checks = 0;
  readonly errors: string[] = [];

  equal(label: string, actual: unknown, expected: unknown): void {
    this.checks += 1;
    if (!Object.is(actual, expected)) {
      this.errors.push(
        `${label}: expected ${formatValue(expected)}, received ${formatValue(actual)}`,
      );
    }
  }

  true(label: string, condition: boolean, detail?: string): void {
    this.checks += 1;
    if (!condition) {
      this.errors.push(detail ? `${label}: ${detail}` : `${label}: check failed`);
    }
  }

  fail(label: string, error: unknown): void {
    this.checks += 1;
    this.errors.push(`${label}: ${errorMessage(error)}`);
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8Compare(left: string, right: string): number {
  return Buffer.from(left).compare(Buffer.from(right));
}

function encodeCanonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((entry) => encodeCanonicalJson(entry)).join(",")}]`;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error("canonical JSON does not accept non-finite numbers");
      }
      return JSON.stringify(value);
    case "object": {
      const object = value as JsonObject;
      const keys = Object.keys(object).sort(utf8Compare);
      return `{${keys
        .map(
          (key) =>
            `${JSON.stringify(key)}:${encodeCanonicalJson(object[key])}`,
        )
        .join(",")}}`;
    }
    default:
      throw new Error(`canonical JSON does not accept ${typeof value}`);
  }
}

/**
 * Serializes the selected marketplace entry exactly as SOURCE-LOCK specifies:
 * recursively sorted UTF-8 object keys, source-order arrays, and one final LF.
 */
export function canonicalJson(value: unknown): string {
  return `${encodeCanonicalJson(value)}\n`;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertLock(value: unknown): asserts value is SourceLock {
  if (!isObject(value)) throw new Error("SOURCE-LOCK root must be an object");
  if (!isObject(value.upstream)) {
    throw new Error("SOURCE-LOCK upstream must be an object");
  }
  if (!isObject(value.port)) {
    throw new Error("SOURCE-LOCK port must be an object");
  }
  if (!Array.isArray(value.files)) {
    throw new Error("SOURCE-LOCK files must be an array");
  }
}

async function loadLock(repositoryRoot: string): Promise<SourceLock> {
  const lockPath = resolveInside(repositoryRoot, SOURCE_LOCK_RELATIVE_PATH);
  const parsed: unknown = JSON.parse(await readFile(lockPath, "utf8"));
  assertLock(parsed);
  return parsed;
}

function resolveInside(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`locked path must be relative: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`locked path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

function git(checkout: string, args: string[]): Buffer {
  const result = spawnSync("git", args, {
    cwd: checkout,
    encoding: "buffer",
    env: {
      ...process.env,
      GIT_NO_LAZY_FETCH: "1",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? []).toString("utf8").trim();
    throw new Error(
      `git ${args[0] ?? "<command>"} exited ${String(result.status)}${
        stderr ? `: ${stderr}` : ""
      }`,
    );
  }
  return Buffer.from(result.stdout ?? []);
}

function gitText(checkout: string, args: string[]): string {
  return git(checkout, args).toString("utf8").trim();
}

function parseTreeEntries(bytes: Buffer): GitTreeEntry[] {
  const records = bytes.toString("utf8").split("\0");
  if (records.at(-1) === "") records.pop();

  return records.map((record) => {
    const tab = record.indexOf("\t");
    if (tab < 0) throw new Error(`invalid git ls-tree record: ${record}`);
    const metadata = record.slice(0, tab);
    const entryPath = record.slice(tab + 1);
    const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+) +([0-9]+|-)$/.exec(
      metadata,
    );
    if (!match) throw new Error(`invalid git ls-tree metadata: ${metadata}`);
    const [, mode, type, object, sizeText] = match;
    if (!mode || !type || !object || !sizeText) {
      throw new Error(`incomplete git ls-tree metadata: ${metadata}`);
    }
    const size = Number(sizeText);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`invalid blob size for ${entryPath}: ${sizeText}`);
    }
    return { mode, type, object, size, path: entryPath };
  });
}

function treeEntries(
  checkout: string,
  commit: string,
  objectPath: string,
  recursive: boolean,
): GitTreeEntry[] {
  const args = ["ls-tree", "-z", "--long", "--full-tree"];
  if (recursive) args.push("-r");
  args.push(commit, "--", objectPath);
  return parseTreeEntries(git(checkout, args));
}

function gitBlob(checkout: string, object: string): Buffer {
  return git(checkout, ["cat-file", "blob", object]);
}

function selectMarketplaceEntries(
  marketplace: unknown,
  selector: Selector,
): unknown[] {
  if (!isObject(marketplace)) {
    throw new Error("marketplace root must be an object");
  }
  if (selector.collectionJsonPointer !== "/plugins") {
    throw new Error(
      `unsupported marketplace collection pointer: ${selector.collectionJsonPointer}`,
    );
  }
  if (selector.predicate.operator !== "equals") {
    throw new Error(
      `unsupported marketplace predicate: ${selector.predicate.operator}`,
    );
  }
  const collection = marketplace.plugins;
  if (!Array.isArray(collection)) {
    throw new Error("marketplace /plugins must be an array");
  }
  return collection.filter(
    (entry) =>
      isObject(entry) &&
      entry[selector.predicate.field] === selector.predicate.value,
  );
}

function filesystemMode(mode: number, symbolicLink: boolean): string {
  if (symbolicLink) return "120000";
  return (mode & 0o111) === 0 ? "100644" : "100755";
}

async function targetBytes(
  absolutePath: string,
  symbolicLink: boolean,
): Promise<Buffer> {
  if (symbolicLink) return Buffer.from(await readlink(absolutePath), "utf8");
  return readFile(absolutePath);
}

function verifyLockShape(lock: SourceLock, audit: Audit): void {
  audit.equal("SOURCE-LOCK schema version", lock.schemaVersion, 1);
  audit.equal(
    "SOURCE-LOCK kind",
    lock.lockKind,
    "complete-source-port-provenance",
  );
  audit.equal("locked source file count", lock.files.length, EXPECTED_FILE_COUNT);
  audit.equal(
    "declared upstream file count",
    lock.upstream.plugin.fileCount,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "declared port source count",
    lock.port.expectedSourceFiles,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "observed port source count",
    lock.port.observedSourceFiles,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "observed unique target count",
    lock.port.observedUniqueTargetPaths,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "declared target snapshot count",
    lock.port.targetSnapshot.fileCount,
    EXPECTED_FILE_COUNT,
  );
  audit.equal("mapping cardinality", lock.port.mappingCardinality, "one-to-one");
  audit.equal("unmapped source count", lock.port.unmappedSourcePaths.length, 0);
  audit.equal(
    "duplicated target count",
    lock.port.duplicatedTargetPaths.length,
    0,
  );
  audit.equal(
    "unique locked source paths",
    new Set(lock.files.map((entry) => entry.sourcePath)).size,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "unique locked target paths",
    new Set(lock.files.map((entry) => entry.targetPath)).size,
    EXPECTED_FILE_COUNT,
  );
  audit.equal(
    "upstream manifest algorithm",
    lock.upstream.plugin.manifest.algorithm,
    "sha256",
  );
  audit.equal(
    "target manifest algorithm",
    lock.port.targetSnapshot.manifest.algorithm,
    "sha256",
  );
  audit.equal(
    "replay seal upstream commit",
    lock.port.replay.sealResult.upstreamCommit,
    lock.upstream.commit,
  );
  audit.true(
    "replay seal status is recognized",
    ["pending", "passed", "failed"].includes(
      lock.port.replay.sealResult.status,
    ),
  );
  audit.true(
    "replay seal verification check count",
    Number.isSafeInteger(lock.port.replay.sealResult.verificationChecks) &&
      lock.port.replay.sealResult.verificationChecks >= 0,
  );
}

function verifyUpstream(
  checkout: string,
  repositoryRoot: string,
  lock: SourceLock,
  audit: Audit,
): void {
  git(checkout, ["rev-parse", "--is-inside-work-tree"]);
  git(checkout, ["cat-file", "-e", `${lock.upstream.commit}^{commit}`]);

  const commitTree = gitText(checkout, [
    "rev-parse",
    "--verify",
    `${lock.upstream.commit}^{tree}`,
  ]);
  audit.equal(
    "upstream commit tree object",
    commitTree,
    lock.upstream.commitTreeGitSha1,
  );

  const pluginTree = gitText(checkout, [
    "rev-parse",
    "--verify",
    `${lock.upstream.commit}:${lock.upstream.plugin.path}`,
  ]);
  audit.equal(
    "upstream plugin subtree object",
    pluginTree,
    lock.upstream.plugin.treeGitSha1,
  );
  audit.equal(
    "upstream plugin subtree object type",
    gitText(checkout, ["cat-file", "-t", pluginTree]),
    "tree",
  );

  const entries = treeEntries(
    checkout,
    lock.upstream.commit,
    lock.upstream.plugin.path,
    true,
  );
  audit.equal("upstream git tree file count", entries.length, EXPECTED_FILE_COUNT);
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  audit.equal("upstream git tree unique path count", byPath.size, entries.length);

  let byteCount = 0;
  const manifestRecords: Array<{
    path: string;
    size: number;
    digest: string;
  }> = [];

  for (const locked of lock.files) {
    const actual = byPath.get(locked.sourcePath);
    audit.true(
      `upstream tree contains ${locked.sourcePath}`,
      actual !== undefined,
    );
    if (!actual) continue;

    audit.equal(`${locked.sourcePath} type`, actual.type, "blob");
    audit.equal(`${locked.sourcePath} mode`, actual.mode, locked.mode);
    audit.equal(`${locked.sourcePath} blob`, actual.object, locked.gitBlobSha1);
    audit.equal(`${locked.sourcePath} ls-tree size`, actual.size, locked.size);

    const bytes = gitBlob(checkout, actual.object);
    const digest = sha256(bytes);
    audit.equal(`${locked.sourcePath} object size`, bytes.byteLength, locked.size);
    audit.equal(`${locked.sourcePath} sha256`, digest, locked.sha256);
    byteCount += bytes.byteLength;
    manifestRecords.push({
      path: locked.sourcePath,
      size: bytes.byteLength,
      digest,
    });
  }

  audit.equal("upstream total byte count", byteCount, lock.upstream.plugin.byteCount);
  const manifest = manifestRecords
    .sort((left, right) => utf8Compare(left.path, right.path))
    .map((entry) => `${entry.path}\t${entry.size}\t${entry.digest}\n`)
    .join("");
  audit.equal(
    "upstream manifest sha256",
    sha256(manifest),
    lock.upstream.plugin.manifest.digest,
  );

  const marketplaceEntries = treeEntries(
    checkout,
    lock.upstream.commit,
    lock.upstream.marketplace.path,
    false,
  );
  audit.equal("upstream marketplace tree matches", marketplaceEntries.length, 1);
  const marketplaceEntry = marketplaceEntries[0];
  if (!marketplaceEntry) return;

  audit.equal("upstream marketplace object type", marketplaceEntry.type, "blob");
  audit.equal(
    "upstream marketplace blob",
    marketplaceEntry.object,
    lock.upstream.marketplace.gitBlobSha1,
  );
  audit.equal(
    "upstream marketplace ls-tree size",
    marketplaceEntry.size,
    lock.upstream.marketplace.size,
  );

  const marketplaceBytes = gitBlob(checkout, marketplaceEntry.object);
  audit.equal(
    "upstream marketplace object size",
    marketplaceBytes.byteLength,
    lock.upstream.marketplace.size,
  );
  audit.equal(
    "upstream marketplace sha256",
    sha256(marketplaceBytes),
    lock.upstream.marketplace.sha256,
  );

  const marketplace: unknown = JSON.parse(marketplaceBytes.toString("utf8"));
  const matches = selectMarketplaceEntries(
    marketplace,
    lock.upstream.marketplace.selector,
  );
  audit.equal(
    "upstream marketplace expected selector count",
    matches.length,
    lock.upstream.marketplace.selector.expectedMatches,
  );
  audit.equal(
    "upstream marketplace observed selector count",
    matches.length,
    lock.upstream.marketplace.selector.observedMatches,
  );
  if (matches.length !== 1) return;

  const canonicalEntry = canonicalJson(matches[0]);
  audit.equal(
    "upstream canonical marketplace entry size",
    Buffer.byteLength(canonicalEntry),
    lock.upstream.marketplace.canonicalEntry.size,
  );
  audit.equal(
    "upstream canonical marketplace entry sha256",
    sha256(canonicalEntry),
    lock.upstream.marketplace.canonicalEntry.sha256,
  );

  const snapshotPath = resolveInside(
    repositoryRoot,
    lock.upstream.marketplace.canonicalEntry.snapshotPath,
  );
  const snapshotBytes = readFileSync(snapshotPath);
  audit.equal(
    "upstream marketplace snapshot size",
    snapshotBytes.byteLength,
    lock.upstream.marketplace.canonicalEntry.snapshotFileSize,
  );
  audit.equal(
    "upstream marketplace snapshot sha256",
    sha256(snapshotBytes),
    lock.upstream.marketplace.canonicalEntry.snapshotFileSha256,
  );
  const snapshot: unknown = JSON.parse(snapshotBytes.toString("utf8"));
  audit.equal(
    "upstream marketplace snapshot canonical content",
    canonicalJson(snapshot),
    canonicalEntry,
  );
}

async function verifyTarget(
  repositoryRoot: string,
  lock: SourceLock,
  audit: Audit,
): Promise<void> {
  let byteCount = 0;
  const manifestRecords: Array<{
    path: string;
    size: number;
    digest: string;
  }> = [];

  for (const locked of lock.files) {
    const expectedTargetPath = path.posix.join(
      lock.port.targetRoot,
      locked.targetRelativePath,
    );
    audit.equal(
      `${locked.targetPath} mapping`,
      locked.targetPath,
      expectedTargetPath,
    );

    const absolutePath = resolveInside(repositoryRoot, locked.targetPath);
    try {
      const info = await lstat(absolutePath);
      audit.true(
        `${locked.targetPath} file type`,
        info.isFile() || info.isSymbolicLink(),
        "must be a regular file or symbolic link",
      );
      const mode = filesystemMode(info.mode, info.isSymbolicLink());
      const bytes = await targetBytes(absolutePath, info.isSymbolicLink());
      const digest = sha256(bytes);

      audit.equal(`${locked.targetPath} mode`, mode, locked.targetMode);
      audit.equal(
        `${locked.targetPath} preserved mode`,
        locked.targetMode,
        locked.mode,
      );
      audit.equal(`${locked.targetPath} size`, bytes.byteLength, locked.targetSize);
      audit.equal(`${locked.targetPath} sha256`, digest, locked.targetSha256);

      byteCount += bytes.byteLength;
      manifestRecords.push({
        path: locked.targetPath,
        size: bytes.byteLength,
        digest,
      });
    } catch (error) {
      audit.fail(`target file ${locked.targetPath}`, error);
    }
  }

  audit.equal("target total byte count", byteCount, lock.port.targetSnapshot.byteCount);
  const manifest = manifestRecords
    .sort((left, right) => utf8Compare(left.path, right.path))
    .map((entry) => `${entry.path}\t${entry.size}\t${entry.digest}\n`)
    .join("");
  audit.equal(
    "target manifest sha256",
    sha256(manifest),
    lock.port.targetSnapshot.manifest.digest,
  );

  const marketplacePath = resolveInside(
    repositoryRoot,
    lock.port.promotionGateSnapshot.activeMarketplacePath,
  );
  const marketplaceInfo = await lstat(marketplacePath);
  audit.true(
    "active marketplace is a regular file",
    marketplaceInfo.isFile() && !marketplaceInfo.isSymbolicLink(),
  );
  const marketplace: unknown = JSON.parse(await readFile(marketplacePath, "utf8"));
  const matches = selectMarketplaceEntries(
    marketplace,
    lock.port.promotionGateSnapshot.selector,
  );
  audit.equal(
    "active marketplace expected selector count",
    matches.length,
    lock.port.promotionGateSnapshot.selector.expectedMatches,
  );
  audit.equal(
    "active marketplace observed selector count",
    matches.length,
    lock.port.promotionGateSnapshot.selector.observedMatches,
  );
  audit.equal("active marketplace entry remains gated", matches.length, 0);
  audit.equal(
    "target marketplace release status",
    lock.port.targetMarketplace.releaseStatus,
    "staged-not-active",
  );

  const stagedPath = resolveInside(
    repositoryRoot,
    lock.port.targetMarketplace.stagedEntryPath,
  );
  const stagedInfo = await lstat(stagedPath);
  audit.true(
    "staged marketplace entry is a regular file",
    stagedInfo.isFile() && !stagedInfo.isSymbolicLink(),
  );
  const stagedEntry: unknown = JSON.parse(await readFile(stagedPath, "utf8"));
  const canonicalEntry = canonicalJson(stagedEntry);
  audit.equal(
    "staged canonical marketplace entry size",
    Buffer.byteLength(canonicalEntry),
    lock.port.targetMarketplace.canonicalEntry.size,
  );
  audit.equal(
    "staged canonical marketplace entry sha256",
    sha256(canonicalEntry),
    lock.port.targetMarketplace.canonicalEntry.sha256,
  );
}

async function listReplayFiles(
  root: string,
  relative = "",
): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listReplayFiles(root, child)));
      continue;
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(child);
    }
  }
  return files.sort(utf8Compare);
}

/**
 * Proves the complete target can be reconstructed from the locked upstream
 * blobs by one immutable adaptation patch. A target hash alone only proves
 * self-consistency; this replay binds every target byte and path to its source.
 */
async function verifyReplay(
  checkout: string,
  repositoryRoot: string,
  lock: SourceLock,
  audit: Audit,
): Promise<void> {
  const replay = lock.port.replay;
  audit.equal("replay strip components", replay.stripComponents, 2);
  audit.equal(
    "replay expected result count",
    replay.expectedResultFileCount,
    EXPECTED_FILE_COUNT,
  );
  const patchPath = resolveInside(repositoryRoot, replay.patchPath);
  const patchInfo = await lstat(patchPath);
  audit.true(
    "replay patch is a regular file",
    patchInfo.isFile() && !patchInfo.isSymbolicLink(),
  );
  const patchBytes = await readFile(patchPath);
  audit.equal("replay patch size", patchBytes.byteLength, replay.patchSize);
  audit.equal("replay patch sha256", sha256(patchBytes), replay.patchSha256);
  audit.true(
    "replay baseline normalization is explicit",
    replay.normalization.baseline.includes("sourceRelativePath") &&
      replay.normalization.baseline.includes("do not rewrite file bytes"),
  );
  audit.true(
    "replay target normalization is explicit",
    replay.normalization.target.includes("25 mapped product files") &&
      replay.normalization.target.includes("do not include evidence files"),
  );
  audit.true(
    "replay root mapping is explicit",
    replay.normalization.pathRoots.includes("baseline/") &&
      replay.normalization.pathRoots.includes("target/") &&
      replay.normalization.pathRoots.includes("git apply -p2"),
  );
  audit.true(
    "replay evidence exclusion is explicit",
    replay.normalization.excludedEvidence.includes("docs/legal/**") &&
      replay.normalization.excludedEvidence.includes("self-reference"),
  );

  const expectedTools: Array<[string, ToolRecord, string, string]> = [
    [
      "generator",
      replay.tools.generator,
      "scripts/build-crabcode-security-port-patch.ts",
      "1",
    ],
    [
      "sealer",
      replay.tools.sealer,
      "scripts/seal-crabcode-security-port.ts",
      "1",
    ],
    [
      "verifier",
      replay.tools.verifier,
      "scripts/verify-crabcode-security-port.ts",
      CRABCODE_SECURITY_PORT_VERIFIER_VERSION,
    ],
  ];
  for (const [label, tool, expectedPath, expectedVersion] of expectedTools) {
    audit.equal(`replay ${label} path`, tool.path, expectedPath);
    audit.equal(`replay ${label} version`, tool.version, expectedVersion);
    const toolPath = resolveInside(repositoryRoot, tool.path);
    const toolInfo = await lstat(toolPath);
    audit.true(
      `replay ${label} is a regular file`,
      toolInfo.isFile() && !toolInfo.isSymbolicLink(),
    );
    const toolBytes = await readFile(toolPath);
    audit.equal(`replay ${label} size`, toolBytes.byteLength, tool.size);
    audit.equal(`replay ${label} sha256`, sha256(toolBytes), tool.sha256);
  }
  audit.true(
    "replay seal environment Bun version",
    replay.environment.bunVersion.length > 0,
  );
  audit.true(
    "replay seal environment Git version",
    replay.environment.gitVersion.startsWith("git version "),
  );
  audit.true(
    "replay seal environment platform",
    replay.environment.platform.length > 0,
  );
  audit.equal("replay seal locale", replay.environment.locale, "C");

  const replayRoot = await mkdtemp(
    path.join(os.tmpdir(), "crabcode-security-port-replay-"),
  );
  try {
    for (const locked of lock.files) {
      const destination = resolveInside(replayRoot, locked.sourceRelativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      const bytes = gitBlob(checkout, locked.gitBlobSha1);
      await writeFile(destination, bytes);
      await chmod(destination, locked.mode === "100755" ? 0o755 : 0o644);
    }

    git(replayRoot, [
      "apply",
      `-p${String(replay.stripComponents)}`,
      "--binary",
      "--whitespace=nowarn",
      patchPath,
    ]);

    const replayedPaths = await listReplayFiles(replayRoot);
    const expectedPaths = lock.files
      .map((entry) => entry.targetRelativePath)
      .sort(utf8Compare);
    audit.equal(
      "replayed target file count",
      replayedPaths.length,
      replay.expectedResultFileCount,
    );
    audit.equal(
      "replayed target path set",
      JSON.stringify(replayedPaths),
      JSON.stringify(expectedPaths),
    );

    for (const locked of lock.files) {
      const replayedPath = resolveInside(replayRoot, locked.targetRelativePath);
      const targetPath = resolveInside(repositoryRoot, locked.targetPath);
      const replayedInfo = await lstat(replayedPath);
      const targetInfo = await lstat(targetPath);
      const replayedBytes = await targetBytes(
        replayedPath,
        replayedInfo.isSymbolicLink(),
      );
      const currentTargetBytes = await targetBytes(
        targetPath,
        targetInfo.isSymbolicLink(),
      );
      audit.equal(
        `replay ${locked.targetPath} type`,
        replayedInfo.isSymbolicLink(),
        targetInfo.isSymbolicLink(),
      );
      audit.equal(
        `replay ${locked.targetPath} mode`,
        filesystemMode(replayedInfo.mode, replayedInfo.isSymbolicLink()),
        locked.targetMode,
      );
      audit.equal(
        `replay ${locked.targetPath} byte length`,
        replayedBytes.byteLength,
        currentTargetBytes.byteLength,
      );
      audit.equal(
        `replay ${locked.targetPath} bytes`,
        sha256(replayedBytes),
        sha256(currentTargetBytes),
      );
    }
    if (replay.sealResult.status === "passed") {
      audit.equal(
        "passed replay seal result file count",
        replay.sealResult.replayedFileCount,
        replay.expectedResultFileCount,
      );
      audit.true(
        "passed replay seal recorded checks",
        replay.sealResult.verificationChecks > 0,
      );
    }
  } finally {
    await rm(replayRoot, { force: true, recursive: true });
  }
}

export async function verifyCrabcodeSecurityPort(
  options: VerificationOptions,
): Promise<VerificationReport> {
  const upstreamCheckout = path.resolve(options.upstreamCheckout);
  const repositoryRoot = path.resolve(
    options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT,
  );
  const audit = new Audit();

  let lock: SourceLock;
  try {
    lock = await loadLock(repositoryRoot);
  } catch (error) {
    audit.fail("load SOURCE-LOCK", error);
    return {
      ok: false,
      checks: audit.checks,
      errors: audit.errors,
      upstreamCheckout,
      repositoryRoot,
    };
  }

  try {
    verifyLockShape(lock, audit);
  } catch (error) {
    audit.fail("SOURCE-LOCK shape verification", error);
  }

  try {
    verifyUpstream(upstreamCheckout, repositoryRoot, lock, audit);
  } catch (error) {
    audit.fail("upstream Git-object verification", error);
  }

  try {
    await verifyTarget(repositoryRoot, lock, audit);
  } catch (error) {
    audit.fail("target verification", error);
  }

  try {
    await verifyReplay(upstreamCheckout, repositoryRoot, lock, audit);
  } catch (error) {
    audit.fail("adaptation replay verification", error);
  }

  return {
    ok: audit.errors.length === 0,
    checks: audit.checks,
    errors: audit.errors,
    upstreamCheckout,
    repositoryRoot,
  };
}

function usage(): string {
  return [
    "Usage:",
    "  bun run scripts/verify-crabcode-security-port.ts <upstream-git-checkout>",
    "",
    "The command is read-only and verifies the fixed commit recorded in",
    SOURCE_LOCK_RELATIVE_PATH,
  ].join("\n");
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (argv.length !== 1 || !argv[0]) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  const report = await verifyCrabcodeSecurityPort({
    upstreamCheckout: argv[0],
  });
  if (!report.ok) {
    process.stderr.write(
      [
        `CrabCode Security provenance verification failed (${report.errors.length} error(s), ${report.checks} checks).`,
        ...report.errors.map((error) => `- ${error}`),
        "",
      ].join("\n"),
    );
    return 1;
  }

  process.stdout.write(
    `CrabCode Security provenance verified: ${report.checks} checks passed.\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
