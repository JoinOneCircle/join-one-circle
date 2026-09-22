import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supported = new Set(["en", "pt", "es"]);

export async function POST(request: Request) {
  let language: unknown;
  try {
    ({ language } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-language" }, { status: 400 });
  }

  if (typeof language !== "string" || !supported.has(language)) {
    return NextResponse.json({ ok: false, error: "invalid-language" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, saved: "browser" });

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) return NextResponse.json({ ok: true, saved: "browser" });

  const [profileResult, authResult] = await Promise.all([
    supabase!.from("profiles").update({ preferred_language: language }).eq("id", authData.user.id),
    supabase!.auth.updateUser({ data: { preferred_language: language } }),
  ]);

  if (profileResult.error || authResult.error) {
    return NextResponse.json({ ok: false, error: "save-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: "account" });
}
