import { safeInternalPath } from "@/lib/security/redirect";
import { MfaChallenge } from "./mfa-challenge";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Verify your sign-in</h1><p>Open your authenticator app and enter the current six-digit code.</p><MfaChallenge next={safeInternalPath(query.next)} /></section></main>;
}
