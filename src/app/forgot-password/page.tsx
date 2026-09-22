import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { requestPasswordReset } from "../auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Regain secure access." copy="We will use a time-limited link and never ask you to send a password by email.">
    <h2>Reset your password</h2><p>Enter your account email and we will send a time-limited reset link.</p>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <form className="auth-form" action={requestPasswordReset}><label className="field">Email address<input name="email" type="email" autoComplete="email" required /></label><button className="button auth-submit" type="submit">Send reset link</button></form>
    <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
  </AuthShell>;
}
