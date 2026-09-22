import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { safeInternalPath } from "@/lib/security/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));
  const callbackError = url.searchParams.get("error");

  // Supabase sends access_denied for an expired, already-used, or unauthorised
  // confirmation link. Never expose that raw provider code to a family.
  if (callbackError || !code || !isSupabaseConfigured) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "We could not confirm that email link. Request a new one and open it only once.");
    loginUrl.searchParams.set("resend", "confirmation");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.headers.get("cookie")?.split(";").filter(Boolean).map((part) => {
        const [name, ...value] = part.trim().split("=");
        return { name, value: value.join("=") };
      }) ?? [],
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "We could not confirm that email link. Request a new one and open it only once.");
    loginUrl.searchParams.set("resend", "confirmation");
    return NextResponse.redirect(loginUrl);
  }
  return response;
}
