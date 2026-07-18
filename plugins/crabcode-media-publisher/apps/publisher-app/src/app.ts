import { demoClock, workspace } from "./fixtures.ts";
import { escapeHtml } from "./components.ts";
import { icon } from "./icons.ts";
import { resolveRoute } from "./routes.ts";

const navItems = [
  { label: "工作台", route: "/app", icon: "dashboard" as const },
  { label: "内容", route: "/app/works", icon: "works" as const },
  { label: "发布批次", route: "/app/batches/new", icon: "batches" as const },
  { label: "任务与结果", route: "/app/batches/batch-20260718-04", icon: "results" as const },
  { label: "账号与能力", route: "/app/accounts", icon: "accounts" as const },
  { label: "审计与证据", route: "/app/audit", icon: "audit" as const },
  { label: "设置与 Edge", route: "/app/settings/edge", icon: "edge" as const }
];

function isActive(pathname: string, route: string): boolean {
  if (route === "/app") return pathname === route;
  if (route === "/app/works") return pathname.startsWith("/app/works");
  if (route === "/app/batches/new") return pathname === route || pathname.endsWith("/review");
  if (route.includes("batch-20260718-04")) return pathname.includes("/app/batches/batch-") && !pathname.endsWith("/review");
  return pathname.startsWith(route);
}

export function renderApp(pathname: string): string {
  const route = resolveRoute(pathname);
  const nav = navItems.map((item) => `<a href="${item.route}" data-route${isActive(pathname, item.route) ? ' class="active" aria-current="page"' : ""}>${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`).join("");
  return `<a class="skip-link" href="#main-content">跳到主要内容</a>
    <div class="app-shell">
      <aside class="sidebar" id="sidebar" aria-label="主导航">
        <div class="brand"><span class="brand-mark" aria-hidden="true">C</span><div><strong>CrabPublish</strong><span>Hub · 本地验收版</span></div><button class="mobile-nav-close" type="button" data-action="close-nav" aria-label="关闭主导航">×</button></div>
        <nav>${nav}</nav>
        <div class="sidebar-boundary">${icon("shield")}<div><strong>副作用已关闭</strong><span>仅固定 fixture</span></div></div>
      </aside>
      <div class="app-column">
        <header class="topbar">
          <button class="mobile-menu" type="button" aria-controls="sidebar" aria-expanded="false" data-action="toggle-nav" aria-label="打开主导航"><span></span><span></span><span></span></button>
          <div class="workspace"><strong>${escapeHtml(workspace.name)}</strong><span>${escapeHtml(workspace.role)}</span></div>
          <div class="topbar-status"><span class="edge-dot" aria-hidden="true"></span><span>Edge 在线</span><time datetime="2026-07-18T14:20:00+08:00">${escapeHtml(demoClock.split(" ").slice(1, 2).join(""))}</time><span class="identity" aria-hidden="true">${escapeHtml(workspace.identity.slice(0, 1))}</span><span class="sr-only">当前身份 ${escapeHtml(workspace.identity)}</span></div>
        </header>
        <main id="main-content" tabindex="-1" data-page-title="${escapeHtml(route.title)}">${route.render()}</main>
        <footer class="app-footer"><span>CrabPublish Hub 0.1.0 fixture</span><span>白底 UI · 无远程资产 · 不连接真实平台</span></footer>
      </div>
    </div><div class="nav-backdrop" data-action="close-nav" hidden></div><div class="toast-region" role="status" aria-live="polite" aria-atomic="true"></div>`;
}
