import { emptyProfile, prefillAnswers, schoolDateTimeToIso, validateAnswers, validateProfile, validateTemplate, type PilotData, type PilotPlan, type PilotRecipient } from "./pilot-model.ts";
import { planReviewDate } from "./pilot-ux.ts";
import { validateSignature } from "./pilot-signature.ts";

export function initialPilotDemo(): PilotData {
  return { school_name: "Example school", pupils: [{ child_id: "demo-child", school_id: "demo-school", profile: { ...emptyProfile(), preferred_name: "Alex" }, revision: 1, updated_at: "2026-10-01T12:00:00Z" }], templates: [], plans: [], recipients: [], events: [] };
}
export type PilotCommand = { operation: string; id?: string; revision?: number; [key: string]: unknown };
export async function changePilotDemo(previous: PilotData, command: PilotCommand, now = new Date().toISOString(), newId = `demo-${crypto.randomUUID()}`): Promise<{ data: PilotData; id?: string; invitationUrl?: string }> {
  const next: PilotData = structuredClone(previous);
  const findPlan = () => { const p = next.plans.find((plan) => plan.id === command.id); if (!p || p.revision !== command.revision) throw new Error("Someone changed this record. Reload before saving again."); return p; };
  switch (command.operation) {
    case "pupil": {
      const profile = validateProfile(command.profile);
      if (command.id) {
        const p = next.pupils.find((pupil) => pupil.child_id === command.id);
        if (!p || p.revision !== command.revision) throw new Error("Someone changed this record. Reload before saving again.");
        p.profile = profile; p.revision++; p.updated_at = now;
      } else next.pupils.push({ child_id: newId, school_id: "demo-school", profile, revision: 1, updated_at: now });
      return { data: next, id: command.id ?? newId };
    }
    case "template": {
      const definition = validateTemplate(command.definition);
      if (command.id) {
        const t = next.templates.find((template) => template.id === command.id);
        if (!t || t.revision !== command.revision) throw new Error("Template changed or unavailable");
        t.definition = definition; t.revision++; t.updated_at = now;
      } else next.templates.push({ id: newId, school_id: "demo-school", definition, revision: 1, updated_at: now });
      return { data: next, id: command.id ?? newId };
    }
    case "plan-create": {
      const pupil = next.pupils.find((p) => p.child_id === command.child_id);
      const old = command.supersedes_id ? next.plans.find((p) => p.id === command.supersedes_id && p.child_id === command.child_id && p.status !== "draft") : undefined;
      const definition = old?.template_snapshot ?? next.templates.find((t) => t.id === command.template_id)?.definition;
      if (!pupil || !definition || command.supersedes_id && !old) throw new Error("Choose a child and a template");
      const plan: PilotPlan = { id: newId, child_id: pupil.child_id, school_id: "demo-school", title: definition.title, template_snapshot: structuredClone(definition), profile_snapshot: structuredClone(pupil.profile), answers: prefillAnswers(definition, pupil.profile, next.school_name, "Demo school account", now.slice(0, 10)), status: "draft", revision: 1, supersedes_id: old?.id ?? null, signed_by: null, signer_name: null, signer_role: null, signed_at: null, content_hash: null, published_at: null, review_on: old?.review_on ?? null, updated_at: now };
      if (old) for (const section of definition.sections) for (const field of section.fields) if (!field.source) plan.answers[field.id] = old.answers[field.id] ?? "";
      next.plans.unshift(plan); return { data: next, id: newId };
    }
    case "plan-save": {
      const p = findPlan(); if (p.status !== "draft") throw new Error("Signed documents cannot be edited");
      p.answers = validateAnswers(p.template_snapshot, command.answers); p.review_on = planReviewDate(p.template_snapshot, p.answers, typeof command.review_on === "string" ? command.review_on : "") || null; p.revision++; p.updated_at = now; break;
    }
    case "plan-sign": {
      const p = findPlan(); if (p.status !== "draft" || command.confirm !== true || typeof command.signer_name !== "string" || command.signer_name.trim().length < 2 || typeof command.signer_role !== "string" || command.signer_role.trim().length < 2) throw new Error("Confirm the signer and required fields");
      validateAnswers(p.template_snapshot, p.answers, true);
      p.signature = validateSignature(command.signature);
      p.status = "signed"; p.signer_name = command.signer_name.trim(); p.signer_role = command.signer_role.trim(); p.signed_by = "demo-school-account"; p.signed_at = now;
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(p)));
      p.content_hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""); p.revision++; p.updated_at = now; break;
    }
    case "plan-publish": {
      const p = findPlan(); if (p.status !== "signed") throw new Error("Sign before publishing");
      p.status = "published"; p.published_at = now; p.revision++; p.updated_at = now;
      if (p.review_on) next.events.push({ id: newId, child_id: p.child_id, plan_id: p.id, title: "Plan review", description: p.title, starts_at: schoolDateTimeToIso(`${p.review_on}T09:00`), status: "scheduled" });
      break;
    }
    case "invite": {
      if (!next.pupils.some((p) => p.child_id === command.child_id) || typeof command.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(command.email)) throw new Error("Check the invitation details");
      if (command.role !== "school_staff" && (typeof command.contact_name !== "string" || command.contact_name.trim().length < 2 || command.contact_name.length > 120 || typeof command.relationship !== "string" || command.relationship.length > 120)) throw new Error("Check parent contact");
      next.recipients.push({ id: newId, child_id: String(command.child_id), display_name: String(command.contact_name || command.email), contact_name: String(command.contact_name ?? ""), relationship: String(command.relationship ?? ""), recipient_label: command.email, user_id: null, recipient_role: command.role === "school_staff" ? "school_staff" : "parent", status: "draft", profile_fields: command.profile_fields as string[] ?? [], plan_ids: command.plan_ids as string[] ?? [], event_ids: command.event_ids as string[] ?? [] });
      return { data: next, id: newId };
    }
    case "renew-invite": {
      const prior = next.recipients.find(r => r.id === command.id && r.recipient_role === "parent" && ["pending", "expired"].includes(r.status));
      if (!prior) throw new Error("Invitation unavailable");
      prior.status = "revoked"; prior.profile_fields = []; prior.plan_ids = []; prior.event_ids = [];
      return changePilotDemo(next, { ...command, operation: "invite", child_id: prior.child_id, email: prior.recipient_label, role: "parent" }, now, newId);
    }
    case "sharing": {
      const r = next.recipients.find((r) => r.id === command.id); if (!r || r.status === "revoked") throw new Error("Access unavailable");
      if (typeof command.contact_name !== "string" || command.contact_name.trim().length < 2 || command.contact_name.length > 120 || typeof command.relationship !== "string" || command.relationship.length > 120) throw new Error("Check parent contact");
      r.contact_name = command.contact_name.trim(); r.relationship = command.relationship.trim(); r.display_name = r.contact_name;
      const strings = (value: unknown): string[] => Array.isArray(value) && value.every((v) => typeof v === "string") ? value : [];
      Object.assign(r, { profile_fields: strings(command.profile_fields), plan_ids: strings(command.plan_ids), event_ids: strings(command.event_ids) } satisfies Partial<PilotRecipient>);
      if (r.plan_ids.some((id) => !next.plans.some((p) => p.id === id && p.child_id === r.child_id && p.status === "published"))) throw new Error("Only published documents can be shared");
      break;
    }
    case "revoke": { const r = next.recipients.find((r) => r.id === command.id); if (!r) throw new Error("Access unavailable"); r.status = "revoked"; r.profile_fields = []; r.plan_ids = []; r.event_ids = []; break; }
    case "event": {
      if (!next.pupils.some((p) => p.child_id === command.child_id) || typeof command.title !== "string" || !command.title.trim() || command.title.length > 200 || typeof command.starts_at !== "string" || !Number.isFinite(Date.parse(command.starts_at))) throw new Error("Check event details");
      next.events.push({ id: newId, child_id: String(command.child_id), title: command.title.trim(), description: String(command.description ?? "").slice(0, 2000), starts_at: command.starts_at, status: "scheduled" }); return { data: next, id: newId };
    }
    case "event-cancel": {
      const e = next.events.find((e) => e.id === command.id); if (!e) throw new Error("Event unavailable"); e.status = "cancelled"; break;
    }
    default: throw new Error("Action unavailable in the preview");
  }
  return { data: next, id: command.id };
}
