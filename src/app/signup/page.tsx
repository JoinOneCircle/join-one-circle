import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { signUp } from "../auth/actions";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Start one secure circle." copy="Create your account first. We only ask for the child’s details when they are needed.">
    <h2>Create your account</h2><p>You can invite the rest of the circle later.</p>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <form className="auth-form" action={signUp}>
      <label className="field">Your name<input name="name" autoComplete="name" required /></label>
      <label className="field">How will you use Join One Circle?
        <select name="intended_role" required defaultValue="">
          <option value="" disabled>Choose your role</option>
          <option value="family">Family or carer</option>
          <option value="school">School or SENCO</option>
          <option value="professional">Professional</option>
          <option value="local_authority">Local Authority</option>
        </select>
        <span className="field-hint">This gives you the right first step after confirmation. Access to children is never automatic.</span>
      </label>
      <label className="field">Email address<input name="email" type="email" autoComplete="email" required /></label>
      <PasswordField label="Password" name="password" autoComplete="new-password" />
      <PasswordField label="Confirm password" name="confirm_password" autoComplete="new-password" />
      <label className="checkbox-field"><input type="checkbox" name="privacy_consent" required /> I agree to the privacy notice and understand that access to a child’s record requires authorisation.</label>
      <button className="button auth-submit" type="submit">Create account</button>
    </form>
    <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
  </AuthShell>;
}
