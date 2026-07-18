import { extname, join, normalize, resolve } from "node:path";

const pluginRoot = resolve(import.meta.dir, "..");
const root = resolve(pluginRoot, "apps/publisher-app/dist");
const port = Number.parseInt(process.env.CRABPUBLISH_UI_PORT ?? "4173", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("CRABPUBLISH_UI_PORT must be an integer between 1 and 65535");
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml"
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
const previewSecurityHeaders = {
  ...securityHeaders,
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
  "X-Frame-Options": "SAMEORIGIN"
};
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const previewPath = resolve(root, "article-preview.html");

function safeAssetPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relative);
  return candidate.startsWith(`${root}/`) ? candidate : null;
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const host = request.headers.get("host")?.toLowerCase();
    if (!host || !allowedHosts.has(host)) {
      return new Response("Misdirected Request", { status: 421, headers: securityHeaders });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: securityHeaders });
    }

    const assetPath = safeAssetPath(url.pathname);
    if (assetPath) {
      const asset = Bun.file(assetPath);
      if (await asset.exists()) {
        const assetHeaders = assetPath === previewPath ? previewSecurityHeaders : securityHeaders;
        return new Response(request.method === "HEAD" ? null : asset, {
          headers: {
            ...assetHeaders,
            "Content-Type": contentTypes[extname(assetPath)] ?? "application/octet-stream"
          }
        });
      }
    }

    const index = Bun.file(join(root, "index.html"));
    if (!(await index.exists())) {
      return new Response("UI build not found. Run `bun run build` first.", {
        status: 503,
        headers: securityHeaders
      });
    }

    return new Response(request.method === "HEAD" ? null : index, {
      headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

process.stdout.write(`CrabPublish Hub UI listening on ${server.url}app\n`);
