import "../../../packages/ui/src/tokens.css";
import "./styles.css";
import { renderApp } from "./app.ts";
import { applyEditorFormat, type EditorFormat } from "./editor-actions.ts";
import {
  canonicalEditorDraft,
  detectImportFormat,
  importEditorDocument,
  invalidateDraftVerification,
  isDocumentWithinRealtimeBudget,
  MAX_EDITOR_BODY_CHARACTERS,
  MAX_IMPORT_BYTES,
  renderEditorArtifacts,
  type EditorArtifacts,
  type EditorDraft,
  type ImportFormat
} from "./editor-document.ts";

const mount = document.querySelector<HTMLDivElement>("#app");
if (!mount) throw new Error("CrabPublish Hub mount point #app is missing");

let sessionDraft: EditorDraft | null = null;
let activeDraftContext: Pick<EditorDraft, "sourceFormat" | "sourceName" | "authorName" | "sourceCount" | "disclosure" | "verificationStatus"> = {
  sourceFormat: canonicalEditorDraft.sourceFormat,
  sourceName: canonicalEditorDraft.sourceName,
  authorName: canonicalEditorDraft.authorName,
  sourceCount: canonicalEditorDraft.sourceCount,
  disclosure: canonicalEditorDraft.disclosure,
  verificationStatus: canonicalEditorDraft.verificationStatus
};
let previewObjectUrl: string | null = null;
let previewTimer: number | null = null;
let previewGeneration = 0;
let currentArtifacts: EditorArtifacts | null = null;
let hasUnsavedEditorChanges = false;
let navReturnFocus: HTMLElement | null = null;
let renderedPathname = window.location.pathname;

function isMobileNavigation(): boolean {
  return window.matchMedia("(max-width: 820px)").matches;
}

function revokePreviewObjectUrl(): void {
  if (!previewObjectUrl) return;
  URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
}

function cancelScheduledPreview(): number {
  if (previewTimer !== null) window.clearTimeout(previewTimer);
  previewTimer = null;
  previewGeneration += 1;
  return previewGeneration;
}

function editorFields(): {
  title: HTMLTextAreaElement;
  summary: HTMLTextAreaElement;
  body: HTMLTextAreaElement;
} | null {
  const title = document.querySelector<HTMLTextAreaElement>("#editor-title");
  const summary = document.querySelector<HTMLTextAreaElement>("#editor-summary");
  const body = document.querySelector<HTMLTextAreaElement>("#editor-body");
  return title && summary && body ? { title, summary, body } : null;
}

function readEditorDraft(): EditorDraft | null {
  const fields = editorFields();
  if (!fields) return null;
  return Object.freeze({
    title: fields.title.value,
    summary: fields.summary.value,
    bodyMarkdown: fields.body.value,
    ...activeDraftContext
  });
}

function setEditorDraft(draft: EditorDraft): void {
  const fields = editorFields();
  if (!fields) return;
  fields.title.value = draft.title;
  fields.summary.value = draft.summary;
  fields.body.value = draft.bodyMarkdown;
  fields.body.maxLength = MAX_EDITOR_BODY_CHARACTERS;
  setActiveDraftContext(draft);
}

function setActiveDraftContext(draft: EditorDraft): void {
  activeDraftContext = {
    sourceFormat: draft.sourceFormat,
    sourceName: draft.sourceName,
    authorName: draft.authorName,
    sourceCount: draft.sourceCount,
    disclosure: draft.disclosure,
    verificationStatus: draft.verificationStatus
  };
}

function sourceFormatLabel(format: ImportFormat): string {
  if (format === "markdown") return "MD 导入";
  if (format === "html") return "HTML 导入";
  return "基础稿";
}

type EditorUiMode = "baseline" | "dirty" | "rendering" | "previewed" | "imported" | "saved" | "restored" | "over_budget";

function setText(element: HTMLElement | null | undefined, value: string): void {
  if (element && element.textContent !== value) element.textContent = value;
}

