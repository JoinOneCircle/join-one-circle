"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configuredSiteOrigin, safeInternalPath } from "@/lib/security/redirect";
import { pilotSignupRole, signupRoleForDestination } from "@/lib/signup-role";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function authRedirect(path: string, key: "error" | "message", message: string): never {
  const url = new URL(path, "https://join-one-circle.invalid");
  url.searchParams.set(key, message);
  redirect(`${url.pathname}${url.search}`);
}

export async function signIn(formData: FormData) {
  const next = safeInternalPath(text(formData, "next"));
  const loginPath = `/login?next=${encodeURIComponent(next)}`;
  if (!isSupabaseConfigured) {
    if (isLocalDemoMode) { const target = new URL(next, "http://localhost"); target.searchParams.set("demo", "1"); redirect(`${target.pathname}${target.search}`); }
    authRedirect(loginPath, "error", "The secure service is not configured yet.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.auth.signInWithPassword({ email: text(formData, "email"), password: text(formData, "password") });
  if (error?.message.toLowerCase().includes("email not confirmed")) {
    authRedirect(loginPath, "error", "Confirm your email first. Open the secure link we sent when you created your account.");
  }
  if (error) authRedirect(loginPath, "error", "We could not sign you in. Check your email and password and try again.");
  redirect(`/mfa?next=${encodeURIComponent(next)}`);
}

export async function signUp(formData: FormData) {
  const requestedNext = text(formData, "next");
  const next = requestedNext.startsWith("/invite/") ? safeInternalPath(requestedNext, "/onboarding") : "/onboarding";
  const intendedRole = signupRoleForDestination(next, text(formData, "intended_role"));
  const signupPath = `/signup?next=${encodeURIComponent(next)}${intendedRole ? `&role=${intendedRole}` : ""}`;
  const name = text(formData, "name");
  const email = text(formData, "email");
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirm_password");
  if (name.length < 2 || name.length > 120) authRedirect(signupPath, "error", "Enter your full name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) authRedirect(signupPath, "error", "Enter a valid email address.");
  if (password.length < 8) authRedirect(signupPath, "error", "Use at least 8 characters for your password.");
  if (password !== confirmPassword) authRedirect(signupPath, "error", "The passwords do not match.");
  if (!pilotSignupRole(intendedRole)) authRedirect(signupPath, "error", "Choose how you will use Join One Circle.");
  if (formData.get("privacy_consent") !== "on") authRedirect(signupPath, "error", "Accept the privacy notice to continue.");
  if (!isSupabaseConfigured) {
    if (isLocalDemoMode) redirect(`/onboarding?demo=1&role=${intendedRole}`);
    authRedirect("/signup", "error", "The secure service is not configured yet.");
  }
  const supabase = await createSupabaseServerClient();
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV, requestHeaders.get("origin"));
  const preferredLanguage = cookieStore.get("joc_language")?.value;
  const language = preferredLanguage === "pt" || preferredLanguage === "es" ? preferredLanguage : "en";
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { display_name: name, preferred_language: language, intended_role: intendedRole },
    },
  });
  if (error) authRedirect(signupPath, "error", "We could not create your account. Check the details and try again.");
  if (data.session) redirect(next);
  redirect(`/login?next=${encodeURIComponent(next)}&message=${encodeURIComponent("We sent a secure confirmation link. Check your email to continue.")}`);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured) {
    authRedirect("/forgot-password", "error", "Password reset is unavailable until the secure service is configured.");
  }
  const supabase = await createSupabaseServerClient();
  const requestHeaders = await headers();
  const origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV, requestHeaders.get("origin"));
  const { error } = await supabase!.auth.resetPasswordForEmail(text(formData, "email"), { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) authRedirect("/forgot-password", "error", "We could not send the reset link. Check the email address and try again.");
  redirect(`/login?message=${encodeURIComponent("Check your email for a secure password reset link.")}`);
}

export async function resendConfirmation(formData: FormData) {
  const next = safeInternalPath(text(formData, "next"), "/onboarding");
  const loginPath = `/login?next=${encodeURIComponent(next)}`;
  const email = text(formData, "email");
  if (!/^\S+@\S+\.\S+$/.test(email)) authRedirect(loginPath, "error", "Enter a valid email address.");
  if (!isSupabaseConfigured) authRedirect(loginPath, "error", "The secure service is not configured yet.");
  const requestHeaders = await headers();
  const origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV, requestHeaders.get("origin"));
  const supabase = await createSupabaseServerClient();
  await supabase!.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  authRedirect(loginPath, "message", "If this account needs confirmation, we sent a new secure link. Check your email.");
}

export async function updatePassword(formData: FormData) {
  if (!isSupabaseConfigured) authRedirect("/reset-password", "error", "Password reset is unavailable until the secure service is configured.");
  const password = text(formData, "password");
  const confirmation = text(formData, "confirm_password");
  if (password.length < 8) authRedirect("/reset-password", "error", "Use at least 8 characters for your password.");
  if (password !== confirmation) authRedirect("/reset-password", "error", "The passwords do not match.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect("/login?message=" + encodeURIComponent("Open the password reset link from your email again."));
  const { error } = await supabase!.auth.updateUser({ password });
  if (error) authRedirect("/reset-password", "error", "We could not update your password. Please try again.");
  redirect(`/login?message=${encodeURIComponent("Your password has been updated. Sign in securely.")}`);
}
