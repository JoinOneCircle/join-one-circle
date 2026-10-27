import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderPilotPdf } from "@/lib/pilot-pdf";
import { pilotPdfFileName } from "@/lib/pilot-pdf-name";
import { planVersion } from "@/lib/pilot-ux";
import type { PilotPlan } from "@/lib/pilot-model";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ planId: string }> }) {
  const db = await createSupabaseServerClient();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!db || !(await db.auth.getUser()).data.user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  const { planId } = await params;
  // RLS permits only current school staff; parents never get this PDF URL.
  const { data, error } = await db.from("pilot_plans").select("*").eq("id", planId).in("status", ["signed", "published"]).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Document unavailable" }, { status: 404, headers });
  try {
    const lineage = await db.from("pilot_plans").select("id,child_id,supersedes_id").eq("child_id", data.child_id);
    if (lineage.error) throw new Error("Version unavailable");
    const version = planVersion(data, lineage.data ?? []);
    const bytes = await renderPilotPdf(data as PilotPlan, version); return new NextResponse(new Uint8Array(bytes).buffer, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pilotPdfFileName(data as PilotPlan, version)}"` } }); }
  catch { return NextResponse.json({ error: "PDF generation unavailable" }, { status: 503, headers }); }
}
