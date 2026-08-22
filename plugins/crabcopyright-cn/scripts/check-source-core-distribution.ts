import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const pluginRoot = path.resolve(import.meta.dir, "..");
const committed = path.join(pluginRoot, "dist", "source-core.js");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "crabcopyright-dist-check-"));
const rebuilt = path.join(tempRoot, "source-core.js");

try {
  const proc = Bun.spawnSync({
    cmd: [
      "bun", "build", "src/source-core-cli.ts", "--outfile", rebuilt,
      "--target", "node", "--format", "esm", "--banner", "#!/usr/bin/env node",
    ],
    cwd: pluginRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`bundle rebuild failed:\n${proc.stderr.toString()}${proc.stdout.toString()}`);
  }
  const [actual, expected] = await Promise.all([readFile(committed), readFile(rebuilt)]);
  if (!actual.equals(expected)) {
    throw new Error("dist/source-core.js is stale; run `bun run build` in plugins/crabcopyright-cn");
  }
  process.stdout.write(`source-core distribution current (${actual.byteLength} bytes)\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
