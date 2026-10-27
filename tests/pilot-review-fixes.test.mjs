import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { importProfileObjectives, readTable } from "../src/lib/pilot-table.ts";
import { pilotPdfFileName } from "../src/lib/pilot-pdf-name.ts";
import { normaliseChildSearch } from "../src/lib/child-search.ts";
import { replacePilotQuery } from "../src/lib/pilot-url.ts";

test("explicit objective import preserves evidence, deduplicates and fills blank rows", () => {
  const existing = JSON.stringify([{ column_1: "Existing goal", column_2: "Recorded evidence" }, {}]);
  const rows = readTable(importProfileObjectives("Existing goal\nNew goal\nNew goal\n\nAnother goal", "Visual support", existing));
  assert.deepEqual(rows, [{ column_1: "Existing goal", column_2: "Recorded evidence" }, { column_1: "New goal", column_4: "Visual support" }, { column_1: "Another goal", column_4: "Visual support" }]);
  assert.throws(() => importProfileObjectives("Too long", "x".repeat(2001), existing));
  const full = JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ column_1: `Goal ${i}` })));
  assert.throws(() => importProfileObjectives("Extra", "", full));
  assert.equal(readTable(full).length, 20);
});

test("PDF names identify child and version without unsafe header characters", () => {
  assert.equal(pilotPdfFileName({ title: "Plano de apoio", profile_snapshot: { preferred_name: "Lia Árvore" } }, 2), "Lia-Arvore-Plano-de-apoio-v2.pdf");
  assert.match(pilotPdfFileName({ title: '\r\n"../../', profile_snapshot: {} }, NaN), /^[a-zA-Z0-9-]+-v1\.pdf$/);
});

test("search normalises accents, case and extra whitespace", () => {
  assert.equal(normaliseChildSearch("  REVISÃO   Árvore  "), "revisao arvore");
});

test("selection URLs preserve Next history state, unrelated filters and hash", () => {
  const previous = globalThis.window;
  const state = { __NA: true, tree: ["existing"] }; let writes = 0;
  globalThis.window = { location: { href: "http://localhost/children?child=c1&tab=documents&plan=v1&filter=mine#details" }, history: { state, replaceState(nextState, unused, href) { assert.equal(nextState.__NA, undefined); assert.deepEqual(nextState.tree, state.tree); assert.equal(unused, ""); this.state = { ...nextState, __NA: true }; globalThis.window.location.href = new URL(href, "http://localhost").href; writes++; } } };
  try {
    replacePilotQuery({ plan: "v2", newDocument: null });
    assert.equal(window.location.href, "http://localhost/children?child=c1&tab=documents&plan=v2&filter=mine#details");
    replacePilotQuery({ plan: "v2" }); assert.equal(writes, 1);
    replacePilotQuery({ plan: null }); assert.ok(!new URL(window.location.href).searchParams.has("plan"));
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test("guards cover browser traversal and language changes broadcast across tabs", async () => {
  const guard = await readFile(new URL("../src/components/pilot/use-unsaved-guard.ts", import.meta.url), "utf8");
  assert.match(guard, /addEventListener\("popstate", traverse, true\)/);
  assert.match(guard, /addEventListener\("navigate", beforeTraversal\)/);
  assert.match(guard, /pushState\(currentState, "", currentUrl\)/);
  assert.match(guard, /joc-confirm-navigation/);
  assert.doesNotMatch(guard, /window\.confirm/);
  const language = await readFile(new URL("../src/components/language-preference.tsx", import.meta.url), "utf8");
  assert.match(language, /addEventListener\("storage", crossTab\)/);
  assert.match(language, /saveLanguage\(supportedLanguage\(event\.newValue\)\)/);
  assert.match(language, /localStorage\.getItem\(storageKey\) !== event\.newValue/);
});

test("URL selections do not reset global attachment filters or close the child creation dialog", async () => {
  const read = name => readFile(new URL(`../src/components/pilot/${name}.tsx`, import.meta.url), "utf8");
  const workspace = await read("school-workspace");
  assert.match(workspace, /key=\{props\.section === "children"/);
  assert.match(workspace, /const editor = urlSelection \? initialPlan \|\| null : localEditor/);
  assert.match(workspace, /const childId = urlSelection \? initialChild : localChildId/);
  const documents = await read("pupil-documents");
  assert.match(documents, /newDocument: creating \? "1" : null/);
  const parent = await read("parent-portal");
  assert.match(parent, /const child = props\.demo \|\| props\.schoolPreview \? ""/);
  for (const name of ["pupil-editor", "template-editor"]) assert.doesNotMatch(await read(name), /window\.confirm/);
});
