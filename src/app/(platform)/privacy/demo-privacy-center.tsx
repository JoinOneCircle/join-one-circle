"use client";

import { useState } from "react";
import Link from "next/link";
import { clearAllDemoData, recordDemoPrivacyEvent, restoreDemoRecordVersion, runDemoRetention, transitionDemoInvitation, updateDemoState, useDemoState, type DemoInvitationStatus } from "@/lib/demo-store";
import { LocalizedDate } from "@/components/localized-date";

const statusLabel: Record<DemoInvitationStatus, string> = { draft: "Draft", pending: "Pending", approved: "Approved", denied: "Denied", expired: "Expired", revoked: "Revoked" };
const transitions: Record<DemoInvitationStatus, Array<[DemoInvitationStatus, string]>> = {
  draft: [["pending", "Simulate request"], ["revoked", "Cancel"]],
  pending: [["approved", "Simulate approval"], ["denied", "Deny"], ["expired", "Expire"], ["revoked", "Revoke"]],
  approved: [["revoked", "Revoke"], ["expired", "Expire"]],
  denied: [], expired: [], revoked: [],
};

export function DemoPrivacyCenter() {
  const state = useDemoState();
  const [childFilter, setChildFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const childName = (id: string | null) => id ? state.children.find((item) => item.id === id)?.preferred_name ?? state.record_versions.find((item) => item.child_id === id)?.child.preferred_name ?? "Deleted child" : "Account";
  const events = state.audit_events.filter((item) => childFilter === "all" || item.child_id === childFilter).slice(0, 100);
  const versionChildren = new Map([...state.children.map((child) => [child.id, child.preferred_name] as const), ...state.record_versions.map((version) => [version.child_id, version.child.preferred_name] as const)]);
  const transition = (id: string, status: DemoInvitationStatus) => {
    try { transitionDemoInvitation(id, status); setMessage(`Access changed to ${statusLabel[status]}.`); setError(""); }
    catch { setError("This access change could not be saved."); }
  };
  const restore = (versionId: string) => {
    if (!window.confirm("Restore this older child record? A version of the current record will be kept for undo.")) return;
    try { restoreDemoRecordVersion(versionId); recordDemoPrivacyEvent("record_restored", "An earlier child record version was restored"); setMessage("Previous record version restored."); setError(""); }
    catch { setError("The version could not be restored."); }
  };
  const saveRetention = (value: string) => {
    const days = Number(value);
    if (days !== 30 && days !== 90 && days !== 365) return;
    updateDemoState((current) => ({ ...current, retention_days: days }));
    recordDemoPrivacyEvent("retention_changed", `History retention set to ${days} days`);
    setMessage(`History retention set to ${days} days.`);
  };
  const runRetention = () => {
    try { const result = runDemoRetention(); setMessage(`Removed ${result.removedAudit} old audit events, ${result.removedVersions} versions and ${result.removedAccess} closed access scenarios.`); setError(""); }
    catch { setError("The browser could not complete the retention cleanup."); }
  };
  const exportData = () => {
    try {
      const snapshot = { ...state, exported_at: new Date().toISOString() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "join-one-circle-local-demo-export.json"; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      recordDemoPrivacyEvent("export", "A JSON export was downloaded");
      setMessage("JSON export downloaded."); setError("");
    } catch { setError("The data could not be exported."); }
  };
  const erase = async () => {
    if (!window.confirm("Permanently erase all records and documents? This cannot be undone.")) return;
    try { await clearAllDemoData(); setMessage("Records and documents deleted."); setError(""); }
    catch { setError("Some data could not be erased. Please try again."); }
  };
  return <>
    <header className="workspace-header"><div><p className="eyebrow">PRIVACY & SECURITY</p><h1>Privacy & security center</h1><p>Review changes, manage access, restore record versions and manage data.</p></div></header>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">WHO CHANGED WHAT</p><h2>Audit timeline</h2><p>Review recent activity across the record.</p></div><label className="field">Child<select value={childFilter} onChange={(event) => setChildFilter(event.target.value)}><option value="all">All records</option>{[...versionChildren].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div><div className="record-item-list">{events.length ? events.map((event) => <article key={event.id}><div><h3>{event.detail}</h3><p>{event.category} · {childName(event.child_id)} · {event.action}</p><small><LocalizedDate value={event.at} timeStyle="short" /></small></div></article>) : <p className="empty-filter">No changes match this view yet.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">UNDO A RECORD CHANGE</p><h2>Child record versions</h2><p>Versions cover child details and record sections, not files, actions or access decisions.</p></div></div><div className="record-item-list">{state.record_versions.length ? state.record_versions.slice(0, 50).map((version) => <article key={version.id}><div><h3>{version.child.preferred_name} · {version.label}</h3><p>{version.records.length} record items at this point</p><small><LocalizedDate value={version.at} timeStyle="short" /></small></div><button className="quiet-button" type="button" onClick={() => restore(version.id)}>Restore</button></article>) : <p className="empty-filter">A previous version appears after you edit or delete a child record.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">ACCESS LIFECYCLE</p><h2>Invitation status</h2><p>Review pending, approved, revoked and expired access.</p></div><Link className="quiet-button" href="/my-circle">Invite someone</Link></div><div className="people-list">{state.invitations.length ? state.invitations.map((item) => <article key={item.id}><div><h3>{item.email}</h3><p>{item.role} · {childName(item.child_id)}</p></div><div><small>STATUS</small><strong>{statusLabel[item.status]}</strong></div><div className="task-controls">{transitions[item.status].map(([status, label]) => <button key={status} type="button" onClick={() => transition(item.id, status)}>{label}</button>)}</div></article>) : <p className="empty-filter">No access requests yet. Invite someone in My Circle.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">DATA MANAGEMENT</p><h2>Export, retention and erasure</h2><p>Manage history retention, exports and record deletion.</p></div></div><div className="settings-row"><span>History retention</span><label className="field">Keep for<select value={state.retention_days} onChange={(event) => saveRetention(event.target.value)}><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option></select></label><button className="quiet-button" type="button" onClick={runRetention}>Run cleanup now</button></div><div className="settings-row"><span>Download data</span><strong>JSON export</strong><button className="quiet-button" type="button" onClick={exportData}>Export JSON</button></div><div className="settings-row"><span>Erase records</span><strong>Deletes all records and documents</strong><button className="danger-button" type="button" onClick={erase}>Delete all data</button></div></section>
  </>;
}
