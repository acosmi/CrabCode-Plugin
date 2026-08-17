import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderApp } from "../apps/publisher-app/src/app.ts";
import { articlePreviewDocument, articlePreviewMarkdown } from "../apps/publisher-app/src/article-preview.ts";
import { routes } from "../apps/publisher-app/src/routes.ts";

const pluginRoot = resolve(import.meta.dir, "..");
const outdir = resolve(pluginRoot, "apps/publisher-app/dist");

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [resolve(pluginRoot, "apps/publisher-app/index.html")],
  outdir,
  publicPath: "/",
  target: "browser",
  minify: false,
  sourcemap: "none",
  naming: {
    entry: "[name].[ext]",
    chunk: "chunks/[name]-[hash].[ext]",
    asset: "assets/[name]-[hash].[ext]"
  }
});

if (!result.success) {
  for (const log of result.logs) process.stderr.write(`${log}\n`);
  process.exit(1);
}

await writeFile(resolve(outdir, "article-preview.html"), articlePreviewDocument, "utf8");
await writeFile(resolve(outdir, "article-preview.md"), articlePreviewMarkdown, "utf8");
const staticQaDir = resolve(outdir, "qa-static");
await mkdir(staticQaDir, { recursive: true });
for (const [pathname, route] of Object.entries(routes)) {
  const slug = pathname.replace(/^\/+/, "").replaceAll("/", "__") || "root";
  const document = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${route.title} · CrabPublish Hub 静态 QA</title></head><body>${renderApp(pathname)}</body></html>`;
  await writeFile(resolve(staticQaDir, `${slug}.html`), document, "utf8");
}

process.stdout.write(`Built CrabPublish Hub UI to ${outdir}\n`);
