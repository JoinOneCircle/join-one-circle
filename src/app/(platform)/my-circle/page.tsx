import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CircleManager } from "./circle-manager";
import { DemoCircle } from "./demo-circle";

export default async function MyCirclePage() {
  const context = await getPlatformContext();
  if (context.demo) return <DemoCircle />;
  let people: { userId: string; name: string; role: string; status: string; isAccessAdmin: boolean; readAreas: string[]; childId: string }[] = [];
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.from("child_circle_memberships").select("child_id, user_id, role, status, is_access_admin, permissions, profiles(display_name)").in("child_id", context.children.map((child) => child.id));
    people = (data ?? []).map((member) => ({ userId: member.user_id, childId: member.child_id, role: member.role, status: member.status, isAccessAdmin: member.is_access_admin, readAreas: Array.isArray(member.permissions?.read_areas) ? member.permissions.read_areas : [], name: (member.profiles as unknown as { display_name?: string } | null)?.display_name ?? "Authorised person" }));
  }
  return <><header className="workspace-header"><div><p className="eyebrow">CONSENT & ACCESS</p><h1>My Circle</h1><p>See exactly who can access the child record and what each person can do.</p></div></header><section className="notice"><b>You remain in control.</b><span>New people see nothing until their role and access are confirmed. Access can be reviewed or revoked.</span></section><section className="panel"><CircleManager people={people} childOptions={context.children} /></section><section className="panel audit-summary"><div><p className="eyebrow">ACCESS HISTORY</p><h2>Important access changes are recorded.</h2><p>Ask your record administrator if you need to review an access change.</p></div>{context.role === "local_authority" && <Link className="quiet-button" href="/workspace/audit">View audit history</Link>}</section></>;
}
