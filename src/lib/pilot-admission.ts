import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import { isLocalDemoMode } from "./supabase/config";

export async function pilotSchoolEnrolmentOpen() {
  const db = await createSupabaseServerClient();
  if (!db) return isLocalDemoMode;
  const { data, error } = await db.rpc("pilot_school_enrolment_open");
  // Missing configuration never silently removes the approval gate.
  return !error && data === true;
}
