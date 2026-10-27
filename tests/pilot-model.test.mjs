import assert from "node:assert/strict";
import test from "node:test";
import { signature } from "./signature-fixture.mjs";
import { emptyProfile, parentProjection, schoolDateTimeToIso, validateProfile, validateTemplate } from "../src/lib/pilot-model.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";

test("all 20 original model definitions validate with unique field identifiers", () => {
  assert.equal(pilotCatalogue.length, 20);
  assert.equal(new Set(pilotCatalogue.map((t) => t.id)).size, 20);
  for (const t of pilotCatalogue) assert.doesNotThrow(() => validateTemplate(t.definition));
});
test("profile sharing is an explicit whitelist, never all properties", () => {
  const profile = { ...emptyProfile(), preferred_name: "Example", needs: "Private", strengths: "Shared", internal: "Never" };
  assert.deepEqual(parentProjection(profile, []), {});
  assert.deepEqual(parentProjection(profile, ["strengths", "internal"]), { strengths: "Shared" });
  assert.throws(() => validateProfile({ ...emptyProfile(), preferred_name: "" }));
  assert.throws(() => validateProfile({ ...profile, date_of_birth: "2026-02-30" }));
});
test("London calendar inputs handle summer, winter and nonexistent DST times", () => {
  assert.equal(schoolDateTimeToIso("2026-07-01T09:00"), "2026-07-01T08:00:00.000Z");
  assert.equal(schoolDateTimeToIso("2026-12-01T09:00"), "2026-12-01T09:00:00.000Z");
  assert.throws(() => schoolDateTimeToIso("2026-03-29T01:30"));
  assert.throws(() => schoolDateTimeToIso("2026-02-30T09:00"));
});
test("local preview preserves snapshots and requires a new signed version", async () => {
  let state = initialPilotDemo();
  state = (await changePilotDemo(state, { operation: "template", definition: pilotCatalogue[0].definition }, "2026-10-20T12:00:00Z", "template")).data;
  state = (await changePilotDemo(state, { operation: "plan-create", child_id: "demo-child", template_id: "template" }, "2026-10-20T12:00:00Z", "plan")).data;
  assert.equal(state.plans[0].answers.preferred_name, "Alex");
  state = (await changePilotDemo(state, { operation: "plan-sign", id: "plan", revision: 1, signer_name: "Synthetic Signer", signer_role: "School", confirm: true, signature })).data;
  const signed = structuredClone(state.plans[0]);
  await assert.rejects(changePilotDemo(state, { operation: "plan-save", id: "plan", revision: 2, answers: {} }), /cannot be edited/);
  state = (await changePilotDemo(state, { operation: "pupil", id: "demo-child", revision: 1, profile: { ...state.pupils[0].profile, preferred_name: "New example name" } })).data;
  assert.deepEqual(state.plans[0], signed);
  state = (await changePilotDemo(state, { operation: "plan-create", child_id: "demo-child", supersedes_id: "plan" }, "2026-10-20T12:00:00Z", "new-plan")).data;
  assert.equal(state.plans[0].answers.preferred_name, "New example name"); assert.deepEqual(state.plans[1], signed);
  await assert.rejects(changePilotDemo(state, { operation: "plan-publish", id: "new-plan", revision: 1 }), /Sign before/);
});

test("guided child creation stays private and each parent keeps independent contact and selections", async () => {
  let state = initialPilotDemo();
  state = (await changePilotDemo(state, { operation: "pupil", profile: { ...emptyProfile(), preferred_name: "Wizard synthetic" } }, undefined, "wizard-child")).data;
  assert.equal(state.recipients.length, 0);
  for (const [id, name, email, fields] of [["parent-a", "Parent One", "one@example.test", ["preferred_name", "strengths"]], ["parent-b", "Parent Two", "two@example.test", ["preferred_name"]]]) {
    state = (await changePilotDemo(state, { operation: "invite", child_id: "wizard-child", email, role: "parent", contact_name: name, relationship: "Guardian", profile_fields: fields, plan_ids: [], event_ids: [] }, undefined, id)).data;
  }
  const secondBefore = structuredClone(state.recipients[1]);
  state = (await changePilotDemo(state, { operation: "sharing", id: "parent-a", contact_name: "Parent One Updated", relationship: "Mother", profile_fields: [], plan_ids: [], event_ids: [] })).data;
  assert.deepEqual(state.recipients[1], secondBefore);
  assert.equal(state.recipients[0].contact_name, "Parent One Updated");
  assert.equal(state.recipients[0].recipient_label, "one@example.test");
  assert.equal(state.recipients.every((r) => r.status === "draft"), true);
});
