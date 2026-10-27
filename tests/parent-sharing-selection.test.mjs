import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initialParentFields } from "../src/lib/parent-sharing-selection.ts";

test("only a new parent invitation proposes the child name", () => {
  assert.deepEqual(initialParentFields(), ["preferred_name"]);
  for (const fields of [[], ["strengths"], ["needs", "year_group"], ["preferred_name", "strengths"], ["strengths", "strengths"]]) {
    const recipient = { profile_fields: [...fields] };
    const selection = initialParentFields(recipient);
    assert.deepEqual(selection, fields);
    assert.notEqual(selection, recipient.profile_fields);
    selection.push("communication");
    assert.deepEqual(recipient.profile_fields, fields);
  }
});

test("sharing editor separates child identity, preserves clear-all, and offers full-document preview", () => {
  const source = readFileSync(new URL("../src/components/pilot/sharing-editor.tsx", import.meta.url), "utf8");
  assert.match(source, /group\.fields\.filter\(field => field !== "preferred_name"\)/);
  assert.match(source, /setFields\(\[\]\); setPlans\(\[\]\); setEvents\(\[\]\)/);
  assert.match(source, /Documentos são compartilhados por inteiro/);
  assert.match(source, /Ler documento completo/);
  assert.match(source, /setPreviewPlan\(p\.id\)/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[^}]*setFields\(/);
});
