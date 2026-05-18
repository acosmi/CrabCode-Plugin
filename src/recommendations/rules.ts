import type { AutomationCategory, ProjectProfile, Recommendation } from "../types.ts";

export type RecommendationRule = {
  id: string;
  category: AutomationCategory;
  title: string;
  priority: number;
  when(profile: ProjectProfile): string[] | false;
  build(profile: ProjectProfile, evidence: string[]): Recommendation;
};

export function hasSignal(profile: ProjectProfile, signalId: string): boolean {
  return profile.signals.some((signal) => signal.id === signalId);
}

export function signalEvidence(profile: ProjectProfile, signalId: string): string[] {
  return profile.signals.find((signal) => signal.id === signalId)?.evidence ?? [];
}

export function hasLanguage(profile: ProjectProfile, language: string): boolean {
  return profile.languages.includes(language);
}

export function hasFramework(profile: ProjectProfile, framework: string): boolean {
  return profile.frameworks.includes(framework);
}

export function makeRecommendation(input: {
  id: string;
  category: AutomationCategory;
  title: string;
  why: string;
  priority: number;
  evidence: string[];
  install?: string;
  createAt?: string;
  configPath?: string;
  caveats?: string[];
}): Recommendation {
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    why: input.why,
    priority: input.priority,
    evidence: input.evidence,
    ...(input.install ? { install: input.install } : {}),
    ...(input.createAt ? { createAt: input.createAt } : {}),
    ...(input.configPath ? { configPath: input.configPath } : {}),
    ...(input.caveats ? { caveats: input.caveats } : {}),
  };
}