function updateEditorChrome(draft: EditorDraft, mode: EditorUiMode): void {
  const titleCount = document.querySelector<HTMLElement>("#editor-title-count");
  const summaryCount = document.querySelector<HTMLElement>("#editor-summary-count");
  const bodyCount = document.querySelector<HTMLElement>("#editor-word-count");
  const paragraphCount = document.querySelector<HTMLElement>("#editor-paragraph-count");
  const sourceBadge = document.querySelector<HTMLElement>("#source-format-badge");
  const sourceCount = document.querySelector<HTMLElement>("#editor-source-count");
  const sourceCheck = document.querySelector<HTMLElement>("#preview-source-check");
  const disclosureCheck = document.querySelector<HTMLElement>("#preview-disclosure-check");
  const pageTitle = document.querySelector<HTMLElement>(".editor-page .page-heading h1");
  const pageDescription = document.querySelector<HTMLElement>(".editor-page .page-heading p");
  const hash = document.querySelector<HTMLElement>("#editor-hash");
  const saveState = document.querySelector<HTMLElement>("#save-state");
  const previewState = document.querySelector<HTMLElement>("#preview-state");
  const syncCheck = document.querySelector<HTMLElement>("#preview-sync-check span");
  const importCheck = document.querySelector<HTMLElement>("#preview-import-check span");
  const pendingMetadata = draft.verificationStatus === "pending_review";

  setText(titleCount, `${draft.title.length} / 64`);
  setText(summaryCount, `${draft.summary.length} / 160`);
  setText(bodyCount, draft.bodyMarkdown.replace(/\s/g, "").length.toLocaleString("zh-CN"));
  setText(paragraphCount, String(draft.bodyMarkdown.split(/\n\s*\n/).filter(Boolean).length));
  setText(sourceBadge, sourceFormatLabel(draft.sourceFormat));
  setText(sourceCount, String(draft.sourceCount));
  setText(pageTitle, draft.title || "未命名内容");
  setText(pageDescription, pendingMetadata
    ? "本页草稿 · 作者、来源与 AI 辅助披露待复核 · 尚未冻结"
    : "本地编辑工作区 · 冻结基线 rev-017 · 8 个来源");
  setText(importCheck, draft.sourceFormat === "fixture"
    ? "未导入本地文件"
    : `${sourceFormatLabel(draft.sourceFormat)} · ${draft.sourceName}`);

  setText(sourceCheck?.querySelector<HTMLElement>("span"), pendingMetadata
    ? "来源待补充与核验 · 未通过冻结门"
    : `${draft.sourceCount} 个固定夹具来源已绑定`);
  setText(disclosureCheck?.querySelector<HTMLElement>("span"), pendingMetadata
    ? "作者与 AI 辅助披露待复核 · 未通过冻结门"
    : "固定夹具的 AI 辅助披露已填写");
  sourceCheck?.classList.toggle("is-pending", pendingMetadata);
  disclosureCheck?.classList.toggle("is-pending", pendingMetadata);

  const isFrozenBaseline = mode === "baseline";
  const hasUnsavedChanges = ["dirty", "rendering", "previewed", "imported", "over_budget"].includes(mode);
  if (!isFrozenBaseline) setText(hash, hasUnsavedChanges ? "stale · 待保存" : "未生成 · 会话草稿");
  setText(previewState, isFrozenBaseline
    ? "冻结基线 · rev-017"
    : mode === "over_budget"
      ? "本页草稿预览 · 已暂停"
      : mode === "dirty" || mode === "rendering"
      ? "本页草稿预览 · 更新中"
      : "本页草稿预览 · 未冻结");
  setText(syncCheck, isFrozenBaseline
    ? "HTML 成品与 MD 备份由同一固定草稿生成"
    : mode === "over_budget"
      ? "HTML 成品与 MD 备份未更新 · 文档结构超出实时预算"
      : mode === "dirty" || mode === "rendering"
        ? "HTML 成品与 MD 备份正在由最新草稿重新生成"
        : "HTML 成品与 MD 备份已由本页草稿同步生成 · 未冻结");

  if (saveState) {
    const messages = {
      baseline: "固定基线 · 尚无本页改动",
      dirty: "本页有未保存改动 · 等待生成 HTML 成品与 MD 备份",
      rendering: "正在生成 HTML 成品与 MD 备份并载入隔离预览",
      previewed: "本页有未保存改动 · HTML 成品与 MD 备份已同步",
      imported: "本地文稿已导入 · HTML 成品与 MD 备份已同步 · 尚未保存",
      saved: "本页会话草稿已保存 · 刷新会丢失",
      restored: "本页会话草稿已恢复 · 刷新会丢失",
      over_budget: "实时预览已暂停 · 请减少密集标记、超短段落或嵌套结构"
    } as const;
    setText(saveState, messages[mode]);
  }

  document.querySelector<HTMLElement>(".editor-page")?.classList.toggle("is-dirty", !isFrozenBaseline);
}

