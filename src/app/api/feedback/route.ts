import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/security/request-origin";
import { validatePilotFeedback } from "@/lib/pilot-feedback";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "invalid-origin" }, 403);
  if (Number(request.headers.get("content-length")) > 20000) return reply({ error: "too-long" }, 413);
  const db = await createSupabaseServerClient();
  if (!db) return reply({ error: "unavailable" }, 503);
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return reply({ error: "sign-in" }, 401);
  let answers; let requestId;
  try {
    const raw = await request.text(); if (raw.length > 20000) return reply({ error: "too-long" }, 413);
    const body = JSON.parse(raw); answers = validatePilotFeedback(body.answers); requestId = body.request_id;
    if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error();
  } catch { return reply({ error: "check-fields" }, 400); }
  const { data, error } = await db.rpc("submit_pilot_feedback", { p_answers: answers, p_request_id: requestId });
  if (error) return reply({ error: /rate limit/i.test(error.message) ? "rate-limit" : "not-saved" }, /rate limit/i.test(error.message) ? 429 : 503);
  return reply({ id: data });
}
