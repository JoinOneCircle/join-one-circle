import assert from "node:assert/strict";
import test from "node:test";
import { validateSignature } from "../src/lib/pilot-signature.ts";
import { validateAnswers, validateTemplate } from "../src/lib/pilot-model.ts";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";
import { demoParentView } from "../src/lib/pilot-ux.ts";
import { signature } from "./signature-fixture.mjs";
import { addObjectivesToReview } from "../src/lib/pilot-table.ts";

test("review reuses planned objectives without duplicates or replacing existing evidence", () => {
  const objectives = JSON.stringify([{ column_1: "First objective" }, { column_1: "Second objective" }, { column_1: "First objective" }]);
  const current = JSON.stringify([{ column_1: "First objective", column_2: "Recorded evidence" }]);
  const next = addObjectivesToReview(objectives, current);
  assert.deepEqual(JSON.parse(next), [{ column_1: "First objective", column_2: "Recorded evidence" }, { column_1: "Second objective" }]);
  assert.equal(addObjectivesToReview(objectives, next), next);
});

test("signature rejects blank, excessive, nonnumeric, out of bounds and invisible drawings", () => {
  assert.deepEqual(validateSignature(signature), signature);
  for (const value of [null, {}, { version: 1, strokes: [] }, { version: 1, strokes: [[[10,10],[10,10]]] }, { version: 1, strokes: [[[0,0],[1001,0]]] }, { version: 1, strokes: [[[0,0],[1.5,3]]] }, { version: 1, strokes: [[['<svg>',2],[10,10]]] }, { version: 1, strokes: [Array(4001).fill([10,10])] }]) assert.throws(() => validateSignature(value));
});
const field = { id: "targets", label: "Objectives", type: "table", required: true, source: "", columns: [{ id: "objective", label: "Objective" }, { id: "support", label: "Support" }] };
const definition = { title: "Support cycle", sections: [{ id: "plan", title: "Plan", fields: [field] }] };
test("table definitions and answers are bounded, preserve labels and require identified rows before signing", () => {
  assert.deepEqual(validateTemplate(definition), definition);
  const filled = JSON.stringify([{ objective: "Measure progress", support: "Daily practice" }]);
  assert.equal(validateAnswers(definition, { targets: filled }, true).targets, filled);
  assert.doesNotThrow(() => validateAnswers(definition, { targets: '[{}]' }));
  for (const value of ["", "[]", "{}", '[{}]', '[{"objective":null}]', '[{"objective":"Target","private":"hidden"}]', JSON.stringify(Array(21).fill({ objective: "Target" }))]) assert.throws(() => validateAnswers(definition, { targets: value }, true));
  for (const change of [{ source: "needs" }, { columns: [] }, { columns: [field.columns[0], field.columns[0]] }, { columns: [{ id: "__proto__", label: "Unsafe" }] }]) assert.throws(() => validateTemplate({ ...definition, sections: [{ ...definition.sections[0], fields: [{ ...field, ...change }] }] }));
});
test("drawn signature is mandatory, preserved for parents, and never copied to a revised draft", async () => {
  let data = initialPilotDemo();
  data = (await changePilotDemo(data, { operation: "template", definition }, undefined, "model")).data;
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", template_id: "model" }, undefined, "plan")).data;
  data = (await changePilotDemo(data, { operation: "plan-save", id: "plan", revision: 1, answers: { targets: '[{"objective":"Recognise letters","support":"Daily reading"}]' } })).data;
  const command = { operation: "plan-sign", id: "plan", revision: 2, signer_name: "Synthetic signer", signer_role: "School", confirm: true };
  await assert.rejects(changePilotDemo(data, command), /signature/i);
  data = (await changePilotDemo(data, { ...command, signature })).data;
  const original = structuredClone(data.plans[0]);
  data = (await changePilotDemo(data, { operation: "plan-publish", id: "plan", revision: 3 })).data;
  data.recipients.push({ id: "parent", child_id: "demo-child", recipient_role: "parent", status: "active", profile_fields: [], plan_ids: ["plan"], event_ids: [] });
  assert.deepEqual(demoParentView(data, "parent")[0].plans[0].signature, signature);
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", supersedes_id: "plan" }, undefined, "revision")).data;
  assert.equal(data.plans[0].signature ?? null, null);
  assert.equal(data.plans[0].answers.targets, original.answers.targets);
  assert.equal(data.plans[1].content_hash, original.content_hash);
});
test("pilot support models include a document-centred plan, delivery and review without rewriting historical templates", () => {
  for (const id of ["isp", "apdr", "provision"]) {
    const sections = pilotCatalogue.find(t => t.id === id).definition.sections;
    for (const section of ["objectives", "cycle_delivery", "outcome_review"]) assert.ok(sections.some(s => s.id === section && s.fields.some(f => f.type === "table")));
  }
});
