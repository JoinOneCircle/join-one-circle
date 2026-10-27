import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEMO_WORKSPACE_COOKIE, resolveDemoWorkspace } from "../src/lib/demo-workspace.ts";

test("fresh and legacy previews start in the rebuilt school workspace", () => {
  assert.notEqual(DEMO_WORKSPACE_COOKIE, "joc_demo_role");
  for (const value of [undefined, null, "", "school", "unknown", "administrator"]) {
    assert.equal(resolveDemoWorkspace(value), "school");
  }
  const legacyCookies = { joc_demo_role: "family" };
  assert.equal(resolveDemoWorkspace(legacyCookies[DEMO_WORKSPACE_COOKIE]), "school");
});

test("explicitly choosing another demo role still works", () => {
  for (const role of ["family", "school", "professional", "local_authority"]) {
    assert.equal(resolveDemoWorkspace(role), role);
  }
});

test("the demo preference is read only inside isolated local demo mode", () => {
  const source = readFileSync(new URL("../src/lib/platform-data.ts", import.meta.url), "utf8");
  const guard = source.indexOf("if (!isSupabaseConfigured && isLocalDemoMode)");
  const preference = source.indexOf("resolveDemoWorkspace((await cookies())");
  const production = source.indexOf("if (!isSupabaseConfigured) redirect");
  assert.ok(guard >= 0 && preference > guard && production > preference);
  assert.equal(source.slice(production).includes("DEMO_WORKSPACE_COOKIE"), false);
});
