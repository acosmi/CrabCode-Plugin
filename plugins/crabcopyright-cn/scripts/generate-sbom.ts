import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type LockEntry = { key: string; name: string; version: string; integrity?: string };

const root = resolve(import.meta.dir, "..");
const outputPath = join(root, "docs", "legal", "SBOM.cdx.json");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  name: string; version: string; dependencies: Record<string, string>; devDependencies?: Record<string, string>;
};

function parseDescriptor(descriptor: string): { name: string; version: string } {
  const separator = descriptor.lastIndexOf("@");
  if (separator <= 0 || separator === descriptor.length - 1) throw new Error(`unsupported bun.lock descriptor: ${descriptor}`);
  return { name: descriptor.slice(0, separator), version: descriptor.slice(separator + 1) };
}

function parseLockEntries(text: string): LockEntry[] {
  const marker = '  "packages": {';
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("bun.lock has no packages block");
  const entries: LockEntry[] = [];
  for (const line of text.slice(start + marker.length).split("\n")) {
    if (line === "  }" || line === "  },") break;
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(": [") || !(trimmed.endsWith("],") || trimmed.endsWith("]"))) continue;
    const parsed = JSON.parse(`{${trimmed.replace(/,$/, "")}}`) as Record<string, unknown[]>;
    const [key, value] = Object.entries(parsed)[0];
    if (!Array.isArray(value) || typeof value[0] !== "string") continue;
    const descriptor = parseDescriptor(value[0]);
    entries.push({ key, ...descriptor, ...(typeof value[3] === "string" ? { integrity: value[3] } : {}) });
  }
  if (!entries.length) throw new Error("bun.lock packages block produced no components");
  return entries;
}

function purl(name: string, version: string): string {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.slice(1).split("/", 2);
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function hashRecord(integrity?: string): { alg: string; content: string }[] | undefined {
  if (!integrity) return undefined;
  const match = integrity.match(/^(sha256|sha384|sha512)-(.+)$/);
  if (!match) return undefined;
  return [{ alg: match[1].toUpperCase().replace("SHA", "SHA-"), content: Buffer.from(match[2], "base64").toString("hex") }];
}

const knownLicenses: Record<string, string> = {
  "@types/bun": "MIT", "@types/node": "MIT", "bun-types": "MIT", "typescript": "Apache-2.0",
  chardet: "MIT", docx: "MIT", "fast-glob": "MIT", "iconv-lite": "MIT", ignore: "MIT", jszip: "MIT",
  nanoid: "MIT", pako: "MIT", sax: "ISC", xml: "MIT", "xml-js": "MIT",
  "readable-stream": "MIT", "safe-buffer": "MIT", "safer-buffer": "MIT", inherits: "ISC",
  "core-util-is": "MIT", isarray: "MIT", "process-nextick-args": "MIT", "util-deprecate": "MIT",
  immediate: "MIT", lie: "MIT", setimmediate: "MIT", "queue-microtask": "MIT", "run-parallel": "MIT",
  reusify: "MIT", fastq: "ISC", merge2: "MIT", micromatch: "MIT", picomatch: "MIT",
  braces: "MIT", "fill-range": "MIT", "to-regex-range": "MIT", "is-number": "MIT",
  "glob-parent": "ISC", "is-glob": "MIT", "is-extglob": "MIT", "undici-types": "MIT",
  "@nodelib/fs.scandir": "MIT", "@nodelib/fs.stat": "MIT", "@nodelib/fs.walk": "MIT",
};

const lockEntries = parseLockEntries(await readFile(join(root, "bun.lock"), "utf8"));
const directRuntime = new Set(Object.keys(pkg.dependencies ?? {}));
const directDevelopment = new Set(Object.keys(pkg.devDependencies ?? {}));
const unique = new Map<string, LockEntry>();
for (const entry of lockEntries) unique.set(`${entry.name}@${entry.version}`, entry);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const components = [...unique.values()]
  .sort((a, b) => a.name === b.name ? compare(a.version, b.version) : compare(a.name, b.name))
  .map((entry) => {
    const ref = purl(entry.name, entry.version);
    const kind = directRuntime.has(entry.name) ? "direct-runtime" : directDevelopment.has(entry.name) ? "direct-development" : "transitive";
    const hashes = hashRecord(entry.integrity);
    return {
      type: "library", name: entry.name, version: entry.version, "bom-ref": ref, purl: ref,
      ...(kind === "direct-runtime" ? { scope: "required" } : kind === "direct-development" ? { scope: "optional" } : {}),
      ...(hashes ? { hashes } : {}),
      ...(knownLicenses[entry.name] ? { licenses: [{ expression: knownLicenses[entry.name] }] } : {}),
      properties: [
        { name: "crabcode:bun-lock-key", value: entry.key },
        { name: "crabcode:dependency-kind", value: kind },
      ],
    };
  });

const rootRef = purl(pkg.name, pkg.version);
const document = {
  bomFormat: "CycloneDX", specVersion: "1.5", version: 1,
  metadata: {
    component: { type: "application", name: pkg.name, version: pkg.version, "bom-ref": rootRef, purl: rootRef,
      licenses: [{ expression: "Apache-2.0" }] },
    properties: [
      { name: "crabcode:source-lockfile", value: "bun.lock" },
      { name: "crabcode:upstream-lock", value: "docs/legal/SOURCE-LOCK.json" },
      { name: "crabcode:component-coverage", value: "all locked runtime and development components" },
    ],
  },
  components,
  dependencies: [{ ref: rootRef, dependsOn: components.map((component) => component["bom-ref"]).sort() }],
};
const rendered = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let existing = "";
  try { existing = await readFile(outputPath, "utf8"); } catch { /* comparison below */ }
  if (existing !== rendered) {
    process.stderr.write("SBOM is missing or stale; run `bun run sbom` and review the diff.\n");
    process.exit(1);
  }
  process.stdout.write(`sbom: ${components.length} locked components match ${pkg.name}@${pkg.version}\n`);
} else {
  await Bun.write(outputPath, rendered);
  process.stdout.write(`sbom: wrote ${components.length} locked components to ${outputPath}\n`);
}
