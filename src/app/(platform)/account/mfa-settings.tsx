"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Enrollment = { id: string; qr: string; secret: string };

export function MfaSettings() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { const client = createSupabaseBrowserClient(); if (!client) { setEnabled(false); return; } void client.auth.mfa.listFactors().then(({ data }) => setEnabled(Boolean(data?.totp.some((factor) => factor.status === "verified")))).catch(() => setEnabled(false)); }, []);
  const begin = async () => { const client = createSupabaseBrowserClient(); if (!client) { setError("Secure authentication is not configured yet."); return; } setWorking(true); setError(""); const { data, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Join One Circle authenticator" }); if (enrollError || !data?.totp) { setError("We could not start authenticator setup. Please try again."); setWorking(false); return; } setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setWorking(false); };
  const verify = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!enrollment || !/^\d{6}$/.test(code.replace(/\s/g, ""))) { setError("Enter the six-digit code from your authenticator app."); return; } setWorking(true); setError(""); const client = createSupabaseBrowserClient(); const { error: verifyError } = await client!.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: code.replace(/\s/g, "") }); if (verifyError) { setError("That code was not accepted. Try the current code."); setWorking(false); return; } setEnrollment(null); setEnabled(true); setCode(""); setWorking(false); };
  if (enabled === null) return <div className="settings-row"><span>Multi-factor authentication</span><small>Checking account security…</small></div>;
  if (enabled) return <div className="settings-row"><span>Multi-factor authentication</span><strong>Authenticator app enabled</strong><small>Your account requires a second step when you sign in.</small></div>;
  if (enrollment) return <div className="mfa-enrollment"><h3>Set up an authenticator app</h3><p>Scan this code with Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app. If scanning is unavailable, enter the setup key manually.</p><img className="mfa-qr" src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qr)}`} alt="QR code for Join One Circle authenticator setup" /><details><summary>Use a manual setup key instead</summary><code>{enrollment.secret}</code></details><form className="inline-edit" onSubmit={verify}><label className="field">Six-digit code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>{error && <p className="form-alert" role="alert">{error}</p>}<button className="button button--small" type="submit" disabled={working}>{working ? "Verifying…" : "Enable authenticator"}</button><button className="quiet-button" type="button" disabled={working} onClick={() => setEnrollment(null)}>Cancel</button></form></div>;
  return <div className="settings-row"><span>Multi-factor authentication</span><div><strong>Not enabled</strong><small>Add an authenticator app for an extra sign-in check.</small>{error && <p className="form-alert" role="alert">{error}</p>}</div><button type="button" onClick={begin} disabled={working}>{working ? "Preparing…" : "Set up"}</button></div>;
}
