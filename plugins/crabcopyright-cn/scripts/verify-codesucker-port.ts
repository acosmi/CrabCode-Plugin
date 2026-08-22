import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

type LockFile = {
  upstream: {
    commit: string;
    coreTreeGitSha1: string;
    noticeGitBlobSha1: string;
    licenseGitBlobSha1: string;
    thirdPartyNoticesGitBlobSha1: string;
  };
  port: { expectedFiles: number; expectedBytes: number };
  files: Array<{ path: string; size: number; gitBlobSha1: string; sha256: string }>;
};

const pluginRoot = path.resolve(import.meta.dir, "..");
const lockPath = path.join(pluginRoot, "docs", "legal", "SOURCE-LOCK.json");
const vendorRoot = path.join(pluginRoot, "vendor", "codesucker-core", "src");

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobSha1(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

async function verifyLegal(pathValue: string, expectedBlob: string): Promise<void> {
  const bytes = await readFile(path.join(pluginRoot, "docs", "legal", pathValue));
  const actual = gitBlobSha1(bytes);
  if (actual !== expectedBlob) throw new Error(`${pathValue} Git blob 不匹配: ${actual} != ${expectedBlob}`);
}

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(lockPath, "utf8")) as LockFile;
  if (lock.upstream.commit !== "2e39375cf6891b9d958c277f1c6eb3b5104814d9") {
    throw new Error(`未批准的上游 commit: ${lock.upstream.commit}`);
  }
  if (lock.upstream.coreTreeGitSha1 !== "cb277b12a6328ec92c8c2d7ab3adb30584142880") {
    throw new Error(`core tree SHA 不匹配: ${lock.upstream.coreTreeGitSha1}`);
  }

  const actualFiles = (await readdir(vendorRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expectedFiles = lock.files.map((entry) => entry.path).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`vendor 文件集合不一致\nactual=${actualFiles.join(",")}\nexpected=${expectedFiles.join(",")}`);
  }

  let bytesTotal = 0;
  for (const record of lock.files) {
    const bytes = await readFile(path.join(vendorRoot, record.path));
    bytesTotal += bytes.byteLength;
    if (bytes.byteLength !== record.size) throw new Error(`${record.path} 大小不匹配`);
    if (sha256(bytes) !== record.sha256) throw new Error(`${record.path} SHA-256 不匹配`);
    if (gitBlobSha1(bytes) !== record.gitBlobSha1) throw new Error(`${record.path} Git blob SHA-1 不匹配`);
  }
  if (lock.files.length !== lock.port.expectedFiles || bytesTotal !== lock.port.expectedBytes) {
    throw new Error(`vendor 汇总不匹配: ${lock.files.length} files / ${bytesTotal} bytes`);
  }

  await verifyLegal("LICENSE-CodeSucker.txt", lock.upstream.licenseGitBlobSha1);
  await verifyLegal("upstream-NOTICE.txt", lock.upstream.noticeGitBlobSha1);
  await verifyLegal("upstream-THIRD_PARTY_NOTICES.txt", lock.upstream.thirdPartyNoticesGitBlobSha1);
  process.stdout.write(`codesucker-port: verified ${lock.files.length} files / ${bytesTotal} bytes at ${lock.upstream.commit}\n`);
}

await main();
