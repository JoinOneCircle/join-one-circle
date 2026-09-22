"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function MfaChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) { router.replace("/login?error=Secure+authentication+is+not+configured"); return; }
    void client.auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data }) => {
      if (!data || data.currentLevel === "aal2" || data.nextLevel !== "aal2") { router.replace(next); return; }
      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
      const verified = factors?.totp.find((factor) => factor.status === "verified");
      if (factorsError || !verified) setError("Your authenticator could not be found. Sign in again or contact support.");
      else setFactorId(verified.id);
      setLoading(false);
    }).catch(() => { setError("We could not check your security step. Please sign in again."); setLoading(false); });
  }, [next, router]);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!factorId || !/^\d{6}$/.test(code)) { setError("Enter the six-digit code from your authenticator app."); return; }
    setSubmitting(true); setError("");
    const client = createSupabaseBrowserClient();
    const { error: verifyError } = await client!.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) { setError("That code was not accepted. Try the current code from your authenticator app."); setSubmitting(false); return; }
    router.replace(next); router.refresh();
  };

  if (loading) return <p role="status">Checking your security step…</p>;
  return <form className="auth-form" onSubmit={verify}><label className="field">Authentication code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></label>{error && <p className="form-alert" role="alert">{error}</p>}<button className="button auth-submit" type="submit" disabled={!factorId || submitting}>{submitting ? "Verifying…" : "Verify and continue"}</button></form>;
}
