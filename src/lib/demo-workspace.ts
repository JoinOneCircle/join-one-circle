import type { ViewerRole } from "./platform-data";

// Version the local preview independently from the original family-led demo.
// A saved legacy role must not silently reopen the old interface during the
// school rebuild. This preference is never used for authenticated access.
export const DEMO_WORKSPACE_COOKIE = "joc_demo_role_v2";

export function resolveDemoWorkspace(value?: string | null): ViewerRole {
  if (value === "family" || value === "professional" || value === "local_authority") return value;
  return "school";
}
