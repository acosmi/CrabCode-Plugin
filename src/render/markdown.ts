import type { AnalysisReport, AutomationCategory, ProjectProfile, Recommendation } from "../types.ts";

const CATEGORY_LABELS: Record<AutomationCategory, string> = {
  agent: "Agents",
  hook: "Hooks",
  mcp: "MCP Servers",
  plugin: "Plugins",
  skill: "Skills",
  workflow: "Workflows",
};

const CATEGORY_ORDER: AutomationCategory[] = ["mcp", "skill", "hook", "agent", "plugin", "workflow"];

export function renderMarkdown(report: AnalysisReport): string {
  const lines: string[] = [
    "# CrabCode Automation Recommendations",
    "",
    "## Codebase Profile",
    ...renderProfile(report.profile),
    "",
    "## Top Recommendations",
  ];

  for (const category of CATEGORY_ORDER) {
    const items = report.recommendations.filter((recommendation) => recommendation.category === category);
    if (items.length === 0) {
      continue;
    }
    lines.push("", `### ${CATEGORY_LABELS[category]}`);
    for (const [index, item] of items.entries()) {
      lines.push(...renderRecommendation(index + 1, item));
    }
  }

  lines.push(
    "",
    "## Next Steps",
    "1. Review these recommendations against team preferences.",
    "2. Choose one automation to implement first.",
    "3. Re-run this analyzer after adding CrabCode configuration to keep the recommendations current.",
    "",
  );

  return lines.join("\n");
}

function renderProfile(profile: ProjectProfile): string[] {
  return [
    `- Type: ${formatList(profile.languages, "Unknown")}`,
    `- Frameworks: ${formatList(profile.frameworks, "None detected")}`,
    `- Package managers: ${formatList(profile.packageManagers, "None detected")}`,
    `- Test commands: ${formatList(profile.testCommands, "None detected")}`,
    `- Build commands: ${formatList(profile.buildCommands, "None detected")}`,
    `- Existing CrabCode config: ${formatList(profile.crabcodeFiles, "None detected")}`,
  ];
}

function renderRecommendation(index: number, item: Recommendation): string[] {
  const lines = [
    `${index}. **${item.title}**`,
    `   - Why: ${item.why}`,
    `   - Evidence: ${formatList(item.evidence, "No direct evidence")}`,
  ];

  if (item.install) {
    lines.push(`   - Install: ${item.install}`);
  }
  if (item.createAt) {
    lines.push(`   - Create: \`${item.createAt}\``);
  }
  if (item.configPath) {
    lines.push(`   - Configure: \`${item.configPath}\``);
  }
  for (const caveat of item.caveats ?? []) {
    lines.push(`   - Note: ${caveat}`);
  }

  return lines;
}

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

