import assert from "node:assert/strict";
import test from "node:test";
import { demoId, initialDemoState, readDemoState, restoreDemoRecordVersion, runDemoRetention, transitionDemoInvitation, updateDemoState, writeDemoState } from "../src/lib/demo-store.ts";

function browserStorage() {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: () => true,
  };
  return values;
}

test("local demo persists multiple child records and items after reopening", () => {
  browserStorage();
  assert.equal(readDemoState().children[0].preferred_name, "Alex");
  const childId = demoId();
  updateDemoState((current) => ({ ...current, children: [...current.children, { id: childId, preferred_name: "Sam", date_of_birth: null }] }));
  updateDemoState((current) => ({ ...current, records: [...current.records, { id: demoId(), child_id: childId, record_area: "need", title: "Example need", summary: "Sample only", updated_at: new Date().toISOString() }] }));
  const reopened = readDemoState();
  assert.equal(reopened.children.find((child) => child.id === childId)?.preferred_name, "Sam");
  assert.equal(reopened.records.find((item) => item.child_id === childId)?.title, "Example need");
});

test("demo actions and invitation drafts remain distinct and local", () => {
  browserStorage();
  writeDemoState(initialDemoState);
  updateDemoState((current) => ({ ...current, actions: [{ id: "action-1", child_id: "demo-child", title: "Example next step", description: "", due_at: null, status: "open" }], invitations: [{ id: "draft-1", child_id: "demo-child", email: "sample@example.test", role: "senco", read_areas: ["evidence"], status: "draft", created_at: new Date().toISOString() }] }));
  const reopened = readDemoState();
  assert.equal(reopened.actions[0].title, "Example next step");
  assert.equal(reopened.invitations[0].status, "draft");
});

test("corrupt browser storage falls back to a safe demonstration seed", () => {
  const values = browserStorage();
  values.set("joc-local-demo-v1", "invalid JSON");
  assert.deepEqual(readDemoState(), initialDemoState);
});

test("child record changes create an audit event and a restorable prior version", () => {
  browserStorage();
  writeDemoState(initialDemoState);
  updateDemoState((current) => ({ ...current, children: current.children.map((child) => child.id === "demo-child" ? { ...child, preferred_name: "Alex Updated" } : child) }));
  const changed = readDemoState();
  assert.equal(changed.children[0].preferred_name, "Alex Updated");
  assert.equal(changed.record_versions[0].child.preferred_name, "Alex");
  assert.ok(changed.audit_events.some((event) => event.category === "child" && event.action === "updated"));
  restoreDemoRecordVersion(changed.record_versions[0].id);
  assert.equal(readDemoState().children[0].preferred_name, "Alex");
});

test("simulated access lifecycle allows approval then revocation, never real permission", () => {
  browserStorage();
  writeDemoState({ ...initialDemoState, invitations: [{ id: "invite-1", child_id: "demo-child", email: "sample@example.test", role: "senco", read_areas: ["evidence"], status: "draft", created_at: new Date().toISOString() }] });
  transitionDemoInvitation("invite-1", "pending");
  transitionDemoInvitation("invite-1", "approved");
  transitionDemoInvitation("invite-1", "revoked");
  assert.equal(readDemoState().invitations[0].status, "revoked");
  assert.throws(() => transitionDemoInvitation("invite-1", "approved"));
});

test("retention cleanup removes aged history but preserves active child records", () => {
  browserStorage();
  writeDemoState({ ...initialDemoState, retention_days: 30, audit_events: [{ id: "old-event", at: "2020-01-01T00:00:00.000Z", child_id: "demo-child", category: "record", action: "updated", detail: "Old event" }], record_versions: [{ id: "old-version", child_id: "demo-child", at: "2020-01-01T00:00:00.000Z", label: "Old", child: initialDemoState.children[0], records: [] }] });
  const result = runDemoRetention();
  assert.equal(result.removedAudit, 1);
  assert.equal(result.removedVersions, 1);
  assert.equal(readDemoState().children[0].id, "demo-child");
});
