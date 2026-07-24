#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CRABCODE_SECURITY_PATCH_GENERATOR_VERSION = "1";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_LOCK_PATH = path.join(
  REPOSITORY_ROOT,
  "plugins",
  "crabcode-security",
  "docs",
  "legal",
  "SOURCE-LOCK.json",
);
const OUTPUT_PATH = path.join(
  REPOSITORY_ROOT,
  "plugins",
  "crabcode-security",
  "docs",
  "legal",
  "FULL-PORT.patch",
);

interface LockedFile {
  sourceRelativePath: string;
  targetPath: string;
  targetRelativePath: string;
  mode: "100644" | "100755";
  size: number;
  sha256: string;
  gitBlobSha1: string;
}

interface SourceLock {
  schemaVersion: number;
  lockKind: string;
  upstream: {
    commit: string;
  };
  files: LockedFile[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveInside(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`path must be relative: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (
    resolved !== resolvedRoot &&
    !resolved.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`path escapes its declared root: ${relativePath}`);
  }
  return resolved;
}

function git(checkout: string, args: string[], allowDifference = false): Buffer {
  const result = spawnSync("git", args, {
    cwd: checkout,
    encoding: "buffer",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_NO_LAZY_FETCH: "1",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (
    result.status !== 0 &&
    !(allowDifference && result.status === 1)
  ) {
    const stderr = Buffer.from(result.stderr ?? []).toString("utf8").trim();
    throw new Error(
      `git ${args[0] ?? "<command>"} exited ${String(result.status)}${
        stderr ? `: ${stderr}` : ""
      }`,
    );
  }
  return Buffer.from(result.stdout ?? []);
}

async function materialize(
  upstreamCheckout: string,
  scratchRoot: string,
  lock: SourceLock,
): Promise<void> {
  const baselineRoot = path.join(scratchRoot, "baseline");
  const targetRoot = path.join(scratchRoot, "target");
  await Promise.all([
    mkdir(baselineRoot, { recursive: true }),
    mkdir(targetRoot, { recursive: true }),
  ]);

  for (const entry of lock.files) {
    const baselinePath = resolveInside(
      baselineRoot,
      entry.sourceRelativePath,
    );
    const targetSnapshotPath = resolveInside(
      targetRoot,
      entry.targetRelativePath,
    );
    const currentTargetPath = resolveInside(REPOSITORY_ROOT, entry.targetPath);
    await Promise.all([
      mkdir(path.dirname(baselinePath), { recursive: true }),
      mkdir(path.dirname(targetSnapshotPath), { recursive: true }),
    ]);

    const sourceBytes = git(upstreamCheckout, [
      "cat-file",
      "blob",
      entry.gitBlobSha1,
    ]);
    if (
      sourceBytes.byteLength !== entry.size ||
      sha256(sourceBytes) !== entry.sha256
    ) {
      throw new Error(
        `locked source blob does not match ${entry.sourceRelativePath}`,
      );
    }

    const targetInfo = await lstat(currentTargetPath);
    if (!targetInfo.isFile() || targetInfo.isSymbolicLink()) {
      throw new Error(`${entry.targetPath} must be a regular file`);
    }
    const targetBytes = await readFile(currentTargetPath);
    const actualMode = (targetInfo.mode & 0o111) === 0 ? "100644" : "100755";
    if (actualMode !== entry.mode) {
      throw new Error(
        `${entry.targetPath} mode ${actualMode} does not preserve ${entry.mode}`,
      );
    }

    await Promise.all([
      writeFile(baselinePath, sourceBytes),
      writeFile(targetSnapshotPath, targetBytes),
    ]);
    const permissions = entry.mode === "100755" ? 0o755 : 0o644;
    await Promise.all([
      chmod(baselinePath, permissions),
      chmod(targetSnapshotPath, permissions),
    ]);
  }
}

export async function buildCrabcodeSecurityPortPatch(
  upstreamCheckout: string,
  options: { check?: boolean } = {},
): Promise<{ byteCount: number; sha256: string }> {
  const checkout = path.resolve(upstreamCheckout);
  const lock = JSON.parse(
    await readFile(SOURCE_LOCK_PATH, "utf8"),
  ) as SourceLock;
  if (
    lock.schemaVersion !== 1 ||
    lock.lockKind !== "complete-source-port-provenance" ||
    !Array.isArray(lock.files) ||
    lock.files.length !== 25
  ) {
    throw new Error("refusing to build from an unexpected SOURCE-LOCK shape");
  }

  git(checkout, ["cat-file", "-e", `${lock.upstream.commit}^{commit}`]);
  const scratchRoot = await mkdtemp(
    path.join(os.tmpdir(), "crabcode-security-port-build-"),
  );
  try {
    await materialize(checkout, scratchRoot, lock);
    const patch = git(
      scratchRoot,
      [
        "diff",
        "--no-index",
        "--binary",
        "--full-index",
        "--diff-algorithm=myers",
        "--no-indent-heuristic",
        "--unified=3",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        "--src-prefix=a/",
        "--dst-prefix=b/",
        "--",
        "baseline",
        "target",
      ],
      true,
    );
    if (patch.byteLength === 0) {
      throw new Error("adaptation patch is unexpectedly empty");
    }

    if (options.check) {
      const existingPatch = await readFile(OUTPUT_PATH);
      if (!existingPatch.equals(patch)) {
        throw new Error(
          "generated adaptation patch differs from the sealed FULL-PORT.patch",
        );
      }
    } else {
      const temporaryOutput = `${OUTPUT_PATH}.tmp-${process.pid}`;
      await writeFile(temporaryOutput, patch, { mode: 0o644 });
      await rename(temporaryOutput, OUTPUT_PATH);
    }
    return { byteCount: patch.byteLength, sha256: sha256(patch) };
  } finally {
    await rm(scratchRoot, { force: true, recursive: true });
  }
}

function usage(): string {
  return [
    "Usage:",
    "  bun run scripts/build-crabcode-security-port-patch.ts [--check] <upstream-git-checkout>",
    "",
    "Materializes the 25 locked upstream blobs and current 25 target files into",
    "separate baseline/target roots, then emits the deterministic full port patch.",
  ].join("\n");
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const check = argv[0] === "--check";
  const checkout = check ? argv[1] : argv[0];
  if (
    (!check && argv.length !== 1) ||
    (check && argv.length !== 2) ||
    !checkout
  ) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }
  const result = await buildCrabcodeSecurityPortPatch(checkout, { check });
  process.stdout.write(
    `${check ? "Verified" : "Built"} FULL-PORT.patch: ${result.byteCount} bytes, sha256 ${result.sha256}.\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