function installStaticPreview(): void {
  const frame = replacePreviewFrame();
  if (!frame) return;
  revokePreviewObjectUrl();
  currentArtifacts = renderEditorArtifacts(canonicalEditorDraft);
  frame.setAttribute("sandbox", "");
  frame.referrerPolicy = "no-referrer";
  frame.dataset.previewSource = "frozen";
  frame.src = "/article-preview.html";
}

function replacePreviewFrame(): HTMLIFrameElement | null {
  const current = document.querySelector<HTMLIFrameElement>("#article-preview");
  if (!current) return null;
  const replacement = current.cloneNode(false) as HTMLIFrameElement;
  replacement.removeAttribute("src");
  current.replaceWith(replacement);
  return replacement;
}

function installDraftPreview(draft: EditorDraft, artifacts: EditorArtifacts, generation: number, readyMode: EditorUiMode): void {
  const frame = replacePreviewFrame();
  if (!frame) return;
  revokePreviewObjectUrl();
  const objectUrl = URL.createObjectURL(new Blob([artifacts.html], { type: "text/html;charset=utf-8" }));
  previewObjectUrl = objectUrl;
  currentArtifacts = artifacts;
  frame.setAttribute("sandbox", "");
  frame.referrerPolicy = "no-referrer";
  frame.dataset.previewSource = "session";
  frame.addEventListener("load", () => {
    if (generation !== previewGeneration || previewObjectUrl !== objectUrl) return;
    updateEditorChrome(draft, readyMode);
  }, { once: true });
  frame.src = objectUrl;
}

function scheduleDraftPreview(draft: EditorDraft): void {
  const generation = cancelScheduledPreview();
  previewTimer = window.setTimeout(() => {
    if (generation !== previewGeneration) return;
    previewTimer = null;
    updateEditorChrome(draft, "rendering");
    const artifacts = renderEditorArtifacts(draft);
    if (generation !== previewGeneration) return;
    installDraftPreview(draft, artifacts, generation, "previewed");
  }, 250);
}

function initializeEditor(): void {
  if (!editorFields()) return;
  hasUnsavedEditorChanges = false;
  if (sessionDraft) {
    setEditorDraft(sessionDraft);
    const generation = previewGeneration;
    updateEditorChrome(sessionDraft, "rendering");
    installDraftPreview(sessionDraft, renderEditorArtifacts(sessionDraft), generation, "restored");
    const importState = document.querySelector<HTMLElement>("#import-state");
    if (importState) importState.textContent = sessionDraft.sourceFormat === "fixture"
      ? "已恢复本页会话草稿 · 未导入文件"
      : `已恢复 ${sessionDraft.sourceName} 的本页会话草稿`;
    return;
  }
  setEditorDraft(canonicalEditorDraft);
  installStaticPreview();
  updateEditorChrome(canonicalEditorDraft, "baseline");
}

