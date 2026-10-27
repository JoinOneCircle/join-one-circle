import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { signUp } from "../auth/actions";
import { safeInternalPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const destination = safeInternalPath(next, "/onboarding");
  return <AuthShell title="School and family, connected." copy="The school manages the record. Parents read only the information the school chooses to share.">
    <h2>Create your account</h2><p>Parents need a school invitation before any child information becomes available.</p>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <form className="auth-form" action={signUp}>
      <input type="hidden" name="next" value={safeInternalPath(next, "/onboarding")} />
      <label className="field">Your name<input name="name" autoComplete="name" required placeholder="Your full name" maxLength={120} /></label>
      {destination.startsWith("/invite/") ? <input type="hidden" name="intended_role" value="family"/> : <label className="field">How will you use Join One Circle?
        <select name="intended_role" required defaultValue="">
          <option value="" disabled>Choose your role</option>
          <option value="family">Family or carer</option>
          <option value="school">School or SENCO</option>
        </select>
        <span className="field-hint">This gives you the right first step after confirmation. Access to children is never automatic.</span>
      </label>}
      <label className="field">Email address<input name="email" type="email" autoComplete="email" required placeholder="name@example.com" maxLength={254} /></label>
      <PasswordField label="Password" name="password" autoComplete="new-password" />
      <PasswordField label="Confirm password" name="confirm_password" autoComplete="new-password" />
      <label className="checkbox-field"><input type="checkbox" name="privacy_consent" required /> I agree to the privacy notice and understand that access to a child’s record requires authorisation.</label>
      <button className="button auth-submit" type="submit">Create account</button>
    </form>
    <p className="auth-switch">Already have an account? <Link href={`/login?next=${encodeURIComponent(destination)}`}>Sign in</Link></p>
  </AuthShell>;
}
