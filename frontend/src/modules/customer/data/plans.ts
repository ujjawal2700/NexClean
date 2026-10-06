import type { CatalogPlan } from "../types";

export function washesLabel(washesPerMonth: number): string {
  return washesPerMonth < 0 ? "Unlimited washes" : `${washesPerMonth} washes / month`;
}

/**
 * The copy to show for a plan: only what the admin set in the admin panel.
 * No hardcoded fallback perks or taglines.
 */
export function planCopy(plan: CatalogPlan): {
  tagline: string;
  description: string;
  keyPoints: string[];
  featured: boolean;
} {
  return {
    tagline: plan.tagline?.trim() ?? "",
    description: plan.description?.trim() ?? "",
    keyPoints: (plan.keyPoints ?? []).map((k) => k.trim()).filter(Boolean),
    featured: (plan as CatalogPlan & { featured?: boolean }).featured ?? plan.id === "premium",
  };
}

