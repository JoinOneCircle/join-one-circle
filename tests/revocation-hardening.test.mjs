import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/0020_harden_revoked_circle_access.sql", import.meta.url);

async function migration() {
  return readFile(migrationPath, "utf8");
}

test("revoked circle access cannot remain through event participation", async () => {
  const sql = await migration();
  assert.match(sql, /create or replace function public\.can_view_child_event/i);
  assert.match(sql, /public\.has_current_child_circle_access\(event\.child_id\)/i);
  assert.match(sql, /respond_to_child_event[\s\S]*has_current_child_circle_access\(event\.child_id\)/i);
});

test("historical document ownership and notifications require current access", async () => {
  const sql = await migration();
  assert.match(sql, /current authors or scope-authorised users can read available documents/i);
  assert.match(sql, /public\.has_current_child_circle_access\(document\.child_id\)/i);
  assert.match(sql, /users can read current own notifications/i);
  assert.match(sql, /child_id is null or public\.has_current_child_circle_access\(child_id\)/i);
});
