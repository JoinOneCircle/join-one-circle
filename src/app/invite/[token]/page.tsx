import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { AppIcon } from "@/components/app-icon";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params; const { error } = await searchParams;
  let signedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.auth.getUser(); signedIn = Boolean(data.user);
  }
  return <AuthShell title="You have been invited to a secure child circle." copy="The family controls exactly what is shared. Nothing else becomes visible when you accept.">
    <p className="eyebrow">PRIVATE INVITATION</p>
    <h2>{signedIn ? "Your secure invitation is ready." : "Join an authorised child circle"}</h2>
    <p>This link is for one person and one email address. You will only receive the record areas chosen by the family.</p>
    <div className="invite-access-summary"><AppIcon name="circle" size={21} /><div><strong>Private, limited access</strong><span>You will be taken straight to an area you are authorised to use.</span></div></div>
    {error && <p className="form-message form-message--error" role="alert">{error}</p>}
    {signedIn ? <form className="invite-accept-form" action={acceptInvitation}><input type="hidden" name="token" value={token} /><button className="button auth-submit" type="submit">Accept secure invitation <span aria-hidden="true">→</span></button></form> : <Link className="button auth-submit" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept <span aria-hidden="true">→</span></Link>}
    <p className="auth-footnote">Do not forward this link. If it was sent to you by mistake, close this page.</p>
  </AuthShell>;
}
