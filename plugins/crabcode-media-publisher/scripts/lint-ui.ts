import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const pluginRoot = resolve(import.meta.dir, "..");
const sourceRoots = [
  resolve(pluginRoot, "apps/publisher-app/src"),
  resolve(pluginRoot, "apps/publisher-app/index.html"),
  resolve(pluginRoot, "packages/domain/src"),
  resolve(pluginRoot, "packages/ui")
];

async function collect(path: string): Promise<string[]> {
  const entry = await stat(path);
  if (entry.isFile()) return [path];
  const children = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(children.map((child) => child.isDirectory() ? collect(join(path, child.name)) : [join(path, child.name)]));
  return nested.flat().filter((file) => [".css", ".html", ".json", ".ts"].includes(extname(file)));
}

const files = (await Promise.all(sourceRoots.map(collect))).flat();
const errors: string[] = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  const relative = file.slice(pluginRoot.length + 1);
  if (/https?:\/\//i.test(text)) errors.push(`${relative}: remote URL is forbidden in the runtime UI`);
  if (/\b(?:localStorage|sessionStorage)\b|document\.cookie/i.test(text)) errors.push(`${relative}: browser credential storage API is forbidden`);
  if (/\son[a-z]+\s*=/i.test(text)) errors.push(`${relative}: inline event handler is forbidden`);
  if (/allow-scripts|allow-same-origin/i.test(text)) errors.push(`${relative}: preview sandbox privilege is forbidden`);
  if (/\b(?:TODO|FIXME)\b/.test(text)) errors.push(`${relative}: unresolved TODO/FIXME is forbidden in the acceptance fixture`);
}

const tokens = JSON.parse(await readFile(resolve(pluginRoot, "packages/ui/design-tokens.json"), "utf8")) as {
  tokens: Record<string, { value: string }>;
};
const css = await readFile(resolve(pluginRoot, "packages/ui/src/tokens.css"), "utf8");
for (const [name, token] of Object.entries(tokens.tokens)) {
  if (!css.includes(`${name}: ${token.value};`)) errors.push(`packages/ui: ${name} does not match design-tokens.json`);
}

const appCss = await readFile(resolve(pluginRoot, "apps/publisher-app/src/styles.css"), "utf8");
for (const selector of ["html", "body", "#app"]) {
  if (!appCss.includes(selector)) errors.push(`styles.css: missing explicit ${selector} white-surface rule`);
}
const article = await readFile(resolve(pluginRoot, "apps/publisher-app/src/article-preview.ts"), "utf8");
if (!article.includes("default-src 'none'")) errors.push("article-preview.ts: strict preview CSP is missing");
if (!article.includes("background: #fff !important")) errors.push("article-preview.ts: explicit white article surface is missing");

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`ui-lint: ${files.length} runtime files, ${Object.keys(tokens.tokens).length} tokens, zero violations\n`);
