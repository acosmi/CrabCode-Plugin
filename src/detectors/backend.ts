import type { DetectionResult, ProjectScan } from "../types.ts";
import { collectAllDependencies } from "./packageJson.ts";

const BACKEND_DEPS = new Map<string, string>([
  ["@fastify/swagger", "API documentation"],
  ["@nestjs/core", "NestJS"],
  ["drizzle", "Drizzle"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
  ["koa", "Koa"],
  ["prisma", "Prisma"],
  ["stripe", "payments"],
]);

const SECURITY_PATH_HINTS = ["auth", "session", "token", "payment", "billing", "checkout"];

export function detectBackend(scan: ProjectScan): DetectionResult {
  const deps = collectAllDependencies(scan);
  const backendEvidence = [...BACKEND_DEPS.entries()].filter(([dependency]) => deps.has(dependency)).map(([, label]) => label);
  const routeEvidence = scan.files
    .filter((file) => file.includes("/api/") || file.includes("/routes/") || file.endsWith("routes.ts") || file.endsWith("server.ts"))
    .slice(0, 5);
  const securityEvidence = scan.files
    .filter((file) => SECURITY_PATH_HINTS.some((hint) => file.toLowerCase().includes(hint)))
    .slice(0, 5);

  const signals = [];
  if (backendEvidence.length || routeEvidence.length) {
    signals.push({
      id: "backend",
      label: "Backend or API surface",
      confidence: backendEvidence.length ? "high" as const : "medium" as const,
      evidence: [...backendEvidence, ...routeEvidence],
    });
  }
  if (securityEvidence.length || deps.has("stripe")) {
    signals.push({
      id: "security-sensitive",
      label: "Security-sensitive paths",
      confidence: securityEvidence.length ? "high" as const : "medium" as const,
      evidence: securityEvidence.length ? securityEvidence : ["payments dependency"],
    });
  }

  return { signals };
}
