import { NextRequest, NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadPilotSchool } from "@/lib/pilot-server";
import { validateProfile, validateTemplate, type TemplateDefinition } from "@/lib/pilot-model";
import { configuredSiteOrigin } from "@/lib/security/redirect";
import { validateSignature } from "@/lib/pilot-signature";
import { isSameOriginRequest } from "@/lib/security/request-origin";

const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null;
const array = (v: unknown) => Array.isArray(v) && v.length <= 100 && v.every((i) => typeof i === "string") ? v as string[] : [];

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  if (!db) return response({ error: "Live connection required" }, 503);
  const { data } = await db.auth.getUser();
  if (!data.user) return response({ error: "Sign in required" }, 401);
  if (request.nextUrl.searchParams.get("view") === "parent") {
    const result = await db.rpc("pilot_parent_view");
    return result.error ? response({ error: "Shared information is unavailable" }, 503) : response({ children: result.data ?? [] });
  }
  const context = await getPlatformContext();
  if (context.role !== "school") return response({ error: "School access required" }, 403);
  try { return response(await loadPilotSchool()); }
  catch { return response({ error: "Pilot setup required. Apply migrations 0022 and 0023 before using real records." }, 503); }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return response({ error: "Live connection required" }, 503);
  if (!isSameOriginRequest(request) || !request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "Request not allowed" }, 403);
  if (Number(request.headers.get("content-length")) > 300000) return response({ error: "Request too large" }, 413);
  const db = await createSupabaseServerClient();
  const { data } = await db!.auth.getUser();
  if (!data.user) return response({ error: "Sign in required" }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); if (!body || JSON.stringify(body).length > 300000) throw new Error(); }
  catch { return response({ error: "Invalid request" }, 400); }
  const context = await getPlatformContext();
  if (context.role !== "school") return response({ error: "School access required" }, 403);
  const id = uuid(body.id);
  const revision = Number.isSafeInteger(body.revision) ? Number(body.revision) : 0;
  let result;
  try {
    switch (body.operation) {
      case "pupil":
        if (body.id && !id) throw new Error();
        result = await db!.rpc("pilot_save_pupil", { p_child_id: id, p_profile: validateProfile(body.profile), p_revision: revision }); break;
      case "template":
        if (body.id && !id) throw new Error();
        result = await db!.rpc("pilot_save_template", { p_id: id, p_definition: validateTemplate(body.definition), p_revision: revision }); break;
      case "plan-create":
        if (!uuid(body.child_id) || !uuid(body.template_id) && !uuid(body.supersedes_id)) throw new Error();
        result = await db!.rpc("pilot_create_plan", { p_child_id: body.child_id, p_template_id: uuid(body.template_id), p_supersedes_id: uuid(body.supersedes_id) }); break;
      case "plan-save":
        if (!id || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) throw new Error();
        result = await db!.rpc("pilot_save_plan", { p_id: id, p_answers: body.answers, p_review_on: body.review_on || null, p_revision: revision }); break;
      case "plan-sign":
        if (!id || typeof body.signer_name !== "string" || typeof body.signer_role !== "string" || body.confirm !== true) throw new Error();
        result = await db!.rpc("pilot_sign_plan_drawn", { p_id: id, p_revision: revision, p_signer_name: body.signer_name, p_signer_role: body.signer_role, p_confirm: true, p_signature: validateSignature(body.signature) }); break;
      case "plan-publish":
        if (!id) throw new Error();
        result = await db!.rpc("pilot_publish_plan", { p_id: id, p_revision: revision }); break;
      case "invite": {
        if (!uuid(body.child_id) || typeof body.email !== "string" || !["parent", "school_staff"].includes(String(body.role))) throw new Error();
        // Validate the canonical origin BEFORE issuing a usable token.
        const origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
        result = body.role === "parent" ? await db!.rpc("pilot_invite_parent", { p_child_id: body.child_id, p_email: body.email, p_contact_name: body.contact_name, p_relationship: body.relationship ?? "", p_fields: array(body.profile_fields), p_plans: array(body.plan_ids), p_events: array(body.event_ids) }) : await db!.rpc("pilot_invite", { p_child_id: body.child_id, p_email: body.email, p_role: body.role, p_fields: [], p_plans: [], p_events: [] });
        if (!result.error) return response({ invitationUrl: `${origin}/invite/${result.data}`, message: "Invitation created" });
        break;
      }
      case "renew-invite": {
        if (!id) throw new Error();
        const origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
        result = await db!.rpc("pilot_renew_parent_invitation", { p_id: id, p_contact_name: body.contact_name, p_relationship: body.relationship ?? "", p_fields: array(body.profile_fields), p_plans: array(body.plan_ids), p_events: array(body.event_ids) });
        if (!result.error) return response({ invitationUrl: `${origin}/invite/${result.data}`, message: "Invitation renewed" });
        break;
      }
      case "sharing":
        if (!id) throw new Error();
        result = await db!.rpc("pilot_set_parent_sharing", { p_id: id, p_contact_name: body.contact_name, p_relationship: body.relationship ?? "", p_fields: array(body.profile_fields), p_plans: array(body.plan_ids), p_events: array(body.event_ids) }); break;
      case "revoke":
        if (!id) throw new Error();
        result = await db!.rpc("pilot_revoke", { p_id: id }); break;
      case "event":
        if (!uuid(body.child_id) || typeof body.title !== "string" || !body.title.trim() || body.title.length > 200 || typeof body.description !== "string" || body.description.length > 2000 || typeof body.starts_at !== "string" || !Number.isFinite(Date.parse(body.starts_at))) throw new Error();
        result = await db!.rpc("create_child_event", { p_child_id: body.child_id, p_title: body.title.trim(), p_description: body.description, p_starts_at: body.starts_at, p_ends_at: null, p_participant_ids: null }); break;
      case "event-cancel":
        if (!id) throw new Error();
        result = await db!.rpc("cancel_child_event", { p_event_id: id }); break;
      default: return response({ error: "Unknown operation" }, 400);
    }
  } catch { return response({ error: "Check the required information and try again." }, 400); }
  if (result.error) {
    const conflict = /changed|reload/i.test(result.error.message);
    return response({ error: conflict ? "Someone changed this record. Reload before saving again." : "Could not save. Check your school access, required fields and document status." }, conflict ? 409 : 400);
  }
  return response({ id: result.data, message: "Saved" });
}

// Keep template data imported as a type only; never accept a client-side
// snapshot as the signed document's source of truth.
export type PilotTemplateInput = TemplateDefinition;
