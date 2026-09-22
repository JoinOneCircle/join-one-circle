"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SchoolImportRow = { name: string; dob: string; support: string };
export type SchoolImportResult = {
  created?: number;
  skipped?: number;
  rejected?: number;
  error?: string;
};

function asImportRows(value: unknown): SchoolImportRow[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const rows: SchoolImportRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const dob = typeof candidate.dob === "string" ? candidate.dob.trim() : "";
    const support = typeof candidate.support === "string" ? candidate.support.trim() : "";
    if (!name || name.length > 120 || support.length > 2000) return null;
    rows.push({ name, dob, support });
  }
  return rows;
}

export async function importSchoolPupils(filename: string, submittedRows: unknown): Promise<SchoolImportResult> {
  const safeFilename = filename.trim();
  const rows = asImportRows(submittedRows);
  if (!safeFilename || safeFilename.length > 255 || !rows) {
    return { error: "Review the CSV and keep only valid rows before importing." };
  }
  if (!isSupabaseConfigured) {
    return { error: "Connect this workspace before importing pupil records." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) return { error: "Sign in again before importing pupil records." };

  const { data, error } = await supabase!.rpc("import_school_pupils", {
    p_filename: safeFilename,
    p_rows: rows,
  });
  if (error || !data || typeof data !== "object") {
    // Database errors can include implementation details. The migration returns
    // purpose-built safe messages for expected permission/validation failures.
    const message = error?.message;
    if (message?.includes("verified school") || message?.includes("required to import")) {
      return { error: "This import needs a verified school SENCO or administrator account." };
    }
    return { error: "The pupil list could not be imported. Check the CSV and try again." };
  }

  const result = data as { created?: unknown; skipped?: unknown; rejected?: unknown };
  const created = typeof result.created === "number" ? result.created : 0;
  const skipped = typeof result.skipped === "number" ? result.skipped : 0;
  const rejected = typeof result.rejected === "number" ? result.rejected : 0;
  revalidatePath("/children");
  revalidatePath("/dashboard");
  revalidatePath("/data-import");
  return { created, skipped, rejected };
}
