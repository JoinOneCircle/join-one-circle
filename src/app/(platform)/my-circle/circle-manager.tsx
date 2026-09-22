"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { invitePerson, revokeAccess, type InviteState } from "./actions";

type Person = { userId: string; name: string; role: string; status: string; isAccessAdmin: boolean; readAreas: string[]; childId: string };
const initialState: InviteState = {};
const readAreas = ["documents", "evidence", "review", "action"] as const;
const roleIcon = (role: string): AppIconName => role === "senco" || role === "school_staff" ? "register" : role === "professional" ? "caseload" : role === "local_authority" ? "decisions" : "children";
const roleLabel: Record<string, string> = { parent: "Parent", family: "Family", senco: "SENCO", school_staff: "School staff", professional: "Professional", local_authority: "Local Authority" };

export function CircleManager({ people, childOptions }: { people: Person[]; childOptions: { id: string; preferred_name: string }[] }) {
  const [open, setOpen] = useState(false); const [selectedAreas, setSelectedAreas] = useState<string[]>([]); const [state, action, pending] = useActionState(invitePerson, initialState);
  const [dismissedInviteUrl, setDismissedInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [removeTarget, setRemoveTarget] = useState<Person | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [revokeError, setRevokeError] = useState<string>("");
  const cancelRemoveButton = useRef<HTMLButtonElement>(null);
  const copyInviteButton = useRef<HTMLButtonElement>(null);
  const [revoking, startRevoking] = useTransition();
  const inviteUrl = state.invitationUrl && state.invitationUrl !== dismissedInviteUrl ? state.invitationUrl : "";

  useEffect(() => {
    if (!removeTarget) return;
    cancelRemoveButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !revoking) setRemoveTarget(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [removeTarget, revoking]);

  useEffect(() => {
    if (inviteUrl) copyInviteButton.current?.focus();
  }, [inviteUrl]);

  const confirmRevoke = (formData: FormData) => {
    startRevoking(async () => {
      const result = await revokeAccess(formData);
      if (result.error) {
        setRevokeError(result.error);
        return;
      }
      setFeedback(result.message ?? "Access removed.");
      setRemoveTarget(null);
    });
  };

  const copyInvitation = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(inviteUrl);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy-failed");
      }
      setCopyStatus("copied");
    } catch { setCopyStatus("failed"); }
  };

  return <><div className="panel-title"><div><p className="eyebrow">AUTHORISED CIRCLE</p><h2>People with access</h2></div><button className="button button--small" type="button" onClick={() => setOpen((value) => !value)}>+ Invite someone</button></div>
    {open && <form className="invite-form" action={action}><label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{childOptions.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label><label className="field">Email address<input name="email" type="email" required /></label><label className="field">Role<select name="role" defaultValue=""><option value="" disabled>Choose a role</option><option value="senco">SENCO</option><option value="school_staff">School staff</option><option value="professional">Professional</option><option value="local_authority">Local Authority</option></select></label><fieldset><legend>Record areas</legend><p className="invite-required-context">Basic child profile is always included, so the invited person can identify the record safely.</p><button className="permission-select-all" type="button" onClick={() => setSelectedAreas(selectedAreas.length === readAreas.length ? [] : [...readAreas])}>{selectedAreas.length === readAreas.length ? "Clear all" : "Select all"}</button><div className="permission-options">{readAreas.map((area) => { const label = area === "review" ? "Reviews" : area[0].toUpperCase() + area.slice(1); return <label className="permission-chip" data-selected={selectedAreas.includes(area)} key={area}><input type="checkbox" name="read_areas" value={area} checked={selectedAreas.includes(area)} onChange={(event) => setSelectedAreas((current) => event.target.checked ? [...current, area] : current.filter((value) => value !== area))} /> <span>{label}</span></label>; })}</div><div className="permission-contribute"><span>Additional permissions</span><label className="permission-chip"><input type="checkbox" name="contribute_areas" value="documents" /> <span>Can contribute documents</span></label><label className="permission-chip"><input type="checkbox" name="contribute_areas" value="evidence" /> <span>Can contribute evidence</span></label></div></fieldset><button className="button button--small" type="submit" disabled={pending}>{pending ? "Creating…" : "Create secure invitation"}</button>{state.error && <p className="form-message form-message--error" role="alert">{state.error}</p>}</form>}
    {feedback && <p className="form-message" role="status">{feedback}</p>}
    <div className="people-list">{people.length ? people.map((person) => <article key={`${person.childId}-${person.userId}`}><span className="person-avatar"><AppIcon name={roleIcon(person.role)} size={22} /></span><div><h3>{person.name}</h3><p>{roleLabel[person.role] ?? person.role}</p></div><div><small>ACCESS</small><strong>{person.isAccessAdmin ? "Circle administrator" : person.readAreas.length ? person.readAreas.join(", ") : "No record areas"}</strong></div><div className="access-status"><i data-pending={person.status !== "active"}>{person.status}</i>{!person.isAccessAdmin && <button className="danger-link" type="button" onClick={() => { setFeedback(""); setRevokeError(""); setRemoveTarget(person); }}>Remove access</button>}</div></article>) : <p className="empty-filter">No authorised members are available to show.</p>}</div>
    {inviteUrl && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDismissedInviteUrl(inviteUrl); }}><section className="confirm-dialog invite-link-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-link-title" aria-describedby="invite-link-copy"><div className="confirm-dialog-icon invite-link-dialog-icon"><AppIcon name="send" size={22} /></div><h2 id="invite-link-title">Invitation created</h2><p id="invite-link-copy">Copy this single-use link and share it only with the person you invited.</p><code data-no-translate>{inviteUrl}</code><div className="invite-link-dialog-actions"><button ref={copyInviteButton} className="button button--small" type="button" onClick={copyInvitation}><AppIcon name="documents" size={17} />{copyStatus === "copied" ? "Link copied" : copyStatus === "failed" ? "Copy failed" : "Copy invitation link"}</button><button className="quiet-button" type="button" onClick={() => setDismissedInviteUrl(inviteUrl)}>Done</button></div></section></div>}
    {removeTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !revoking) setRemoveTarget(null); }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="revoke-access-title" aria-describedby="revoke-access-copy"><div className="confirm-dialog-icon"><AppIcon name="delete" size={22} /></div><h2 id="revoke-access-title">Remove this person&apos;s access?</h2><p id="revoke-access-copy"><strong>{removeTarget.name}</strong> will no longer be able to open this child record. You can invite them again later if needed.</p>{revokeError && <p className="form-message form-message--error" role="alert">{revokeError}</p>}<form action={confirmRevoke}><input type="hidden" name="child_id" value={removeTarget.childId} /><input type="hidden" name="user_id" value={removeTarget.userId} /><div className="confirm-dialog-actions"><button className="quiet-button" ref={cancelRemoveButton} type="button" disabled={revoking} onClick={() => setRemoveTarget(null)}>Cancel</button><button className="danger-confirm" type="submit" disabled={revoking}>{revoking ? "Removing…" : "Remove access"}</button></div></form></section></div>}
  </>;
}
