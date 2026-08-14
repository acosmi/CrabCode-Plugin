import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { readdir } from "node:fs/promises";

const pluginRoot = resolve(import.meta.dir, "..");
const require = createRequire(import.meta.url);
const packagePath = require.resolve("vnu-jar/package.json");
const jarPath = resolve(dirname(packagePath), "build/dist/vnu.jar");
const distRoot = resolve(pluginRoot, "apps/publisher-app/dist");

if (!(await Bun.file(jarPath).exists())) throw new Error(`Nu Html Checker jar not found: ${jarPath}`);

async function htmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? htmlFiles(resolve(root, entry.name))
    : entry.name.endsWith(".html") ? [resolve(root, entry.name)] : []));
  return nested.flat().sort();
}

const inputs = await htmlFiles(distRoot);
if (inputs.length === 0) throw new Error(`Built HTML not found under: ${distRoot}`);

const versionProbe = Bun.spawnSync(["java", "-jar", jarPath, "--version"], { cwd: pluginRoot });
if (versionProbe.exitCode !== 0) {
  process.stderr.write(versionProbe.stderr.toString());
  process.exit(versionProbe.exitCode);
}
const version = versionProbe.stdout.toString().trim() || versionProbe.stderr.toString().trim();
if (!version.startsWith("26.7.15")) throw new Error(`Expected Nu 26.7.15, found ${version}`);

for (const htmlPath of inputs) {
  const check = Bun.spawnSync(["java", "-jar", jarPath, "--format", "json", "--errors-only", htmlPath], { cwd: pluginRoot });
  const stdout = check.stdout.toString().trim();
  const stderr = check.stderr.toString().trim();
  let report: { messages?: unknown[] } = {};
  if (stdout || stderr) {
    const candidate = stdout.startsWith("{") ? stdout : stderr;
    try {
      report = JSON.parse(candidate) as { messages?: unknown[] };
    } catch {
      process.stderr.write(`Nu returned non-JSON output for ${htmlPath}:\n${stdout}\n${stderr}\n`);
      process.exit(1);
    }
  }
  const messages = Array.isArray(report.messages) ? report.messages : [];
  if (check.exitCode !== 0 || messages.length > 0) {
    process.stderr.write(`${htmlPath}\n${JSON.stringify(report, null, 2)}\n`);
    process.exit(check.exitCode || 1);
  }
}
process.stdout.write(`nu-html: ${version}; 0 errors across ${inputs.length} built HTML documents\n`);
