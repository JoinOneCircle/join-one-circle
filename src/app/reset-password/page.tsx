import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { updatePassword } from "../auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Choose a new password." copy="This secure page is available only after opening the time-limited link sent to your email.">
    <h2>Set a new password</h2>
    <p>Use at least 8 characters and avoid reusing a password from another service.</p>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <form className="auth-form" action={updatePassword}>
      <PasswordField label="New password" name="password" autoComplete="new-password" />
      <PasswordField label="Confirm new password" name="confirm_password" autoComplete="new-password" />
      <button className="button auth-submit" type="submit">Update password</button>
    </form>
    <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
  </AuthShell>;
}
