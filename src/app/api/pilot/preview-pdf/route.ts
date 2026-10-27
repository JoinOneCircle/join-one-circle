import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { renderPilotPdf } from "@/lib/pilot-pdf";
import { pilotPdfFileName } from "@/lib/pilot-pdf-name";
import { validateAnswers, validateTemplate, type PilotPlan } from "@/lib/pilot-model";
import { validateSignature } from "@/lib/pilot-signature";
import { isSameOriginRequest } from "@/lib/security/request-origin";
export const runtime = "nodejs";
// Local synthetic preview only. Real documents MUST use the authenticated,
// RLS-scoped persisted-version endpoint; never trust a browser snapshot there.
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (isSupabaseConfigured || process.env.NODE_ENV !== "development" || !["127.0.0.1", "localhost"].includes(request.nextUrl.hostname)) return new NextResponse(null, { status: 404, headers });
  if (!isSameOriginRequest(request) || !request.headers.get("content-type")?.startsWith("application/json")) return new NextResponse(null, { status: 403, headers });
  try {
    const raw = await request.text(); if (raw.length > 300000) return new NextResponse(null, { status: 413, headers });
    const p = JSON.parse(raw) as PilotPlan & { preview_version?: number };
    if (!p || !["signed", "published"].includes(p.status) || typeof p.title !== "string" || !p.title.trim() || p.title.length > 200 || typeof p.id !== "string" || p.id.length > 100 || typeof p.signed_at !== "string" || !Number.isFinite(Date.parse(p.signed_at))) throw new Error();
    for (const key of ["signer_name", "signer_role", "signed_by", "content_hash"] as const) if (typeof p[key] !== "string" || p[key]!.length > 150) throw new Error();
    p.template_snapshot = validateTemplate(p.template_snapshot); p.answers = validateAnswers(p.template_snapshot, p.answers, true);
    if (p.signature) p.signature = validateSignature(p.signature);
    const version = Number.isSafeInteger(p.preview_version) && p.preview_version! > 0 && p.preview_version! <= 1000 ? p.preview_version! : 1;
    const bytes = await renderPilotPdf(p, version);
    return new NextResponse(new Uint8Array(bytes).buffer, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pilotPdfFileName(p, version)}"` } });
  } catch { return NextResponse.json({ error: "Preview PDF unavailable" }, { status: 400, headers }); }
}
