import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { resendConfirmation, signIn } from "../auth/actions";
import { safeInternalPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string; resend?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Welcome back." copy="Open the child records and actions you are authorised to support.">
    <h2>Sign in</h2><p>Use the email connected to your circle.</p>
    {query.error && <div className="form-alert" role="alert">{query.error}</div>}
    {query.message && <div className="notice" role="status">{query.message}</div>}
    <form className="auth-form" action={signIn}>
      <input type="hidden" name="next" value={safeInternalPath(query.next)} />
      <label className="field">Email address<input name="email" type="email" autoComplete="email" required /></label>
      {query.resend === "confirmation" && <div className="auth-resend"><span>Need another confirmation email?</span><button className="quiet-button" type="submit" formAction={resendConfirmation} formNoValidate>Send a new link</button></div>}
      <PasswordField label="Password" name="password" autoComplete="current-password" />
      <div className="form-link-row"><label className="checkbox-field"><input type="checkbox" name="remember" /> Keep me signed in</label><Link href="/forgot-password">Forgot password?</Link></div>
      <button className="button auth-submit" type="submit">Sign in securely</button>
    </form>
    <p className="auth-switch">New to Join One Circle? <Link href="/signup">Create an account</Link></p>
  </AuthShell>;
}
