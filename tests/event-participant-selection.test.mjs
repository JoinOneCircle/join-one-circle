import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/0021_event_participant_selection.sql", import.meta.url);
const actionPath = new URL("../src/app/(platform)/calendar/actions.ts", import.meta.url);
const formPath = new URL("../src/app/(platform)/calendar/calendar-create-form.tsx", import.meta.url);

test("event participant selection is limited to current authorised circle members", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /list_child_event_participant_candidates/i);
  assert.match(sql, /membership\.status in \('active', 'limited'\)/i);
  assert.match(sql, /organisation\.verification_status = 'verified'/i);
  assert.match(sql, /public\.can_manage_child_access\(p_child_id\)/i);
  assert.match(sql, /Every selected participant must have current authorised access/i);
});

test("selected event participants are notified and revocation remains enforced", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /p_participant_ids uuid\[\] default null/i);
  assert.match(sql, /insert into public\.child_event_participants/i);
  assert.match(sql, /select selected\s+from unnest\(coalesce\(p_participant_ids/i);
  assert.match(sql, /insert into public\.notifications/i);
  assert.match(sql, /Only a circle access administrator can select other event participants/i);
});

test("calendar form posts a deduplicated participant selection to the secured RPC", async () => {
  const [actions, form] = await Promise.all([readFile(actionPath, "utf8"), readFile(formPath, "utf8")]);
  assert.match(actions, /formData\.getAll\(key\)/i);
  assert.match(actions, /p_participant_ids: participantIds/i);
  assert.match(form, /name="participant_ids"/i);
  assert.match(form, /Invite authorised participants/i);
});
