import type { PilotPlan } from "./pilot-model";
const part = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "document";
export function pilotPdfFileName(plan: Pick<PilotPlan, "title" | "profile_snapshot">, version: number) {
  return `${part(plan.profile_snapshot?.preferred_name || "child")}-${part(plan.title)}-v${Number.isSafeInteger(version) && version > 0 ? version : 1}.pdf`;
}
