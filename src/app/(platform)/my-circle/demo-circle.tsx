"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { demoId, updateDemoState, useDemoState } from "@/lib/demo-store";

const allowedRoles = new Set(["senco", "school_staff", "professional", "local_authority"]);
const areaLabels: Record<string, string> = { documents: "Documents", evidence: "Evidence", review: "Reviews", action: "Actions" };

export function DemoCircle() {
  const state = useDemoState();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editAreas, setEditAreas] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null);
  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const childId = String(data.get("child_id") ?? "");
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const role = String(data.get("role") ?? "");
    const readAreas = data.getAll("read_areas").map(String).filter((area) => area in areaLabels);
    if (!state.children.some((child) => child.id === childId) || !email.includes("@") || !allowedRoles.has(role) || !readAreas.length) { setError("Choose a child, email, role and at least one record area."); return; }
    try {
      updateDemoState((current) => ({ ...current, invitations: [{ id: demoId(), child_id: childId, email, role, read_areas: readAreas, status: "draft", created_at: new Date().toISOString() }, ...current.invitations] }));
      form.reset(); setSelectedAreas([]); setError(""); setMessage("Invitation saved.");
    } catch { setError("The invitation could not be saved. Please try again."); }
  };
  const beginEdit = (id: string, role: string, areas: string[]) => { setEditingId(id); setEditRole(role); setEditAreas(areas); };
  const saveEdit = () => {
    if (!editingId || !editAreas.length) { setError("Choose at least one record area."); return; }
    updateDemoState((current) => ({ ...current, invitations: current.invitations.map((item) => item.id === editingId ? { ...item, role: editRole, read_areas: editAreas } : item) }));
    setEditingId(null); setError(""); setMessage("Access updated.");
  };
  const remove = () => {
    if (!removeTarget) return;
    updateDemoState((current) => ({ ...current, invitations: current.invitations.filter((item) => item.id !== removeTarget.id) }));
    setRemoveTarget(null);
    setMessage("Invitation removed.");
  };
  const childName = (id: string) => state.children.find((child) => child.id === id)?.preferred_name ?? "Removed child";
  return <>
    <header className="workspace-header"><div><p className="eyebrow">MY CIRCLE</p><h1>My Circle</h1><p>Bring together the people supporting the child.</p></div></header>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">INVITE SOMEONE</p><h2>Invite someone to help</h2></div></div><form className="invite-form" onSubmit={saveDraft}><label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{state.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label><label className="field">Email address<input name="email" type="email" required /></label><label className="field">Role<select name="role" required defaultValue=""><option value="" disabled>Choose a role</option><option value="senco">SENCO</option><option value="school_staff">School staff</option><option value="professional">Professional</option><option value="local_authority">Local Authority</option></select></label><fieldset><legend>Choose what they can see</legend><button className="permission-select-all" type="button" onClick={() => setSelectedAreas(selectedAreas.length === Object.keys(areaLabels).length ? [] : Object.keys(areaLabels))}>{selectedAreas.length === Object.keys(areaLabels).length ? "Clear all" : "Select all"}</button><div className="permission-options">{Object.entries(areaLabels).map(([area, label]) => <label className="permission-chip" data-selected={selectedAreas.includes(area)} key={area}><input type="checkbox" name="read_areas" value={area} checked={selectedAreas.includes(area)} onChange={(event) => setSelectedAreas((current) => event.target.checked ? [...current, area] : current.filter((value) => value !== area))} /> <span>{label}</span></label>)}</div></fieldset><button className="button button--small" type="submit" disabled={!state.children.length}>Save invitation</button></form></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">YOUR CIRCLE</p><h2>People with access</h2></div><Link className="quiet-button" href="/privacy">Review access</Link></div><div className="people-list">{state.invitations.length ? state.invitations.map((item) => <article className="access-card" key={item.id}><div className="access-card-main"><div className="access-person"><span className="person-avatar" aria-hidden="true">{item.email.slice(0, 1).toUpperCase()}</span><div><h3>{item.email}</h3><p><b>Child</b>{childName(item.child_id)}</p><p><b>Role</b>{item.role}</p></div></div><div className="access-permissions"><small>CAN SEE</small><div>{item.read_areas.map((area) => <span key={area}>{areaLabels[area]}</span>)}</div></div><div className="access-status"><i data-pending>{item.status === "draft" ? "Pending" : item.status}</i><small>Invitation status</small></div><div className="access-actions"><button className="quiet-button" type="button" onClick={() => beginEdit(item.id, item.role, item.read_areas)}>Edit access</button><button className="danger-link" type="button" onClick={() => setRemoveTarget({ id: item.id, email: item.email })}>Remove</button></div></div>{editingId === item.id && <div className="access-edit"><label className="field">Role<select value={editRole} onChange={(event) => setEditRole(event.target.value)}><option value="senco">SENCO</option><option value="school_staff">School staff</option><option value="professional">Professional</option><option value="local_authority">Local Authority</option></select></label><div><small className="access-edit-label">Can see</small><div className="permission-options">{Object.entries(areaLabels).map(([area, label]) => <label className="permission-chip" data-selected={editAreas.includes(area)} key={area}><input type="checkbox" checked={editAreas.includes(area)} onChange={(event) => setEditAreas((current) => event.target.checked ? [...current, area] : current.filter((value) => value !== area))} /> <span>{label}</span></label>)}</div></div><div className="access-edit-actions"><button className="button button--small" type="button" onClick={saveEdit}>Save changes</button><button className="quiet-button" type="button" onClick={() => setEditingId(null)}>Cancel</button></div></div>}</article>) : <p className="empty-filter">No invitations yet.</p>}</div></section>
    {removeTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemoveTarget(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-person-title" aria-describedby="remove-person-copy"><div className="confirm-dialog-icon">!</div><h2 id="remove-person-title">Remove this access?</h2><p id="remove-person-copy"><strong>{removeTarget.email}</strong> will no longer be able to access this child record.</p><div className="confirm-dialog-actions"><button className="quiet-button" type="button" onClick={() => setRemoveTarget(null)}>Cancel</button><button className="danger-confirm" type="button" onClick={remove}>Remove access</button></div></section></div>}
    {!state.children.length && <p className="empty-filter"><Link href="/children">Add a child</Link> to invite someone.</p>}
  </>;
}
