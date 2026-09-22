"use client";

import { useSyncExternalStore } from "react";

// A local demonstration, never a substitute for authenticated Supabase records.
// Do not enter real children's information in this browser-only workspace.
const storageKey = "joc-local-demo-v1";
const eventName = "joc-local-demo-change";

export type DemoChild = { id: string; preferred_name: string; date_of_birth: string | null };
export type DemoRecordItem = { id: string; child_id: string; record_area: string; title: string; summary: string; updated_at: string; occurred_on?: string | null; file_id?: string; file_name?: string; mime_type?: string };
export type DemoAction = { id: string; child_id: string; title: string; description: string; due_at: string | null; status: "open" | "waiting" | "complete" };
export type DemoDocument = { id: string; child_id: string; title: string; category: string; access_scope: string; mime_type: string; file_name: string; created_at: string };
export type DemoInvitationStatus = "draft" | "pending" | "approved" | "denied" | "expired" | "revoked";
export type DemoInvitation = { id: string; child_id: string; email: string; role: string; read_areas: string[]; status: DemoInvitationStatus; created_at: string };
export type DemoAuditEvent = { id: string; at: string; child_id: string | null; category: "child" | "record" | "action" | "document" | "access" | "profile" | "privacy"; action: string; detail: string };
export type DemoRecordVersion = { id: string; child_id: string; at: string; label: string; child: DemoChild; records: DemoRecordItem[] };
export type DemoState = { version: 1; profile_name: string; children: DemoChild[]; records: DemoRecordItem[]; actions: DemoAction[]; documents: DemoDocument[]; invitations: DemoInvitation[]; audit_events: DemoAuditEvent[]; record_versions: DemoRecordVersion[]; retention_days: 30 | 90 | 365 };

export const initialDemoState: DemoState = {
  version: 1,
  profile_name: "Account",
  children: [{ id: "demo-child", preferred_name: "Alex", date_of_birth: null }],
  records: [
    { id: "demo-passport", child_id: "demo-child", record_area: "passport", title: "About Alex", summary: "Example child record for the local demonstration.", updated_at: "2026-09-01T12:00:00.000Z" },
    { id: "demo-need", child_id: "demo-child", record_area: "need", title: "Communication and transition support", summary: "An example of a need shared with the authorised circle.", updated_at: "2026-09-01T12:00:00.000Z" },
  ],
  actions: [],
  documents: [],
  invitations: [],
  audit_events: [],
  record_versions: [],
  retention_days: 90,
};

let snapshotRaw: string | null = null;
let snapshotState: DemoState = initialDemoState;

const safeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export function readDemoState(): DemoState {
  if (typeof window === "undefined") return initialDemoState;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return initialDemoState;
    const parsed = JSON.parse(value) as Partial<DemoState>;
    if (parsed.version !== 1) return initialDemoState;
    return {
      version: 1,
      profile_name: parsed.profile_name === "Demo account" ? "Account" : typeof parsed.profile_name === "string" ? parsed.profile_name : initialDemoState.profile_name,
      children: safeArray<DemoChild>(parsed.children),
      records: safeArray<DemoRecordItem>(parsed.records),
      actions: safeArray<DemoAction>(parsed.actions),
      documents: safeArray<DemoDocument>(parsed.documents),
      invitations: safeArray<DemoInvitation>(parsed.invitations),
      audit_events: safeArray<DemoAuditEvent>(parsed.audit_events),
      record_versions: safeArray<DemoRecordVersion>(parsed.record_versions),
      retention_days: parsed.retention_days === 30 || parsed.retention_days === 365 ? parsed.retention_days : 90,
    };
  } catch { return initialDemoState; }
}

export function writeDemoState(next: DemoState) {
  const raw = JSON.stringify(next);
  snapshotRaw = raw;
  snapshotState = next;
  window.localStorage.setItem(storageKey, raw);
  window.dispatchEvent(new Event(eventName));
}

export function updateDemoState(change: (current: DemoState) => DemoState) {
  const current = readDemoState();
  const next = change(current);
  const at = new Date().toISOString();
  const events: DemoAuditEvent[] = [];
  const versions: DemoRecordVersion[] = [];
  const event = (category: DemoAuditEvent["category"], action: string, detail: string, childId: string | null = null) => events.push({ id: demoId(), at, child_id: childId, category, action, detail });
  const changed = <T extends { id: string }>(before: T[], after: T[], category: DemoAuditEvent["category"], describe: (item: T) => string, getChild: (item: T) => string | null = () => null) => {
    const oldItems = new Map(before.map((item) => [item.id, item]));
    const newItems = new Map(after.map((item) => [item.id, item]));
    for (const id of new Set([...oldItems.keys(), ...newItems.keys()])) {
      const oldItem = oldItems.get(id); const newItem = newItems.get(id);
      if (JSON.stringify(oldItem) === JSON.stringify(newItem)) continue;
      const action = !oldItem ? "created" : !newItem ? "deleted" : "updated";
      const item = newItem ?? oldItem!;
      event(category, action, `${describe(item)} ${action}`, getChild(item));
    }
  };
  changed(current.children, next.children, "child", (item) => `Child record ${item.preferred_name}`, (item) => item.id);
  changed(current.records, next.records, "record", (item) => `${item.record_area}: ${item.title}`, (item) => item.child_id);
  changed(current.actions, next.actions, "action", (item) => `Action ${item.title}`, (item) => item.child_id);
  changed(current.documents, next.documents, "document", (item) => `Document ${item.title}`, (item) => item.child_id);
  changed(current.invitations, next.invitations, "access", (item) => `Access scenario ${item.role} (${item.status})`, (item) => item.child_id);
  if (current.profile_name !== next.profile_name) event("profile", "updated", "Local demo profile updated");
  const recordChildIds = new Set([...current.children.map((item) => item.id), ...next.children.map((item) => item.id)]);
  for (const childId of recordChildIds) {
    const oldChild = current.children.find((item) => item.id === childId);
    if (!oldChild) continue;
    const newChild = next.children.find((item) => item.id === childId);
    const oldRecords = current.records.filter((item) => item.child_id === childId);
    const newRecords = next.records.filter((item) => item.child_id === childId);
    if (JSON.stringify(oldChild) !== JSON.stringify(newChild) || JSON.stringify(oldRecords) !== JSON.stringify(newRecords)) {
      versions.push({ id: demoId(), child_id: childId, at, label: newChild ? "Before record change" : "Before child deletion", child: oldChild, records: oldRecords });
    }
  }
  const saved: DemoState = { ...next, audit_events: [...events, ...next.audit_events].slice(0, 300), record_versions: [...versions, ...next.record_versions].slice(0, 100) };
  writeDemoState(saved);
  return saved;
}

