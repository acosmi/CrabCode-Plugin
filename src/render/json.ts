import type { AnalysisReport } from "../types.ts";

export function renderJson(report: AnalysisReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

