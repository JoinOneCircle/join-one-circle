import { schoolDateKey } from "./dashboard-calendar.ts";
import type { PilotEvent, PilotPlan } from "./pilot-model.ts";

type ReviewPlan = Pick<PilotPlan, "id" | "child_id" | "status" | "review_on">;
export type PilotReviewLink = { href: string; planId: string | null };

// This is a school navigation hint, not an access grant. Callers supply only
// already-authorised plans; parents keep their separate explicit projection.
export function pilotReviewLink(event: PilotEvent, plans: readonly ReviewPlan[]): PilotReviewLink | null {
  if (!event.plan_id && event.title !== "Plan review") return null;
  const base = `/children?child=${encodeURIComponent(event.child_id)}&tab=documents`;
  let plan: ReviewPlan | undefined;
  if (event.plan_id) {
    // A missing or inaccessible exact reference must never select another version.
    plan = plans.find((p) => p.id === event.plan_id && p.child_id === event.child_id && p.status === "published");
  } else {
    // Legacy events did not store an id. Do not guess when versions share a date.
    try {
      const day = schoolDateKey(event.starts_at);
      const candidates = plans.filter((p) => p.child_id === event.child_id && p.status === "published" && p.review_on === day);
      if (candidates.length === 1) plan = candidates[0];
    } catch { /* Invalid legacy date: keep the safe child document list. */ }
  }
  return { href: plan ? `${base}&plan=${encodeURIComponent(plan.id)}` : base, planId: plan?.id ?? null };
}
