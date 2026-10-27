type ShareIdentity = { child_id: string; user_id: string | null };
type InvitationIdentity = { child_id: string; accepted_by: string | null; recipient_role: string; status: string };

// A revoked accepted invitation remains linked to its share. It is history of
// the same recipient, not a second person or another grant of access.
export function parentInvitationRepresented(invite: InvitationIdentity, shares: ShareIdentity[]) {
  return invite.recipient_role === "parent" && (invite.status === "accepted" || Boolean(invite.accepted_by && shares.some(share => share.child_id === invite.child_id && share.user_id === invite.accepted_by)));
}

export function parentContactForShare<T extends InvitationIdentity>(share: ShareIdentity, invitations: T[]): T | undefined {
  const matches = (invite: T) => invite.child_id === share.child_id && invite.accepted_by === share.user_id && invite.recipient_role === "parent";
  return invitations.find(invite => matches(invite) && invite.status === "accepted")
    ?? invitations.find(invite => matches(invite) && invite.status === "revoked");
}