export function restoreDemoRecordVersion(versionId: string) {
  const version = readDemoState().record_versions.find((item) => item.id === versionId);
  if (!version) throw new Error("Version not found");
  return updateDemoState((current) => ({
    ...current,
    children: current.children.some((item) => item.id === version.child_id)
      ? current.children.map((item) => item.id === version.child_id ? version.child : item)
      : [...current.children, version.child],
    records: [...current.records.filter((item) => item.child_id !== version.child_id), ...version.records],
  }));
}

export function recordDemoPrivacyEvent(action: string, detail: string) {
  const current = readDemoState();
  const event: DemoAuditEvent = { id: demoId(), at: new Date().toISOString(), child_id: null, category: "privacy", action, detail };
  writeDemoState({ ...current, audit_events: [event, ...current.audit_events].slice(0, 300) });
}

const accessTransitions: Record<DemoInvitationStatus, DemoInvitationStatus[]> = {
  draft: ["pending", "revoked"],
  pending: ["approved", "denied", "expired", "revoked"],
  approved: ["revoked", "expired"],
  denied: [], expired: [], revoked: [],
};

export function transitionDemoInvitation(id: string, nextStatus: DemoInvitationStatus) {
  const invitation = readDemoState().invitations.find((item) => item.id === id);
  if (!invitation || !accessTransitions[invitation.status].includes(nextStatus)) throw new Error("Invalid local access transition");
  return updateDemoState((current) => ({ ...current, invitations: current.invitations.map((item) => item.id === id ? { ...item, status: nextStatus } : item) }));
}

export function runDemoRetention() {
  const current = readDemoState();
  const cutoff = Date.now() - current.retention_days * 24 * 60 * 60 * 1000;
  const olderThanCutoff = (value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) < cutoff;
  const expiredAccess = current.invitations.filter((item) => ["denied", "expired", "revoked"].includes(item.status) && olderThanCutoff(item.created_at));
  const removedAudit = current.audit_events.filter((item) => olderThanCutoff(item.at)).length;
  const removedVersions = current.record_versions.filter((item) => olderThanCutoff(item.at)).length;
  writeDemoState({
    ...current,
    invitations: current.invitations.filter((item) => !expiredAccess.some((expired) => expired.id === item.id)),
    audit_events: current.audit_events.filter((item) => !olderThanCutoff(item.at)),
    record_versions: current.record_versions.filter((item) => !olderThanCutoff(item.at)),
  });
  recordDemoPrivacyEvent("retention_run", `Removed ${removedAudit} audit events, ${removedVersions} old versions and ${expiredAccess.length} closed access scenarios`);
  return { removedAudit, removedVersions, removedAccess: expiredAccess.length };
}

export function useDemoState() {
  const subscribe = (onStoreChange: () => void) => {
    window.addEventListener(eventName, onStoreChange);
    window.addEventListener("storage", onStoreChange);
    return () => { window.removeEventListener(eventName, onStoreChange); window.removeEventListener("storage", onStoreChange); };
  };
  const getSnapshot = () => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === snapshotRaw) return snapshotState;
    snapshotRaw = raw;
    snapshotState = readDemoState();
    return snapshotState;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => initialDemoState);
}

export function demoId() { return `demo-${crypto.randomUUID()}`; }

const databaseName = "joc-local-demo-files-v1";
const objectStoreName = "files";
function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(objectStoreName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function fileOperation<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const database = await openFileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, mode);
    const request = operation(transaction.objectStore(objectStoreName));
    transaction.oncomplete = () => { database.close(); resolve(request.result as T); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export function saveDemoFile(id: string, file: File): Promise<void> {
  return fileOperation<void>("readwrite", (store) => store.put(file, id));
}

export function loadDemoFile(id: string): Promise<Blob | undefined> {
  return fileOperation<Blob | undefined>("readonly", (store) => store.get(id));
}

export function removeDemoFile(id: string): Promise<void> {
  return fileOperation<void>("readwrite", (store) => store.delete(id));
}

export async function clearAllDemoData() {
  await fileOperation<void>("readwrite", (store) => store.clear());
  writeDemoState({ ...initialDemoState, children: [], records: [], actions: [], documents: [], invitations: [], audit_events: [], record_versions: [] });
}
