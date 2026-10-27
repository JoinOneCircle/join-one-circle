import type { PilotRecipient } from "./pilot-model.ts";

// UI proposal for a new invitation only. Existing contacts, including contacts
// without the child's name, retain their exact saved whitelist until confirmed.
export function initialParentFields(recipient?: Pick<PilotRecipient, "profile_fields">): string[] {
  return recipient ? [...recipient.profile_fields] : ["preferred_name"];
}
