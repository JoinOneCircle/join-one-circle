import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterChildOptions, normaliseChildSearch } from "../src/lib/child-search.ts";

const options = [
  { value: "one", label: "João Luís", description: "Year 4 · Turma A" },
  { value: "two", label: "María José", description: "Year 3 · Turma B" },
  { value: "three", label: "João Silva", description: "Year 3 · Turma A" },
];
test("child search ignores case, accents, surrounding and repeated whitespace", () => {
  assert.equal(normaliseChildSearch("  JOÃO  "), "joao");
  assert.deepEqual(filterChildOptions(options,"  jOaO   luis  ").map(x=>x.value),["one"]);
  assert.deepEqual(filterChildOptions(options,"maria jose").map(x=>x.value),["two"]);
  assert.deepEqual(filterChildOptions(options,"joao 3").map(x=>x.value),["three"]);
});
test("search retains supplied IDs and order, never mutates or expands authorised options", () => {
  const before=structuredClone(options);
  assert.deepEqual(filterChildOptions(options,""),options);
  assert.deepEqual(filterChildOptions(options,"JOÃO").map(x=>x.value),["one","three"]);
  assert.deepEqual(filterChildOptions(options,"unknown"),[]);
  assert.deepEqual(filterChildOptions([],"João"),[]);
  assert.deepEqual(options,before);
});
test("picker keeps native named form values, required checks, reset and accessible keyboard search", () => {
  const source=readFileSync(new URL("../src/components/child-picker.tsx",import.meta.url),"utf8");
  assert.match(source,/name=\{name\}/); assert.match(source,/required=\{required\}/);
  assert.match(source,/addEventListener\("reset"/); assert.match(source,/onInvalid=/);
  for(const key of ["ArrowDown","ArrowUp","Enter","Escape","Tab"]) assert.ok(source.includes(`"${key}"`));
  for(const role of ["combobox","listbox","option"]) assert.ok(source.includes(`role="${role}"`));
  assert.match(source,/aria-activedescendant=/); assert.match(source,/aria-selected=/);
  assert.doesNotMatch(source,/fetch\(|supabase|localStorage|sessionStorage/);
});
