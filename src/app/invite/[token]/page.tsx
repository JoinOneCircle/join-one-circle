import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvitationPanel } from "./invitation-panel";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params; const { error } = await searchParams;
  let email = "";
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.auth.getUser(); email = data.user?.email ?? "";
  }
  return <AuthShell title="You have been invited to a secure child circle." copy="The record administrator controls exactly what is shared. Nothing else becomes visible when you accept."><InvitationPanel token={token} email={email} failed={!!error}/></AuthShell>;
}
