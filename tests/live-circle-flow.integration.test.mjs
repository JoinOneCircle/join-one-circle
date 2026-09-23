/**
 * A real Supabase/RLS smoke test for the child-circle lifecycle.
 *
 * It deliberately does not run as part of `npm test`: it creates two Auth
 * users and a child record, so it is safe only in a disposable local or
 * dedicated Supabase test project. It does not use a mocked database.
 *
 * Required environment variables:
 *   JOC_RUN_LIVE_INTEGRATION=1
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY=...
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=...
 *
 * Remote projects additionally require JOC_ALLOW_REMOTE_TESTS=1. This is an
 * intentional second confirmation because the service key creates/deletes
 * test accounts and records.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.JOC_RUN_LIVE_INTEGRATION === "1";
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

function fail(error, context) {
  assert.ifError(error && new Error(`${context}: ${error.message}`));
}

function required(value, name) {
  assert.ok(value, `${name} must be set when JOC_RUN_LIVE_INTEGRATION=1`);
  return value;
}

function assertTestTarget(target) {
  const parsed = new URL(target);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  assert.ok(
    isLocal || process.env.JOC_ALLOW_REMOTE_TESTS === "1",
    "Refusing to mutate a remote Supabase project. Use a dedicated test project and set JOC_ALLOW_REMOTE_TESTS=1 explicitly.",
  );
}

async function signIn(email, password) {
  const client = createClient(required(url, "SUPABASE_TEST_URL"), required(anonKey, "SUPABASE_TEST_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  fail(error, `sign in ${email}`);
  return client;
}

async function createConfirmedUser(admin, email, password, displayName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  fail(error, `create test user ${email}`);
  assert.ok(data.user?.id, "Supabase did not return the new test user's ID");
  return data.user.id;
}

test("live parent → invite → accept → scoped document confirmation lifecycle", { skip: !enabled }, async (t) => {
  const target = required(url, "SUPABASE_TEST_URL");
  assertTestTarget(target);
  const admin = createClient(target, required(serviceRoleKey, "SUPABASE_TEST_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID();
  const parentEmail = `joc-qa-parent-${suffix}@example.test`;
  const inviteeEmail = `joc-qa-professional-${suffix}@example.test`;
  const password = `JocQa!${randomUUID()}`;
  const ids = { parent: null, invitee: null, child: null, organisation: null, document: null, storagePath: null };

  t.after(async () => {
    // Cleanup is intentionally service-role-only and limited to IDs created
    // in this test. Storage needs an explicit deletion before DB cascades.
    if (ids.storagePath) await admin.storage.from("child-documents").remove([ids.storagePath]);
    if (ids.child) await admin.from("children").delete().eq("id", ids.child);
    if (ids.organisation) await admin.from("organisations").delete().eq("id", ids.organisation);
    if (ids.parent) await admin.auth.admin.deleteUser(ids.parent);
    if (ids.invitee) await admin.auth.admin.deleteUser(ids.invitee);
  });

  ids.parent = await createConfirmedUser(admin, parentEmail, password, "QA Parent");
  ids.invitee = await createConfirmedUser(admin, inviteeEmail, password, "QA Professional");
  const parent = await signIn(parentEmail, password);
  const invitee = await signIn(inviteeEmail, password);

  const { data: childId, error: circleError } = await parent.rpc("create_family_circle", {
    p_display_name: "QA Parent",
    p_child_name: "QA Child",
    p_child_dob: null,
    p_relationship: "parent",
    p_summary: "Integration test only",
    p_language: "en",
  });
  fail(circleError, "create family circle");
  assert.ok(childId, "create_family_circle did not return a child ID");
  ids.child = childId;

  const { data: child, error: childLookupError } = await admin
    .from("children")
    .select("owning_organisation_id")
    .eq("id", childId)
    .single();
  fail(childLookupError, "look up QA child organisation");
  ids.organisation = child.owning_organisation_id;

  const { data: invitation, error: invitationError } = await parent.rpc("create_child_invitation", {
    p_child_id: childId,
    p_email: inviteeEmail,
    p_role: "professional",
    p_read_areas: ["passport", "documents"],
    p_contribute_areas: [],
  });
  fail(invitationError, "create child invitation");
  const token = invitation?.[0]?.invitation_token;
  assert.equal(typeof token, "string", "create_child_invitation did not return a single-use token");

  const { data: acceptedChild, error: acceptanceError } = await invitee.rpc("accept_child_invitation", { p_token: token });
  fail(acceptanceError, "accept child invitation");
  assert.equal(acceptedChild, childId, "acceptance returned the wrong child");

  const { data: sharedChild, error: sharedChildError } = await invitee
    .from("children")
    .select("id, preferred_name")
    .eq("id", childId)
    .single();
  fail(sharedChildError, "read invited child's passport");
  assert.equal(sharedChild.preferred_name, "QA Child");

  const { data: membership, error: membershipError } = await invitee
    .from("child_circle_memberships")
    .select("status, organisation_id, permissions")
    .eq("child_id", childId)
    .eq("user_id", ids.invitee)
    .single();
  fail(membershipError, "read invited membership");
  assert.equal(membership.status, "active");
  assert.equal(membership.organisation_id, null, "an unverified/no organisation invite must remain direct access");
  assert.deepEqual(new Set(membership.permissions.read_areas), new Set(["passport", "documents"]));

  const hiddenNeed = await parent.from("child_record_items").insert({
    child_id: childId,
    record_area: "need",
    title: "Unshared QA need",
    body: {},
    created_by: ids.parent,
  });
  fail(hiddenNeed.error, "add parent-only need");
  const { data: inviteeNeeds, error: needsError } = await invitee
    .from("child_record_items")
    .select("id")
    .eq("child_id", childId)
    .eq("record_area", "need");
  fail(needsError, "check unshared need is hidden");
  assert.equal(inviteeNeeds.length, 0, "an invitee received an unshared record area");

  const documentId = randomUUID();
  const storagePath = `${childId}/${documentId}/qa-document.pdf`;
  ids.document = documentId;
  ids.storagePath = storagePath;
  const metadataInsert = await parent.from("child_documents").insert({
    id: documentId,
    child_id: childId,
    title: "QA shared document",
    storage_path: storagePath,
    mime_type: "application/pdf",
    byte_size: 8,
    category: "other",
    access_scope: "active_circle",
    upload_status: "pending",
    created_by: ids.parent,
  });
  fail(metadataInsert.error, "create pending document metadata");
  const upload = await parent.storage.from("child-documents").upload(storagePath, new Uint8Array([37, 80, 68, 70, 45, 81, 65, 10]), {
    contentType: "application/pdf",
    upsert: false,
  });
  fail(upload.error, "upload test document");
  const finalise = await parent.rpc("finalise_child_document", { p_document_id: documentId });
  fail(finalise.error, "finalise test document");

  const { data: inviteeDocument, error: documentReadError } = await invitee
    .from("child_documents")
    .select("id, title, upload_status")
    .eq("id", documentId)
    .single();
  fail(documentReadError, "read shared document as invitee");
  assert.equal(inviteeDocument.upload_status, "available");

  const confirmation = await invitee.rpc("confirm_child_document", { p_document_id: documentId, p_note: "QA confirmed" });
  fail(confirmation.error, "confirm shared document");
  const { data: confirmationRow, error: confirmationReadError } = await admin
    .from("child_document_confirmations")
    .select("user_id, note")
    .eq("document_id", documentId)
    .eq("user_id", ids.invitee)
    .single();
  fail(confirmationReadError, "read confirmation through test admin");
  assert.equal(confirmationRow.note, "QA confirmed");

  const { data: parentNotifications, error: notificationsError } = await parent
    .from("notifications")
    .select("event_type, entity_id")
    .eq("entity_id", documentId)
    .eq("event_type", "DOCUMENT_CONFIRMED");
  fail(notificationsError, "read document confirmation notification");
  assert.equal(parentNotifications.length, 1, "document confirmation did not notify the child access administrator");

  const { data: eventId, error: eventCreateError } = await parent.rpc("create_child_event", {
    p_child_id: childId,
    p_title: "QA review meeting",
    p_description: "Integration test event",
    p_starts_at: "2030-01-01T10:00:00.000Z",
    p_ends_at: "2030-01-01T10:30:00.000Z",
  });
  fail(eventCreateError, "create child event");
  assert.ok(eventId, "create_child_event did not return an event ID");
  const { data: creatorParticipant, error: participantError } = await parent
    .from("child_event_participants")
    .select("user_id, response")
    .eq("event_id", eventId)
    .eq("user_id", ids.parent)
    .single();
  fail(participantError, "read event creator participant");
  assert.equal(creatorParticipant.response, "accepted");

  const { data: hiddenEvents, error: hiddenEventsError } = await invitee
    .from("child_events")
    .select("id")
    .eq("id", eventId);
  fail(hiddenEventsError, "check event is hidden from non-participant");
  assert.equal(hiddenEvents.length, 0, "a non-participant could read a child event");
  const unauthorisedResponse = await invitee.rpc("respond_to_child_event", { p_event_id: eventId, p_response: "accepted" });
  assert.ok(unauthorisedResponse.error, "a non-participant could respond to a child event");
});
