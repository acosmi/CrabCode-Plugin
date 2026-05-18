import type { DetectionResult, ProjectProfile, ProjectScan, ProjectSignal } from "../types.ts";
import { detectBackend } from "../detectors/backend.ts";
import { detectCi } from "../detectors/ci.ts";
import { detectCrabCodeConfig } from "../detectors/crabcodeConfig.ts";
import { detectFrontend } from "../detectors/frontend.ts";
import { detectPackageJson } from "../detectors/packageJson.ts";
import { detectRustWorkspace } from "../detectors/rustWorkspace.ts";

export function buildProjectProfile(scan: ProjectScan): ProjectProfile {
  const detections = [
    detectPackageJson(scan),
    detectRustWorkspace(scan),
    detectFrontend(scan),
    detectBackend(scan),
    detectCrabCodeConfig(scan),
    detectCi(scan),
  ];

  return {
    root: scan.root,
    languages: collect(detections, "languages"),
    frameworks: collect(detections, "frameworks"),
    packageManagers: collect(detections, "packageManagers"),
    testCommands: collect(detections, "testCommands"),
    buildCommands: collect(detections, "buildCommands"),
    crabcodeFiles: collect(detections, "crabcodeFiles"),
    signals: collectSignals(detections),
  };
}

function collect<K extends keyof DetectionResult>(items: DetectionResult[], key: K): string[] {
  const values = new Set<string>();
  for (const item of items) {
    for (const value of (item[key] as string[] | undefined) ?? []) {
      values.add(value);
    }
  }
  return [...values].sort();
}

function collectSignals(items: DetectionResult[]): ProjectSignal[] {
  const byId = new Map<string, ProjectSignal>();

  for (const item of items) {
    for (const signal of item.signals ?? []) {
      const existing = byId.get(signal.id);
      if (!existing) {
        byId.set(signal.id, signal);
        continue;
      }
      byId.set(signal.id, {
        ...existing,
        evidence: [...new Set([...existing.evidence, ...signal.evidence])],
        confidence: stronger(existing.confidence, signal.confidence),
      });
    }
  }

  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function stronger(left: ProjectSignal["confidence"], right: ProjectSignal["confidence"]): ProjectSignal["confidence"] {
  const order = { low: 0, medium: 1, high: 2 };
  return order[left] >= order[right] ? left : right;
}

