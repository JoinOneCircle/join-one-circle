import type { PilotData, PilotPlan, PupilProfile, TemplateDefinition } from "./pilot-model.ts";

export function documentPreparation(definition: TemplateDefinition, profile: PupilProfile, school: string) {
  const fields = definition.sections.flatMap(section => section.fields.map(field => {
    const value = field.source === "school_name" ? school : field.source && field.source in profile ? profile[field.source as keyof PupilProfile] : "";
    const ready = !!field.source && (!!value.trim() || field.source === "today" || field.source === "author");
    return { id: field.id, value, ready, linked: !!field.source };
  }));
  return { fields, ready: fields.filter(f => f.ready).length, missing: fields.filter(f => f.linked && !f.ready).length, manual: fields.filter(f => !f.ready).length };
}

export const childRecordHref = (childId: string, tab = "details", planId = "") => `/children?child=${encodeURIComponent(childId)}&tab=${encodeURIComponent(tab)}${planId ? `&plan=${encodeURIComponent(planId)}` : ""}`;

export function schoolNextActions(data: PilotData) {
  if (!data.pupils.length) return [{ kind: "add-child" as const, href: "/children?new=1", childId: "", title: "" }];
  if (!data.templates.length) return [{ kind: "template" as const, href: "/templates", childId: "", title: "" }];
  const unfinished = data.plans.filter(p => p.status !== "published").sort((a,b) => (a.status === "signed" ? 0 : 1) - (b.status === "signed" ? 0 : 1) || b.updated_at.localeCompare(a.updated_at));
  const actions = unfinished.slice(0,4).map(p => ({ kind: p.status === "signed" ? "publish" as const : "complete" as const, href: childRecordHref(p.child_id,"documents",p.id), childId: p.child_id, title: p.title }));
  if (actions.length) return actions;
  return data.pupils.filter(p => !data.plans.some(d => d.child_id === p.child_id)).slice(0,4).map(p => ({ kind: "first-document" as const, href: `${childRecordHref(p.child_id,"documents")}&newDocument=1`, childId: p.child_id, title: p.profile.preferred_name }));
}

export function chooseSharedChild<T extends { child_id: string }>(children: T[], selected: string): T | undefined {
  // If access was revoked, never silently replace the child being read.
  return selected ? children.find(child => child.child_id === selected) : children[0];
}

// Explicit field identity, never guess a date's meaning from its translated label.
export function hasReviewField(definition: TemplateDefinition) {
  return definition.sections.some((s) => s.fields.some((f) => f.id === "review_on" && f.type === "date"));
}
export function planReviewDate(definition: TemplateDefinition, answers: Record<string, string>, fallback = "") {
  return hasReviewField(definition) ? answers.review_on ?? "" : fallback;
}
export function planVersion(plan: Pick<PilotPlan, "id" | "child_id" | "supersedes_id">, plans: Pick<PilotPlan, "id" | "child_id" | "supersedes_id">[]) {
  let current = plan; let version = 1; const seen = new Set([plan.id]);
  while (current.supersedes_id && !seen.has(current.supersedes_id)) {
    const prior = plans.find((p) => p.id === current.supersedes_id && p.child_id === plan.child_id);
    if (!prior) break;
    version++; seen.add(prior.id); current = prior;
  }
  return version;
}
export function demoParentView(data: PilotData, recipientId: string) {
  const recipient = data.recipients.find((r) => r.id === recipientId && r.recipient_role === "parent" && ["active", "draft", "pending"].includes(r.status) && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now() || r.status === "active"));
  const pupil = recipient && data.pupils.find((p) => p.child_id === recipient.child_id);
  if (!recipient || !pupil) return [];
  const profile = Object.fromEntries(Object.entries(pupil.profile).filter(([key]) => recipient.profile_fields.includes(key)));
  return [{ child_id: pupil.child_id, profile, school_name: data.school_name, updated_at: pupil.updated_at,
    plans: data.plans.filter((p) => p.child_id === pupil.child_id && p.status === "published" && recipient.plan_ids.includes(p.id)).map(({ id, title, template_snapshot, answers, signer_name, signer_role, signed_at, content_hash, signature }) => ({ id, title, template_snapshot, answers, signer_name, signer_role, signed_at, content_hash, signature })),
    events: data.events.filter((e) => e.child_id === pupil.child_id && recipient.event_ids.includes(e.id)).map((e) => ({ id: e.id, title: e.title, description: e.description, starts_at: e.starts_at, status: e.status })),
  }];
}
