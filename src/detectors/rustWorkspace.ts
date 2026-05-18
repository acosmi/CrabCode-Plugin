import type { DetectionResult, ProjectScan, ProjectSignal } from "../types.ts";

export function detectRustWorkspace(scan: ProjectScan): DetectionResult {
  if (scan.cargoManifests.length === 0) {
    return {};
  }

  const signals: ProjectSignal[] = [
    {
      id: "rust",
      label: "Rust workspace or crate",
      confidence: "high" as const,
      evidence: scan.cargoManifests.slice(0, 5),
    },
  ];

  if (scan.cargoManifests.length > 1 || scan.files.includes("Cargo.lock")) {
    signals.push({
      id: "rust-workspace",
      label: "Rust workspace",
      confidence: scan.cargoManifests.length > 1 ? "high" : "medium",
      evidence: scan.cargoManifests.slice(0, 5),
    });
  }

  return {
    languages: ["Rust"],
    packageManagers: ["cargo"],
    testCommands: ["cargo test"],
    buildCommands: ["cargo check", "cargo clippy"],
    signals,
  };
}