function render(pathname = window.location.pathname): void {
  cancelScheduledPreview();
  revokePreviewObjectUrl();
  currentArtifacts = null;
  mount!.innerHTML = renderApp(pathname);
  renderedPathname = pathname;
  initializeEditor();
  syncNavAccessibility();
  document.title = `${document.querySelector("main")?.dataset.pageTitle ?? "CrabPublish Hub"} · CrabPublish Hub`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function navigate(href: string): void {
  const url = new URL(href, window.location.origin);
  if (hasUnsavedEditorChanges && editorFields() && !window.confirm("本页仍有未保存改动。确定离开并放弃这些改动吗？")) return;
  hasUnsavedEditorChanges = false;
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

function saveCurrentDraft(showFeedback = true): void {
  const draft = readEditorDraft();
  if (!draft) return;
  if (!isDocumentWithinRealtimeBudget(draft.bodyMarkdown)) {
    updateEditorChrome(draft, "over_budget");
    if (showFeedback) showToast("无法保存：正文结构超出实时安全预算，请先精简密集标记或超短段落");
    return;
  }
  const generation = cancelScheduledPreview();
  sessionDraft = draft;
  hasUnsavedEditorChanges = false;
  updateEditorChrome(draft, "rendering");
  installDraftPreview(draft, renderEditorArtifacts(draft), generation, "saved");
  if (showFeedback) showToast("本页会话草稿已保存；未生成 revision，未触发发布");
}

function markEditorDirty(): void {
  const currentDraft = readEditorDraft();
  if (!currentDraft) return;
  const draft = invalidateDraftVerification(currentDraft);
  if (draft !== currentDraft) setActiveDraftContext(draft);
  hasUnsavedEditorChanges = true;
  currentArtifacts = null;
  if (!isDocumentWithinRealtimeBudget(draft.bodyMarkdown)) {
    cancelScheduledPreview();
    updateEditorChrome(draft, "over_budget");
    return;
  }
  updateEditorChrome(draft, "dirty");
  scheduleDraftPreview(draft);
}

function applyFormat(format: EditorFormat): void {
  const body = document.querySelector<HTMLTextAreaElement>("#editor-body");
  if (!body) return;
  const result = applyEditorFormat(body.value, body.selectionStart, body.selectionEnd, format);
  body.value = result.value;
  body.focus();
  body.setSelectionRange(result.selectionStart, result.selectionEnd);
  body.dispatchEvent(new Event("input", { bubbles: true }));
}

function downloadMarkdownBackup(): void {
  const draft = readEditorDraft();
  if (!draft) return;
  if (!isDocumentWithinRealtimeBudget(draft.bodyMarkdown)) {
    updateEditorChrome(draft, "over_budget");
    showToast("无法生成备份：正文结构超出实时安全预算，请先精简密集标记或超短段落");
    return;
  }
  const artifacts = currentArtifacts ?? renderEditorArtifacts(draft);
  const downloadUrl = URL.createObjectURL(new Blob([artifacts.markdown], { type: "text/markdown;charset=utf-8" }));
  const sourceStem = draft.sourceName.replace(/\.(?:md|markdown|html?|htm)$/i, "");
  const safeStem = sourceStem.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "crabpublish-draft";
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `${safeStem}.backup.md`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  showToast("已生成当前草稿的安全 Markdown 备份；未上传、未冻结 revision");
}

async function importLocalFile(file: File): Promise<void> {
  const importState = document.querySelector<HTMLElement>("#import-state");
  if (file.size > MAX_IMPORT_BYTES) {
    if (importState) importState.textContent = "导入失败：文件超过 256 KiB 实时安全上限";
    showToast("导入失败：文件超过 256 KiB 实时安全上限");
    return;
  }
  const format = detectImportFormat(file.name, file.type);
  if (!format) {
    if (importState) importState.textContent = "导入失败：仅支持 Markdown 或 HTML 文件";
    showToast("导入失败：仅支持 .md、.markdown、.html、.htm");
    return;
  }
  const generation = cancelScheduledPreview();
  currentArtifacts = null;
  try {
    const raw = await file.text();
    if (generation !== previewGeneration) return;
    if (!isDocumentWithinRealtimeBudget(raw)) {
      const fallbackDraft = readEditorDraft();
      if (fallbackDraft) {
        updateEditorChrome(fallbackDraft, hasUnsavedEditorChanges ? "dirty" : "baseline");
        if (hasUnsavedEditorChanges) scheduleDraftPreview(fallbackDraft);
      }
      if (importState) importState.textContent = "导入失败：文档结构过密，超出实时解析预算；请精简密集标记、超短段落或嵌套结构";
      showToast("导入失败：文档结构过密，超出实时解析预算");
      return;
    }
    const imported = importEditorDocument(raw, file.name, format);
    if (generation !== previewGeneration) return;
    sessionDraft = null;
    hasUnsavedEditorChanges = true;
    setEditorDraft(imported);
    updateEditorChrome(imported, "rendering");
    const artifacts = renderEditorArtifacts(imported);
    installDraftPreview(imported, artifacts, generation, "imported");
    if (importState) importState.textContent = format === "markdown"
      ? `已导入 ${file.name} · Markdown 已规范化为单一 H1，链接显示为安全文本，原始 HTML 与远程图片未进入备份 · 仅本机内存`
      : `已导入 ${file.name} · HTML 已清洗并通过 AST 转换；额外 H1 会降为 H2，合并单元格会展开，链接与图片替代文字保留为安全文本 · 仅本机内存`;
    showToast(`已安全导入 ${file.name}；未上传、未生成 revision`);
  } catch {
    if (generation === previewGeneration) {
      const fallbackDraft = readEditorDraft();
      if (fallbackDraft) {
        updateEditorChrome(fallbackDraft, "dirty");
        scheduleDraftPreview(fallbackDraft);
      }
    }
    if (importState) importState.textContent = "导入失败：文件无法解析，原文稿未上传";
    showToast("导入失败：文件无法解析");
  }
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !target.matches("[data-editor-field]")) return;
  markEditorDirty();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.id !== "editor-import") return;
  const file = target.files?.item(0);
  target.value = "";
  if (file) void importLocalFile(file);
});

