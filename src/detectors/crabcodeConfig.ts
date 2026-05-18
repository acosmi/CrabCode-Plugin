import type { DetectionResult, ProjectScan } from "../types.ts";

export function detectCrabCodeConfig(scan: ProjectScan): DetectionResult {
  const signals = [];

  if (scan.crabcodeFiles.length > 0) {
    signals.push({
      id: "crabcode-config",
      label: "Existing CrabCode configuration",
      confidence: "high" as const,
      evidence: scan.crabcodeFiles,
    });
  } else {
    signals.push({
      id: "missing-crabcode-context",
      label: "Missing CrabCode project context",
      confidence: "medium" as const,
      evidence: ["CRABCODE.md not found"],
    });
  }

  if (scan.mcpJson) {
    signals.push({
      id: "mcp-config",
      label: "Existing MCP configuration",
      confidence: "high" as const,
      evidence: [".mcp.json"],
    });
  }

  if (scan.envFiles.length > 0) {
    signals.push({
      id: "secret-sensitive-config",
      label: "Secret-sensitive configuration files",
      confidence: "high" as const,
      evidence: scan.envFiles,
    });
  }

  return {
    crabcodeFiles: scan.crabcodeFiles,
    signals,
  };
}

