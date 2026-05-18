import type { AnalysisReport } from "./types.ts";
import { buildProjectProfile } from "./analyzer/profile.ts";
import { scanProject } from "./analyzer/projectScanner.ts";
import { recommendAutomations } from "./recommendations/ranker.ts";
import { renderJson } from "./render/json.ts";
import { renderMarkdown } from "./render/markdown.ts";
import { sanitizeReport } from "./policy/outputSanitizer.ts";

export type AnalyzeOptions = {
  cwd: string;
  perCategory?: number;
};

export async function analyzeProject(options: AnalyzeOptions): Promise<AnalysisReport> {
  const scan = await scanProject({ cwd: options.cwd });
  const profile = buildProjectProfile(scan);
  return sanitizeReport({
    profile,
    recommendations: recommendAutomations(profile, options.perCategory ?? 2),
  });
}

export function renderReport(report: AnalysisReport, format: "json" | "markdown"): string {
  return format === "json" ? renderJson(report) : renderMarkdown(report);
}

export * from "./types.ts";