document.addEventListener("click", (event) => {
  const target = event.target as Element;
  const routeLink = target.closest<HTMLAnchorElement>("a[data-route]");
  if (routeLink) {
    event.preventDefault();
    closeNav(false);
    navigate(routeLink.href);
    return;
  }
  const actionTarget = target.closest<HTMLElement>("[data-action]");
  const action = actionTarget?.dataset.action;
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
  if (action === "open-import") {
    document.querySelector<HTMLInputElement>("#editor-import")?.click();
    return;
  }
  if (action === "format-editor") {
    const format = actionTarget?.dataset.format;
    if (["bold", "heading-2", "quote", "bullet-list"].includes(format ?? "")) applyFormat(format as EditorFormat);
    return;
  }
  if (action === "download-markdown") {
    downloadMarkdownBackup();
    return;
  }
  if (action === "save-revision") {
    saveCurrentDraft();
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

window.addEventListener("popstate", () => {
  if (hasUnsavedEditorChanges && editorFields() && !window.confirm("本页仍有未保存改动。确定离开并放弃这些改动吗？")) {
    window.history.pushState({}, "", renderedPathname);
    return;
  }
  hasUnsavedEditorChanges = false;
  render();
});
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && editorFields()) {
    event.preventDefault();
    saveCurrentDraft();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b" && document.activeElement?.id === "editor-body") {
    event.preventDefault();
    applyFormat("bold");
    return;
  }
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
window.addEventListener("beforeunload", (event) => {
  revokePreviewObjectUrl();
  if (!hasUnsavedEditorChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

render();
