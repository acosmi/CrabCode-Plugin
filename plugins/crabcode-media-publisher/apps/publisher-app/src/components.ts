import { icon } from "./icons.ts";
import type { StatusPresentation } from "../../../packages/domain/src/index.ts";
import type { StatusTone } from "../../../packages/domain/src/index.ts";

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function statusBadge(status: StatusPresentation, compact = false): string {
  const iconName = status.tone === "success" ? "check" : status.tone === "neutral" ? "clock" : "alert";
  return `<span class="status-badge status-${escapeHtml(status.tone)}${compact ? " status-compact" : ""}" title="${escapeHtml(status.description)}">
    ${icon(iconName)}<span>${escapeHtml(status.label)}</span>
  </span>`;
}

export function factBadge(label: string, description: string, tone: StatusTone, compact = false): string {
  return statusBadge({ label, description, tone, terminal: false, allowedActions: [] }, compact);
}

export function pageHeader(args: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: string;
}): string {
  return `<header class="page-header">
    <div class="page-heading">
      <p class="eyebrow">${escapeHtml(args.eyebrow)}</p>
      <h1>${escapeHtml(args.title)}</h1>
      <p class="page-description">${escapeHtml(args.description)}</p>
    </div>
    ${args.actions ? `<div class="page-actions">${args.actions}</div>` : ""}
  </header>`;
}

export function button(label: string, options: {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  route?: string;
  type?: "button" | "submit";
  title?: string;
  action?: string;
  data?: Readonly<Record<string, string>>;
  iconName?: "plus" | "arrow" | "lock" | "external";
} = {}): string {
  const variant = options.variant ?? "secondary";
  const content = `${options.iconName ? icon(options.iconName) : ""}<span>${escapeHtml(label)}</span>`;
  if (options.route && !options.disabled) {
    return `<a class="button button-${variant}" href="${escapeHtml(options.route)}" data-route>${content}</a>`;
  }
  const attributes: string[] = [];
  if (options.title) attributes.push(`title="${escapeHtml(options.title)}"`);
  if (options.action) attributes.push(`data-action="${escapeHtml(options.action)}"`);
  for (const [key, value] of Object.entries(options.data ?? {})) {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`Unsafe data attribute key: ${key}`);
    attributes.push(`data-${key}="${escapeHtml(value)}"`);
  }
  return `<button class="button button-${variant}" type="${options.type ?? "button"}"${options.disabled ? " disabled aria-disabled=\"true\"" : ""}${attributes.length > 0 ? ` ${attributes.join(" ")}` : ""}>${content}</button>`;
}

export function card(args: { title?: string; description?: string; className?: string; content: string; headerAction?: string }): string {
  return `<section class="card ${escapeHtml(args.className ?? "")}">
    ${args.title ? `<div class="card-header"><div><h2>${escapeHtml(args.title)}</h2>${args.description ? `<p>${escapeHtml(args.description)}</p>` : ""}</div>${args.headerAction ?? ""}</div>` : ""}
    ${args.content}
  </section>`;
}

export function keyValue(label: string, value: string, options: { mono?: boolean; wide?: boolean } = {}): string {
  return `<div class="key-value${options.wide ? " key-value-wide" : ""}"><dt>${escapeHtml(label)}</dt><dd${options.mono ? ' class="mono"' : ""}>${escapeHtml(value)}</dd></div>`;
}

export function emptyState(title: string, detail: string): string {
  return `<div class="empty-state">${icon("shield", "empty-icon")}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
}
