import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import type { PilotData, PilotRecipient } from "./pilot-model";
import { parentContactForShare, parentInvitationRepresented } from "./pilot-recipient-links";

export async function loadPilotSchool(): Promise<PilotData> {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("School connection unavailable");
  const [pupils, templates, plans, invitations, shares, events, school, members] = await Promise.all([
    db.from("pilot_pupils").select("child_id,school_id,profile,revision,updated_at").order("updated_at", { ascending: false }),
    db.from("pilot_templates").select("id,school_id,definition,revision,updated_at").order("updated_at", { ascending: false }),
    db.from("pilot_plans").select("*").order("updated_at", { ascending: false }),
    db.from("pilot_invitations").select("id,child_id,recipient_label,contact_name,relationship,recipient_role,status,profile_fields,plan_ids,event_ids,expires_at,accepted_by"),
    db.from("pilot_parent_shares").select("id,child_id,user_id,profile_fields,plan_ids,event_ids"),
    db.from("child_events").select("id,child_id,title,description,starts_at,status,plan_id").order("starts_at"),
    db.rpc("pilot_school_id"), db.rpc("list_visible_circle_members"),
  ]);
  if (pupils.error || templates.error || plans.error || invitations.error || shares.error || school.error || members.error || events.error) throw new Error("Pilot setup required. Apply pending migrations 0022–0027 before using real records.");
  const ownMembers = (members.data ?? []) as { child_id: string; user_id: string; display_name: string; status: string; role: string }[];
  const recipients: PilotRecipient[] = (shares.data ?? []).map((share) => {
    const member = ownMembers.find((row) => row.child_id === share.child_id && row.user_id === share.user_id);
    const contact = parentContactForShare(share, invitations.data ?? []);
    return { ...share, contact_name: contact?.contact_name, relationship: contact?.relationship, recipient_label: contact?.recipient_label, display_name: contact?.contact_name || member?.display_name || "Parent / carer", recipient_role: "parent", status: member?.status ?? "revoked" };
  });
  for (const invite of invitations.data ?? []) {
    if (parentInvitationRepresented(invite, shares.data ?? [])) continue;
    const member = ownMembers.find((row) => row.child_id === invite.child_id && row.user_id === invite.accepted_by);
    recipients.push({ ...invite, user_id: invite.accepted_by, display_name: invite.contact_name || member?.display_name || invite.recipient_label, status: invite.status === "pending" && Date.parse(invite.expires_at) < Date.now() ? "expired" : member?.status ?? invite.status });
  }
  const organisation = school.data ? await db.from("organisations").select("name").eq("id", school.data).maybeSingle() : null;
  return { school_verified: Boolean(school.data), pupils: pupils.data ?? [], templates: templates.data ?? [], plans: plans.data ?? [], recipients, events: (events.data ?? []).filter((event) => (pupils.data ?? []).some((pupil) => pupil.child_id === event.child_id)), school_name: organisation?.data?.name ?? "School" } as PilotData;
}
