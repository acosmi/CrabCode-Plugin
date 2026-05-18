import type { DetectionResult, ProjectScan } from "../types.ts";
import { collectAllDependencies } from "./packageJson.ts";

const FRONTEND_FRAMEWORKS = new Set(["React", "Vue", "Svelte", "SvelteKit", "Angular", "Next.js", "Astro", "Vite"]);
const FRONTEND_DEPS = new Map<string, string>([
  ["@playwright/test", "browser tests"],
  ["vite", "Vite"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["next", "Next.js"],
  ["@angular/core", "Angular"],
]);

export function detectFrontend(scan: ProjectScan): DetectionResult {
  const deps = collectAllDependencies(scan);
  const evidence = [
    ...[...FRONTEND_DEPS.entries()].filter(([dependency]) => deps.has(dependency)).map(([, label]) => label),
    ...scan.files.filter(isFrontendFile).slice(0, 5),
  ];

  if (evidence.length === 0) {
    return {};
  }

  const frameworks = [...FRONTEND_DEPS.entries()]
    .filter(([dependency]) => deps.has(dependency))
    .map(([, label]) => label)
    .filter((label) => FRONTEND_FRAMEWORKS.has(label));

  return {
    frameworks,
    signals: [
      {
        id: "frontend",
        label: "Frontend application",
        confidence: evidence.length > 1 ? "high" : "medium",
        evidence,
      },
    ],
  };
}

function isFrontendFile(file: string): boolean {
  return file === "vite.config.ts"
    || file === "vite.config.js"
    || file.endsWith("/vite.config.ts")
    || file.endsWith("/vite.config.js")
    || file.includes("/src/components/")
    || file.startsWith("src/components/")
    || file.startsWith("app/")
    || file.includes("/app/");
}
