import assert from "node:assert/strict";
import test from "node:test";
import { signature } from "./signature-fixture.mjs";
import { readFileSync } from "node:fs";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";
import { emptyProfile } from "../src/lib/pilot-model.ts";
import { documentPreparation, demoParentView } from "../src/lib/pilot-ux.ts";

const definition = { title: "Individual support record", sections: [{ id: "support", title: "Support", fields: [
  { id: "name", label: "Child", type: "text", source: "preferred_name", required: true },
  { id: "needs", label: "Needs", type: "textarea", source: "needs", required: false },
  { id: "school", label: "School", type: "text", source: "school_name", required: false },
  { id: "author", label: "Author", type: "text", source: "author", required: false },
  { id: "date", label: "Date", type: "date", source: "today", required: false },
  { id: "observations", label: "Observations", type: "textarea", source: "", required: true },
] }] };

test("document preparation reports available, missing linked and school-completed fields without mutation", () => {
  const profile = { ...emptyProfile(), preferred_name: "Child A" };
  const before = structuredClone({ definition, profile });
  const prep = documentPreparation(definition, profile, "Test school");
  assert.equal(prep.ready, 4); assert.equal(prep.manual, 2); assert.equal(prep.missing, 1);
  assert.equal(prep.fields.find(f => f.id === "name").value, "Child A");
  assert.equal(prep.fields.find(f => f.id === "observations").ready, false);
  assert.deepEqual({ definition, profile }, before);
});

test("one reusable template creates independent child documents, which can be completed, signed and published without implicit sharing", async () => {
  let data = initialPilotDemo();
  data.pupils[0].profile.needs = "Record information";
  data = (await changePilotDemo(data, { operation: "pupil", profile: { ...emptyProfile(), preferred_name: "Other child", needs: "Other need" } }, undefined, "other-child")).data;
  data = (await changePilotDemo(data, { operation: "template", definition }, undefined, "model")).data;
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", template_id: "model" }, "2026-10-20T12:00:00Z", "document")).data;
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "other-child", template_id: "model" }, "2026-10-20T12:00:00Z", "other-document")).data;
  const otherBefore = structuredClone(data.plans.find(p => p.id === "other-document"));
  const plan = data.plans.find(p => p.id === "document");
  assert.equal(plan.answers.name, "Alex"); assert.equal(plan.answers.needs, "Record information");
  await assert.rejects(changePilotDemo(data, { operation: "plan-sign", id: plan.id, revision: 1, signer_name: "Test school", signer_role: "SENCO", confirm: true, signature }), /Observations/);
  data = (await changePilotDemo(data, { operation: "plan-save", id: plan.id, revision: 1, answers: { ...plan.answers, observations: "School completed this individual form" } })).data;
  data = (await changePilotDemo(data, { operation: "plan-sign", id: plan.id, revision: 2, signer_name: "Test school", signer_role: "SENCO", confirm: true, signature })).data;
  data = (await changePilotDemo(data, { operation: "plan-publish", id: plan.id, revision: 3 })).data;
  const published = structuredClone(data.plans.find(p => p.id === plan.id));
  assert.equal(published.status, "published"); assert.equal(data.recipients.length, 0);
  assert.deepEqual(data.templates[0].definition, definition);
  assert.deepEqual(data.plans.find(p => p.id === "other-document"), otherBefore);
  data = (await changePilotDemo(data, { operation: "pupil", id: "demo-child", revision: 1, profile: { ...data.pupils[0].profile, needs: "New record information" } })).data;
  data = (await changePilotDemo(data, { operation: "template", id: "model", revision: 1, definition: { ...definition, title: "Updated template" } })).data;
  assert.deepEqual(data.plans.find(p => p.id === plan.id), published);
  await assert.rejects(changePilotDemo(data, { operation: "plan-save", id: plan.id, revision: 4, answers: {} }), /cannot be edited/);
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", template_id: "model" }, undefined, "next-document")).data;
  assert.equal(data.plans.find(p => p.id === "next-document").answers.needs, "New record information");
  data.recipients.push({ id: "parent", child_id: "demo-child", recipient_role: "parent", status: "active", profile_fields: [], plan_ids: [], event_ids: [] });
  assert.equal(demoParentView(data, "parent")[0].plans.length, 0);
  data.recipients[0].plan_ids = [plan.id, "other-document", "next-document"];
  assert.deepEqual(demoParentView(data, "parent")[0].plans.map(p => p.id), [plan.id]);
});

test("child record keeps document creation and editing in context and the library offers save-and-use", () => {
  const source = name => readFileSync(new URL(`../src/components/pilot/${name}.tsx`, import.meta.url), "utf8");
  assert.match(source("pupil-record"), /PupilDocuments/);
  assert.doesNotMatch(source("pupil-record"), /href=\{`\/learning-plans/);
  assert.match(source("pupil-documents"), /fixedChild/);
  assert.match(source("pupil-documents"), /p\.child_id === childId/);
  assert.match(source("pupil-documents"), /<PlanEditor/);
  assert.match(source("plan-create-dialog"), /operation: "plan-create"/);
  assert.match(source("template-editor"), /Save & create document/);
  assert.match(source("template-editor"), /open=\{openOnMount\}/);
  assert.doesNotMatch(source("pupil-record"), /window\.confirm/);
  assert.match(source("pupil-record"), /pendingLeave/);
  assert.match(source("plan-editor"), /plan-publish-title/);
});
