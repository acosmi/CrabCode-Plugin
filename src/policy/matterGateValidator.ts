import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";

export type Severity = "error" | "warning";

export type MatterGateIssue = {
  severity: Severity;
  skillFile: string;
  message: string;
};

// The CrabLaw-CN umbrella family whose substantive skills must carry the Matter Gate.
const FAMILY = "crablaw-cn";

// Boards that are intentionally outside the matter/legal-service system, so their
// skills must NOT be required to reference the Matter Gate:
//  - builder-hub: meta-tooling for plugin/skill management, not legal work product.
//  - cn-legal-study: exam/education content, carries an education disclaimer instead.
const GATE_EXEMPT_BOARDS = new Set(["builder-hub", "cn-legal-study"]);

// Intake / matter-system skills that ESTABLISH the prerequisites the gate depends on
// (client, matter, conflict screening, archive, review queue) and therefore cannot
// themselves require an already-established matter. Keyed as "<board>/<skill>".
const INTAKE_SKILLS = new Set([
  "matter-core/new-client",
  "matter-core/new-matter",
  "matter-core/conflict-check",
  "matter-core/matter-archive",
  "matter-core/review-queue",
  "cn-contract/cold-start-interview",
]);

// A substantive skill must open the gate (heading) and actually wire it to the shared
// guardrail file — a bare heading with no reference would be a hollow gate.
const GATE_HEADING = /^##\s+Matter Gate\s*$/m;
const GATE_REFERENCE = "matter-core/PRACTICE.md";

const SKILL_FILE = "SKILL.md";
const WALK_SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

/**
 * Enforces the documented contract from matter-core/PRACTICE.md: every substantive
 * CrabLaw-CN domain skill (excluding intake skills and the gate-exempt non-legal
 * boards) contains a `## Matter Gate` section that references matter-core/PRACTICE.md.
 * This is the always-on enforcement point the PRACTICE.md file relies on.
 */
export async function validateMatterGate(root: string): Promise<MatterGateIssue[]> {
  const absRoot = path.resolve(root);
  const familyDir = path.join(absRoot, "plugins", FAMILY);

  let familyExists = false;
  try {
    familyExists = (await stat(familyDir)).isDirectory();
  } catch {
    familyExists = false;
  }
  if (!familyExists) return [];

  const issues: MatterGateIssue[] = [];
  const skillFiles: string[] = [];
  await collectSkillFiles(familyDir, skillFiles);

  for (const skillFile of skillFiles) {
    const relToFamily = path.relative(familyDir, skillFile);
    const segments = relToFamily.split(path.sep);
    const board = segments[0] ?? "";
    // skill id = the directory immediately containing SKILL.md
    const skillName = path.basename(path.dirname(skillFile));
    const skillKey = `${board}/${skillName}`;

    if (GATE_EXEMPT_BOARDS.has(board)) continue;
    if (INTAKE_SKILLS.has(skillKey)) continue;

    let content: string;
    try {
      content = await readFile(skillFile, "utf8");
    } catch {
      issues.push({
        severity: "error",
        skillFile,
        message: `${skillKey}: unable to read SKILL.md`,
      });
      continue;
    }

    if (!GATE_HEADING.test(content)) {
      issues.push({
        severity: "error",
        skillFile,
        message: `${skillKey}: substantive skill is missing a '## Matter Gate' section`,
      });
      continue;
    }
    if (!content.includes(GATE_REFERENCE)) {
      issues.push({
        severity: "error",
        skillFile,
        message: `${skillKey}: '## Matter Gate' section must reference ${GATE_REFERENCE}`,
      });
    }
  }

  return issues;
}

async function collectSkillFiles(dir: string, out: string[]): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = path.join(dir, entry);
    let stats;
    try {
      stats = await stat(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (WALK_SKIP_DIRS.has(entry)) continue;
      await collectSkillFiles(fullPath, out);
    } else if (entry === SKILL_FILE) {
      out.push(fullPath);
    }
  }
}

export function formatMatterGateIssues(issues: MatterGateIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.skillFile);
      return `${issue.severity.toUpperCase()} ${rel}: ${issue.message}`;
    })
    .join("\n");
}
