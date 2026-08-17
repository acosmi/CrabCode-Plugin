#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  verifyCrabcodeSecurityPort,
} from "./verify-crabcode-security-port.ts";

export const CRABCODE_SECURITY_PORT_SEALER_VERSION = "1";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const LOCK_PATH = path.join(
  REPOSITORY_ROOT,
  "plugins",
  "crabcode-security",
  "docs",
  "legal",
  "SOURCE-LOCK.json",
);
const ACTIVE_MARKETPLACE_PATH = ".crabcode-plugin/marketplace.json";
const STAGED_ENTRY_PATH =
  "plugins/crabcode-security/docs/legal/TARGET-MARKETPLACE-ENTRY.json";
const REPLAY_PATCH_PATH =
  "plugins/crabcode-security/docs/legal/FULL-PORT.patch";
const PATCH_GENERATOR_PATH =
  "scripts/build-crabcode-security-port-patch.ts";
const SEALER_PATH = "scripts/seal-crabcode-security-port.ts";
const VERIFIER_PATH = "scripts/verify-crabcode-security-port.ts";

type JsonRecord = Record<string, any>;

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function utf8Compare(left: string, right: string): number {
  return Buffer.from(left).compare(Buffer.from(right));
}

function commandVersion(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} version probe exited ${String(result.status)}`);
  }
  return String(result.stdout).trim();
}

async function toolRecord(
  relativePath: string,
  version: string,
): Promise<JsonRecord> {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  const info = await lstat(absolutePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${relativePath} must be a regular file`);
  }
  const bytes = await readFile(absolutePath);
  return {
    path: relativePath,
    version,
    size: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

async function writeLock(lock: JsonRecord): Promise<void> {
  const temporaryPath = `${LOCK_PATH}.tmp-${process.pid}`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(lock, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, LOCK_PATH);
}

async function seal(upstreamCheckout: string): Promise<void> {
  const lock = JSON.parse(await readFile(LOCK_PATH, "utf8")) as JsonRecord;
  if (
    lock?.schemaVersion !== 1 ||
    lock?.lockKind !== "complete-source-port-provenance" ||
    !Array.isArray(lock.files) ||
    lock.files.length !== 25
  ) {
    throw new Error("refusing to seal an unexpected SOURCE-LOCK shape");
  }

  const axisDefinitions = lock.port?.changeAxisDefinitions;
  if (!axisDefinitions || typeof axisDefinitions !== "object") {
    throw new Error("SOURCE-LOCK is missing changeAxisDefinitions");
  }

  let targetByteCount = 0;
  const targetManifest: Array<{
    path: string;
    size: number;
    digest: string;
  }> = [];
  for (const entry of lock.files) {
    if (
      typeof entry.targetPath !== "string" ||
      !entry.targetPath.startsWith("plugins/crabcode-security/") ||
      !Array.isArray(entry.changeAxes) ||
      entry.changeAxes.length === 0
    ) {
      throw new Error(`invalid target mapping: ${String(entry.targetPath)}`);
    }
    for (const axis of entry.changeAxes) {
      if (!(axis in axisDefinitions)) {
        throw new Error(
          `${entry.targetPath} references undefined change axis ${String(axis)}`,
        );
      }
    }
    const absolutePath = path.join(REPOSITORY_ROOT, entry.targetPath);
    const info = await lstat(absolutePath);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`${entry.targetPath} must be a regular file`);
    }
    const bytes = await readFile(absolutePath);
    const mode = (info.mode & 0o111) === 0 ? "100644" : "100755";
    if (mode !== entry.mode) {
      throw new Error(
        `${entry.targetPath} mode ${mode} does not preserve ${entry.mode}`,
      );
    }
    entry.targetMode = mode;
    entry.targetSize = bytes.byteLength;
    entry.targetSha256 = sha256(bytes);
    targetByteCount += bytes.byteLength;
    targetManifest.push({
      path: entry.targetPath,
      size: bytes.byteLength,
      digest: entry.targetSha256,
    });
  }

  const manifestBytes = targetManifest
    .sort((left, right) => utf8Compare(left.path, right.path))
    .map((entry) => `${entry.path}\t${entry.size}\t${entry.digest}\n`)
    .join("");
  lock.port.targetSnapshot = {
    fileCount: lock.files.length,
    byteCount: targetByteCount,
    manifest: {
      algorithm: "sha256",
      digest: sha256(manifestBytes),
      canonicalization:
        "Sort records by UTF-8 targetPath ascending; encode each as targetPath + TAB + decimal targetSize + TAB + lowercase targetSha256 + LF; concatenate without a header.",
    },
  };

  const activeMarketplace = JSON.parse(
    await readFile(
      path.join(REPOSITORY_ROOT, ACTIVE_MARKETPLACE_PATH),
      "utf8",
    ),
  ) as JsonRecord;
  const activeMatches = Array.isArray(activeMarketplace.plugins)
    ? activeMarketplace.plugins.filter(
        (entry: JsonRecord) => entry?.name === "crabcode-security",
      )
    : [];
  if (activeMatches.length !== 0) {
    throw new Error(
      "refusing to seal while crabcode-security is active in Marketplace",
    );
  }

  const stagedEntry = JSON.parse(
    await readRegularFile(STAGED_ENTRY_PATH, "utf8"),
  );
  const canonicalEntry = canonicalJson(stagedEntry);
  lock.port.targetMarketplace = {
    releaseStatus: "staged-not-active",
    stagedEntryPath: STAGED_ENTRY_PATH,
    canonicalEntry: {
      serialization:
        "UTF-8 JSON with every object key recursively sorted ascending, arrays kept in source order, no insignificant whitespace, and exactly one trailing LF.",
      size: Buffer.byteLength(canonicalEntry),
      sha256: sha256(canonicalEntry),
    },
  };
  lock.port.promotionGateSnapshot = {
    activeMarketplacePath: ACTIVE_MARKETPLACE_PATH,
    selector: {
      collectionJsonPointer: "/plugins",
      predicate: {
        field: "name",
        operator: "equals",
        value: "crabcode-security",
      },
      expectedMatches: 0,
      observedMatches: activeMatches.length,
    },
  };

  const replayPatch = await readRegularFile(REPLAY_PATCH_PATH);
  lock.port.replay = {
    patchPath: REPLAY_PATCH_PATH,
    patchSize: replayPatch.byteLength,
    patchSha256: sha256(replayPatch),
    stripComponents: 2,
    expectedResultFileCount: lock.files.length,
    normalization: {
      baseline:
        "In a new empty temporary directory, materialize every locked upstream blob at sourceRelativePath with its locked Git mode; do not rewrite file bytes.",
      target:
        "Materialize exactly the 25 mapped product files at targetRelativePath with their current bytes and preserved source mode; do not include evidence files.",
      pathRoots:
        "Generate a no-index Git binary diff from baseline/ to target/ with a/ and b/ prefixes; replay with git apply -p2.",
      excludedEvidence:
        "plugins/crabcode-security/docs/legal/** is provenance evidence outside the 25-file product target and is excluded to prevent self-reference.",
    },
    tools: {
      generator: await toolRecord(PATCH_GENERATOR_PATH, "1"),
      sealer: await toolRecord(SEALER_PATH, CRABCODE_SECURITY_PORT_SEALER_VERSION),
      verifier: await toolRecord(VERIFIER_PATH, "1"),
    },
    environment: {
      bunVersion: Bun.version,
      gitVersion: commandVersion("git", ["--version"]),
      platform: `${process.platform}-${process.arch}`,
      locale: "C",
    },
    sealResult: {
      status: "pending",
      verificationChecks: 0,
      upstreamCommit: lock.upstream.commit,
      replayedFileCount: 0,
    },
  };

  await writeLock(lock);
  const verification = await verifyCrabcodeSecurityPort({
    upstreamCheckout,
    repositoryRoot: REPOSITORY_ROOT,
  });
  lock.port.replay.sealResult = {
    status: verification.ok ? "passed" : "failed",
    verificationChecks: verification.checks,
    upstreamCommit: lock.upstream.commit,
    replayedFileCount: verification.ok ? lock.files.length : 0,
  };
  await writeLock(lock);
  if (!verification.ok) {
    throw new Error(
      `refusing to seal after ${verification.errors.length} verification error(s): ${verification.errors.join("; ")}`,
    );
  }

  const finalVerification = await verifyCrabcodeSecurityPort({
    upstreamCheckout,
    repositoryRoot: REPOSITORY_ROOT,
  });
  if (!finalVerification.ok) {
    lock.port.replay.sealResult.status = "failed";
    lock.port.replay.sealResult.verificationChecks = finalVerification.checks;
    lock.port.replay.sealResult.replayedFileCount = 0;
    await writeLock(lock);
    throw new Error(
      `final sealed lock failed ${finalVerification.errors.length} verification error(s): ${finalVerification.errors.join("; ")}`,
    );
  }
  lock.port.replay.sealResult.verificationChecks = finalVerification.checks;
  await writeLock(lock);
  process.stdout.write(
    `Sealed ${lock.files.length} target files, ${targetByteCount} bytes, replay ${replayPatch.byteLength} bytes; ${finalVerification.checks} checks passed.\n`,
  );
}

async function readRegularFile(relativePath: string): Promise<Buffer>;
async function readRegularFile(
  relativePath: string,
  encoding: BufferEncoding,
): Promise<string>;
async function readRegularFile(
  relativePath: string,
  encoding?: BufferEncoding,
): Promise<Buffer | string> {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  const info = await lstat(absolutePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${relativePath} must be a regular file`);
  }
  return encoding
    ? readFile(absolutePath, { encoding })
    : readFile(absolutePath);
}

function usage(): string {
  return [
    "Usage:",
    "  bun run scripts/seal-crabcode-security-port.ts <upstream-git-checkout>",
    "",
    "The sealer writes passed only after the locked upstream, target, Marketplace",
    "gate, tool hashes, and full adaptation replay verify successfully.",
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage()}\n`);
  } else if (argv.length !== 1 || !argv[0]) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
  } else {
    await seal(argv[0]);
  }
}
