import type { AnalysisReport } from "../types.ts";
import { prohibitedTerms } from "./brandGuard.ts";

const REDACTION = "[redacted]";

export function sanitizeReport(report: AnalysisReport): AnalysisReport {
  return sanitizeValue(report) as AnalysisReport;
}

export function sanitizeString(value: string): string {
  return prohibitedTerms()
    .sort((left, right) => right.length - left.length)
    .reduce((current, term) => current.replace(new RegExp(escapeRegExp(term), "gi"), REDACTION), value);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
    );
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

