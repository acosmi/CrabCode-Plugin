import type { AutomationCategory, ProjectProfile, Recommendation } from "../types.ts";
import { recommendationCatalog } from "./catalog.ts";

const CATEGORY_ORDER: AutomationCategory[] = ["mcp", "skill", "hook", "agent", "plugin", "workflow"];

export function recommendAutomations(profile: ProjectProfile, perCategory = 2): Recommendation[] {
  const recommendations = recommendationCatalog
    .map((rule) => {
      const evidence = rule.when(profile);
      return evidence && evidence.length > 0 ? rule.build(profile, evidence) : undefined;
    })
    .filter((value): value is Recommendation => Boolean(value))
    .sort(compareRecommendations);

  const selected: Recommendation[] = [];
  const counts = new Map<AutomationCategory, number>();
  for (const recommendation of recommendations) {
    const count = counts.get(recommendation.category) ?? 0;
    if (count >= perCategory) {
      continue;
    }
    counts.set(recommendation.category, count + 1);
    selected.push(recommendation);
  }

  return selected.sort(compareRecommendations);
}

function compareRecommendations(left: Recommendation, right: Recommendation): number {
  const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  return right.priority - left.priority || left.title.localeCompare(right.title);
}

