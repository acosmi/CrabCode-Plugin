import "../../../packages/ui/src/tokens.css";
import "./styles.css";
import { renderApp } from "./app.ts";

const mount = document.querySelector<HTMLDivElement>("#app");
if (!mount) throw new Error("CrabPublish Hub mount point #app is missing");

type SessionDraft = Readonly<{ title: string; summary: string; body: string }>;
let sessionDraft: SessionDraft | null = null;
let navReturnFocus: HTMLElement | null = null;

function isMobileNavigation(): boolean {
  return window.matchMedia("(max-width: 820px)").matches;
}

function installPreview(): void {
  const frame = document.querySelector<HTMLIFrameElement>("#article-preview");
  if (!frame) return;
  frame.setAttribute("sandbox", "");
  frame.referrerPolicy = "no-referrer";
  frame.src = "/article-preview.html";
}

function render(pathname = window.location.pathname): void {
  mount!.innerHTML = renderApp(pathname);
  installPreview();
  if (sessionDraft && pathname.endsWith("/edit")) {
    const title = document.querySelector<HTMLTextAreaElement>("#editor-title");
    const summary = document.querySelector<HTMLTextAreaElement>("#editor-summary");
    const body = document.querySelector<HTMLTextAreaElement>("#editor-body");
    if (title) title.value = sessionDraft.title;
    if (summary) summary.value = sessionDraft.summary;
    if (body) body.value = sessionDraft.body;
    const state = document.querySelector<HTMLElement>("#save-state");
    if (state) state.textContent = "本页会话草稿已恢复 · 刷新会丢失";
  }
  syncNavAccessibility();
  document.title = `${document.querySelector("main")?.dataset.pageTitle ?? "CrabPublish Hub"} · CrabPublish Hub`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function navigate(href: string): void {
  const url = new URL(href, window.location.origin);
  window.history.pushState({}, "", url.pathname);
  render(url.pathname);
  document.querySelector<HTMLElement>("#main-content")?.focus();
}

function syncNavAccessibility(): void {
  const sidebar = document.querySelector<HTMLElement>("#sidebar");
  const backdrop = document.querySelector<HTMLElement>(".nav-backdrop");
  if (!sidebar) return;
  if (!isMobileNavigation()) {
    document.body.classList.remove("nav-open");
    sidebar.inert = false;
    sidebar.removeAttribute("aria-hidden");
    if (backdrop) backdrop.hidden = true;
    return;
  }
  const open = document.body.classList.contains("nav-open");
  sidebar.inert = !open;
  sidebar.setAttribute("aria-hidden", String(!open));
  if (backdrop) backdrop.hidden = !open;
}

function openNav(): void {
  navReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.classList.add("nav-open");
  const toggle = document.querySelector<HTMLButtonElement>("[data-action='toggle-nav']");
  toggle?.setAttribute("aria-expanded", "true");
  syncNavAccessibility();
  document.querySelector<HTMLElement>("#sidebar nav a")?.focus();
}

function closeNav(returnFocus = true): void {
  document.body.classList.remove("nav-open");
  const toggle = document.querySelector<HTMLButtonElement>("[data-action='toggle-nav']");
  toggle?.setAttribute("aria-expanded", "false");
  const backdrop = document.querySelector<HTMLElement>(".nav-backdrop");
  if (backdrop) backdrop.hidden = true;
  syncNavAccessibility();
  if (returnFocus) navReturnFocus?.focus();
  navReturnFocus = null;
}

function showToast(message: string): void {
  const region = document.querySelector<HTMLElement>(".toast-region");
  if (!region) return;
  region.textContent = message;
  region.classList.add("is-visible");
  window.setTimeout(() => region.classList.remove("is-visible"), 2200);
}

document.addEventListener("click", (event) => {
  const target = event.target as Element;
  const routeLink = target.closest<HTMLAnchorElement>("a[data-route]");
  if (routeLink) {
    event.preventDefault();
    closeNav(false);
    navigate(routeLink.href);
    return;
  }
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "toggle-nav") {
    if (document.body.classList.contains("nav-open")) closeNav();
    else openNav();
    return;
  }
  if (action === "close-nav") {
    closeNav();
    return;
  }
  if (action === "save-revision") {
    const title = document.querySelector<HTMLTextAreaElement>("#editor-title");
    const summary = document.querySelector<HTMLTextAreaElement>("#editor-summary");
    const body = document.querySelector<HTMLTextAreaElement>("#editor-body");
    if (!title || !summary || !body) return;
    sessionDraft = Object.freeze({ title: title.value, summary: summary.value, body: body.value });
    const state = document.querySelector<HTMLElement>("#save-state");
    if (state) state.textContent = "本页会话草稿已保存 · 刷新会丢失";
    showToast("本页会话草稿已保存；未生成 revision，未触发发布");
    return;
  }
  const safeMessages: Record<string, string> = {
    "select-variant": "已切换规范预览；真实平台字段仍需 Adapter 回读",
    "refresh-preview": "本地演示已重新计算预览；真实批准仍保持关闭",
    reconcile: "已创建只读对账演示；不会盲目重发",
    evidence: "证据详情仅展示脱敏标识",
    "cancel-queued": "已演示安全取消；未连接真实队列"
  };
  showToast(safeMessages[action] ?? "本地演示操作已完成");
});

window.addEventListener("popstate", () => render());
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
    event.preventDefault();
    closeNav();
    return;
  }
  if (event.key === "Tab" && document.body.classList.contains("nav-open")) {
    const sidebar = document.querySelector<HTMLElement>("#sidebar");
    const focusable = sidebar ? Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")) : [];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.addEventListener("resize", syncNavAccessibility);

render();
