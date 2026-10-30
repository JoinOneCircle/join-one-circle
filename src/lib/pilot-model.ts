// Shared by the authenticated API, forms and the isolated local preview.
import type { SchoolSignature } from "./pilot-signature.ts";
import { validateTable, type TableColumn } from "./pilot-table.ts";
export const pupilFields = ["preferred_name", "date_of_birth", "year_group", "strengths", "needs", "communication", "interests", "child_views", "parent_views", "outcomes", "provision", "progress"] as const;
export type PupilField = typeof pupilFields[number];
export type PupilProfile = Record<PupilField, string>;
export type PilotPupil = { child_id: string; school_id: string; profile: PupilProfile; revision: number; updated_at: string };
export type TemplateField = { id: string; label: string; type: "text" | "textarea" | "date" | "number" | "select" | "table"; required: boolean; source: PupilField | "school_name" | "author" | "today" | ""; options?: string[]; columns?: TableColumn[] };
export type TemplateSection = { id: string; title: string; fields: TemplateField[] };
export type TemplateDefinition = { title: string; sections: TemplateSection[] };
export type PilotTemplate = { id: string; school_id: string; definition: TemplateDefinition; revision: number; updated_at: string };
export type PilotPlan = { id: string; child_id: string; school_id: string; title: string; template_snapshot: TemplateDefinition; profile_snapshot: PupilProfile; answers: Record<string, string>; status: "draft" | "signed" | "published"; revision: number; supersedes_id: string | null; signed_by: string | null; signer_name: string | null; signer_role: string | null; signed_at: string | null; signature?: SchoolSignature | null; content_hash: string | null; published_at: string | null; review_on: string | null; updated_at: string };
export type PilotRecipient = { id: string; child_id: string; display_name: string; contact_name?: string; relationship?: string; recipient_label?: string; user_id: string | null; recipient_role: "parent" | "school_staff"; status: string; profile_fields: string[]; plan_ids: string[]; event_ids: string[]; expires_at?: string };
export type PilotEvent = { id: string; child_id: string; title: string; description: string; starts_at: string; status: string; plan_id?: string | null };
export type PilotData = { pupils: PilotPupil[]; templates: PilotTemplate[]; plans: PilotPlan[]; recipients: PilotRecipient[]; events: PilotEvent[]; school_name: string; school_verified?: boolean; school_access_status?: string; open_school_pilot?: boolean; error?: string };
export const emptyProfile = (): PupilProfile => Object.fromEntries(pupilFields.map((key) => [key, ""])) as PupilProfile;

export function validateProfile(input: unknown): PupilProfile {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid profile");
  const source = input as Record<string, unknown>;
  const profile = emptyProfile();
  for (const field of pupilFields) {
    if (typeof source[field] !== "string" || source[field].length > (field === "preferred_name" ? 120 : 10000)) throw new Error("Invalid profile field");
    profile[field] = source[field].trim();
  }
  if (!profile.preferred_name) throw new Error("A child name is required");
  if (profile.date_of_birth) {
    const date = new Date(`${profile.date_of_birth}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.date_of_birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== profile.date_of_birth || date.getTime() > Date.now()) throw new Error("Invalid date of birth");
  }
  return profile;
}

export function validateTemplate(input: unknown): TemplateDefinition {
  if (!input || typeof input !== "object") throw new Error("Invalid template");
  const definition = input as TemplateDefinition;
  if (typeof definition.title !== "string" || !definition.title.trim() || definition.title.length > 200 || !Array.isArray(definition.sections) || !definition.sections.length || definition.sections.length > 30) throw new Error("Invalid template");
  const seen = new Set<string>();
  let count = 0;
  const sections = definition.sections.map((section) => {
    if (!section || typeof section.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(section.id) || seen.has(section.id) || typeof section.title !== "string" || !section.title.trim() || section.title.length > 200 || !Array.isArray(section.fields) || !section.fields.length) throw new Error("Invalid section");
    seen.add(section.id);
    return { id: section.id, title: section.title.trim(), fields: section.fields.map((field) => {
      count++;
      if (!field || typeof field.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(field.id) || ["__proto__", "constructor", "prototype"].includes(field.id) || seen.has(field.id) || typeof field.label !== "string" || !field.label.trim() || field.label.length > 200 || !["text", "textarea", "date", "number", "select", "table"].includes(field.type) || typeof field.required !== "boolean" || ![...pupilFields, "school_name", "author", "today", ""].includes(field.source)) throw new Error("Invalid field");
      seen.add(field.id);
      const options = field.type === "select" ? field.options : undefined;
      if (field.type === "select" && (!Array.isArray(options) || !options.length || options.length > 30 || options.some((value) => typeof value !== "string" || !value.trim() || value.length > 200))) throw new Error("Invalid choices");
      const columns = field.type === "table" ? field.columns : undefined;
      if (field.type === "table" && (field.source !== "" || !Array.isArray(columns) || columns.length < 1 || columns.length > 8 || new Set(columns.map(c => c?.id)).size !== columns.length || columns.some(c => !c || !/^[a-zA-Z0-9_-]{1,80}$/.test(c.id) || ["__proto__", "constructor", "prototype"].includes(c.id) || typeof c.label !== "string" || !c.label.trim() || c.label.length > 120))) throw new Error("Invalid table columns");
      return { id: field.id, label: field.label.trim(), type: field.type, required: field.required, source: field.source, ...(options ? { options } : {}), ...(columns ? { columns: columns.map(c => ({ id: c.id, label: c.label.trim() })) } : {}) };
    }) };
  });
  if (count > 200) throw new Error("Too many fields");
  return { title: definition.title.trim(), sections };
}

export function prefillAnswers(definition: TemplateDefinition, profile: PupilProfile, school: string, author: string, date: string): Record<string, string> {
  const sources = { ...profile, school_name: school, author, today: date };
  return Object.fromEntries(definition.sections.flatMap((section) => section.fields.map((field) => [field.id, field.source ? sources[field.source] ?? "" : ""])));
}

export function validateAnswers(definition: TemplateDefinition, input: unknown, requireComplete = false): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid answers");
  return Object.fromEntries(definition.sections.flatMap((section) => section.fields.map((field) => {
    const answer = (input as Record<string, unknown>)[field.id] ?? "";
    if (typeof answer !== "string" || answer.length > (field.type === "table" ? 100000 : 10000) || requireComplete && field.required && !answer.trim() || field.type === "select" && answer && !field.options?.includes(answer) || field.type === "number" && answer && !Number.isFinite(Number(answer)) || field.type === "date" && answer && (!/^\d{4}-\d{2}-\d{2}$/.test(answer) || new Date(`${answer}T12:00:00Z`).toISOString().slice(0, 10) !== answer)) throw new Error(`Check: ${field.label}`);
    if (field.type === "table") validateTable(answer, field.columns ?? [], requireComplete, field.required);
    return [field.id, answer];
  })));
}

export function parentProjection(profile: PupilProfile, selected: string[]): Partial<PupilProfile> {
  return Object.fromEntries(pupilFields.filter((field) => selected.includes(field)).map((field) => [field, profile[field]]));
}

export function schoolDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Invalid school date/time");
  const guess = new Date(`${value}:00Z`);
  if (!Number.isFinite(guess.getTime())) throw new Error("Invalid school date/time");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const asLocal = (date: Date) => { const p = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
  const localGuess = new Date(`${asLocal(guess)}:00Z`).getTime();
  const result = new Date(guess.getTime() - (localGuess - guess.getTime()));
  if (asLocal(result) !== value) throw new Error("This school time does not exist because of the clock change");
  return result.toISOString();
}
