import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
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
  return <main className="auth-page"><BrandLogo /><section className="auth-card"><p className="eyebrow">PRIVATE INVITATION</p><h1>Join an authorised child circle</h1><p>This link is for one person and one email address. You will only receive the record areas chosen by the family.</p>{error && <p className="form-message form-message--error" role="alert">{error}</p>}{signedIn ? <form action={acceptInvitation}><input type="hidden" name="token" value={token} /><button className="button" type="submit">Accept secure invitation</button></form> : <Link className="button" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>}<p className="auth-footnote">Do not forward this link. If it was sent to you by mistake, close this page.</p></section></main>;
}
