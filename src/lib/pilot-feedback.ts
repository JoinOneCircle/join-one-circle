export const feedbackAreas = ["signup", "children", "templates", "documents", "signature", "pdf", "parents", "calendar", "other"] as const;
export const feedbackRoles = ["school", "parent", "other"] as const;
export const feedbackResults = ["completed", "partly", "blocked", "not_tested"] as const;
export const feedbackKinds = ["bug", "suggestion", "general"] as const;
export type PilotFeedback = {
  role: typeof feedbackRoles[number]; areas: (typeof feedbackAreas[number])[];
  result: typeof feedbackResults[number]; ease: number; kind: typeof feedbackKinds[number];
  summary: string; details: string; steps: string; expected: string;
  allow_contact: boolean; privacy_confirmed: true;
};

export function validatePilotFeedback(input: unknown): PilotFeedback {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid-feedback");
  const value = input as Record<string, unknown>;
  const choice = <T extends string>(key: string, options: readonly T[]): T => {
    if (typeof value[key] !== "string" || !options.includes(value[key] as T)) throw new Error(`invalid-${key}`);
    return value[key] as T;
  };
  const text = (key: string, min: number, max: number) => {
    if (typeof value[key] !== "string") throw new Error(`invalid-${key}`);
    const result = value[key].trim();
    if (result.length < min || result.length > max) throw new Error(`invalid-${key}`);
    return result;
  };
  if (!Array.isArray(value.areas) || value.areas.length < 1 || value.areas.length > feedbackAreas.length || value.areas.some(a => !feedbackAreas.includes(a as typeof feedbackAreas[number]))) throw new Error("invalid-areas");
  if (!Number.isInteger(value.ease) || Number(value.ease) < 1 || Number(value.ease) > 5) throw new Error("invalid-ease");
  if (value.privacy_confirmed !== true || typeof value.allow_contact !== "boolean") throw new Error("privacy-required");
  return {
    role: choice("role", feedbackRoles), areas: [...new Set(value.areas)] as PilotFeedback["areas"],
    result: choice("result", feedbackResults), ease: Number(value.ease), kind: choice("kind", feedbackKinds),
    summary: text("summary", 5, 160), details: text("details", 10, 4000), steps: text("steps", 0, 2000), expected: text("expected", 0, 1500),
    allow_contact: value.allow_contact, privacy_confirmed: true,
  };
}
