import type { DetectionResult, ProjectScan } from "../types.ts";

export function detectCi(scan: ProjectScan): DetectionResult {
  if (scan.ciFiles.length === 0) {
    return {};
  }

  return {
    signals: [
      {
        id: "ci",
        label: "Continuous integration",
        confidence: "high",
        evidence: scan.ciFiles.slice(0, 5),
      },
    ],
  };
}

