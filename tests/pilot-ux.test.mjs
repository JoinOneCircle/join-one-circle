import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";
import { demoParentView, hasReviewField, planReviewDate, planVersion } from "../src/lib/pilot-ux.ts";

test("a canonical review field is the only source of its calendar reminder", async () => {
  const definition = pilotCatalogue[0].definition;
  assert.equal(hasReviewField(definition), true);
  assert.equal(planReviewDate(definition, { review_on: "2027-04-01" }, "2028-01-01"), "2027-04-01");
  assert.equal(planReviewDate(definition, {}, "2028-01-01"), "");
  assert.equal(planReviewDate({ title: "No date", sections: [] }, {}, "2028-01-01"), "2028-01-01");
  let data = initialPilotDemo();
  data = (await changePilotDemo(data, { operation: "template", definition }, undefined, "template")).data;
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", template_id: "template" }, undefined, "plan")).data;
  data = (await changePilotDemo(data, { operation: "plan-save", id: "plan", revision: 1, answers: { ...data.plans[0].answers, review_on: "2027-04-01" }, review_on: "2028-01-01" })).data;
  assert.equal(data.plans[0].review_on, "2027-04-01");
});

test("parent preview is per recipient, scoped to one child and never includes source snapshots", () => {
  const data = initialPilotDemo();
  data.pupils[0].profile.strengths = "Selected strength"; data.pupils[0].profile.needs = "Private need";
  data.recipients = [
    { id: "one", child_id: "demo-child", recipient_role: "parent", status: "draft", profile_fields: ["strengths"], plan_ids: ["published", "draft", "other-child"], event_ids: ["event", "other-event"] },
    { id: "two", child_id: "demo-child", recipient_role: "parent", status: "draft", profile_fields: ["needs"], plan_ids: [], event_ids: [] },
  ];
  data.plans = ["published", "draft", "other-child"].map(id => ({ id, child_id: id === "other-child" ? "other" : "demo-child", title: id, status: id === "draft" ? "draft" : "published", profile_snapshot: { needs: "Private need" }, school_id: "private", template_snapshot: pilotCatalogue[0].definition, answers: {}, signed_by: "private-id", signer_name: "School", signer_role: "SENCO", signed_at: "2026-10-01", content_hash: "hash" }));
  data.events = [{ id: "event", child_id: "demo-child", plan_id: "unselected-private-plan", title: "Review", description: "Shared event", starts_at: "2026-10-27T09:00:00Z", status: "scheduled" }, { id: "other-event", child_id: "other" }];
  const first = demoParentView(data, "one")[0];
  assert.deepEqual(first.profile, { strengths: "Selected strength" });
  assert.deepEqual(first.plans.map(p => p.id), ["published"]); assert.deepEqual(first.events.map(e => e.id), ["event"]);
  assert.equal(first.plans[0].profile_snapshot, undefined); assert.equal(first.plans[0].signed_by, undefined);
  assert.deepEqual(Object.keys(first.events[0]).sort(), ["description", "id", "starts_at", "status", "title"]);
  assert.equal(first.events[0].plan_id, undefined);
  assert.deepEqual(demoParentView(data, "two")[0].profile, { needs: "Private need" });
  assert.deepEqual(demoParentView(data, ""), []); assert.deepEqual(demoParentView(data, "unknown"), []);
  for (const status of ["revoked", "expired"]) { data.recipients[0].status = status; assert.deepEqual(demoParentView(data, "one"), []); }
});

test("human document version numbers follow their own lineage and tolerate invalid links", () => {
  const first = { id: "a", child_id: "one", supersedes_id: null };
  const second = { id: "b", child_id: "one", supersedes_id: "a" };
  const third = { id: "c", child_id: "one", supersedes_id: "b" };
  assert.equal(planVersion(third, [first, second, third]), 3);
  assert.equal(planVersion({ ...third, child_id: "other" }, [first, second]), 1);
  assert.equal(planVersion({ ...first, supersedes_id: "a" }, [first]), 1);
});

test("renewal replaces only a pending recipient and never resurrects revoked access", async () => {
  let data = initialPilotDemo();
  data.recipients.push({ id: "old", child_id: "demo-child", recipient_role: "parent", status: "pending", recipient_label: "parent@example.test", profile_fields: ["needs"], plan_ids: [], event_ids: [] });
  const command = { operation: "renew-invite", id: "old", contact_name: "Example Parent", relationship: "Guardian", profile_fields: ["preferred_name"], plan_ids: [], event_ids: [] };
  data = (await changePilotDemo(data, command, undefined, "new")).data;
  assert.equal(data.recipients[0].status, "revoked"); assert.equal(data.recipients[1].recipient_label, "parent@example.test"); assert.deepEqual(data.recipients[1].profile_fields, ["preferred_name"]);
  await assert.rejects(changePilotDemo(data, command), /unavailable/i);
});

test("school navigation does not silently select the first child and parent screens have no write/download controls", () => {
  const school = readFileSync(new URL("../src/components/pilot/school-workspace.tsx", import.meta.url), "utf8");
  const parent = readFileSync(new URL("../src/components/pilot/parent-portal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(school, /pupils\[0\]/); assert.doesNotMatch(school, /PupilJourney/);
  assert.match(school, /children\?new=1/);
  assert.doesNotMatch(parent, /operation:|\/pdf|download=|window\.print|profile_snapshot/);
  assert.match(parent, /demoParentView\(state, recipientId\)/);
});
