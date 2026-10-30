import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { emptyProfile } from "../src/lib/pilot-model.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";

// Real PostgreSQL/PLpgSQL and RLS, with synthetic Supabase Auth/Storage schemas.
// This never connects to a customer's project or creates external accounts.
test("school → template → signed immutable version → scoped parent → revoke (PostgreSQL)", async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    alter default privileges in schema public grant all on tables to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb default '{}');
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    create publication supabase_realtime;
  `);
  const folder = new URL("../supabase/", import.meta.url);
  for (const name of readdirSync(folder).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort()) {
    try { await db.exec(readFileSync(new URL(name, folder), "utf8")); }
    catch (error) { throw new Error(`Migration ${name}: ${error.message}`, { cause: error }); }
  }
  // 0022 itself is safe to replay; historical migrations need not be.
  await db.exec(readFileSync(new URL("0022_school_parent_pilot.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0023_personal_parent_contacts.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0024_pilot_review_date.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0025_pilot_renew_invitation.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0026_pilot_drawn_signature_and_tables.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0027_pilot_review_plan_link.sql", folder), "utf8"));
  await db.exec(readFileSync(new URL("0028_open_school_pilot.sql", folder), "utf8"));
  assert.equal((await db.query("select pilot_school_enrolment_open() as value")).rows[0].value, false);
  const schoolUser = randomUUID(), parentUser = randomUUID(), secondParent = randomUUID(), stranger = randomUUID(), staffUser = randomUUID(), schoolId = randomUUID();
  for (const [id, email] of [[schoolUser, "school@example.test"], [parentUser, "parent@example.test"], [secondParent, "second@example.test"], [stranger, "stranger@example.test"], [staffUser, "staff@example.test"]]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)", [id, email, JSON.stringify({ display_name: email.split("@")[0] })]);
  }
  await db.query("insert into organisations(id,name,organisation_type,verification_status) values($1,'Test School','school','verified')", [schoolId]);
  await db.query("insert into organisation_memberships(organisation_id,user_id,role,membership_status) values($1,$2,'senco','active')", [schoolId, schoolUser]);
  const as = async (id, sql, args = []) => {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    try { return await db.query(sql, args); } finally { await db.exec("reset role"); }
  };
  const scalar = async (id, sql, args) => (await as(id, sql, args)).rows[0]?.value;
  const profile = { ...emptyProfile(), preferred_name: "Synthetic pupil", strengths: "Shared strength", needs: "Private need", communication: "Private communication" };
  const childId = await scalar(schoolUser, "select pilot_save_pupil(null,$1,0) as value", [JSON.stringify(profile)]);
  assert.ok(childId);
  const template = structuredClone(pilotCatalogue[0].definition);
  const templateId = await scalar(schoolUser, "select pilot_save_template(null,$1,0) as value", [JSON.stringify(template)]);
  for (const malformed of [null, {}, { title: "Unsafe" }, { title: "Unsafe", sections: [] }, { ...template, title: null }]) {
    await assert.rejects(as(schoolUser, "select pilot_save_template(null,$1,0)", [JSON.stringify(malformed)]), /invalid/i);
  }
  await assert.rejects(as(schoolUser, "select pilot_save_pupil($1,$2,null)", [childId, JSON.stringify(profile)]), /changed/i);
  const planId = await scalar(schoolUser, "select pilot_create_plan($1,$2,null) as value", [childId, templateId]);
  const original = (await as(schoolUser, "select * from pilot_plans where id=$1", [planId])).rows[0];
  // Validate both boundaries: direct RPC callers cannot bypass the UI checks.
  for (const drawing of [null, {}, { version: 1, strokes: [] }, { version: 1, strokes: [[[10,10],[10,10]]] }, { version: 1, strokes: [[[10,10],[1001,10]]] }]) {
    await assert.rejects(as(schoolUser, "select pilot_sign_plan_drawn($1,1,'Signer','SENCO',true,$2)", [planId, JSON.stringify(drawing)]), /signature/i);
  }
  await assert.rejects(as(schoolUser, "select pilot_sign_plan($1,1,'Signer','SENCO',true)", [planId]), /signature/i);
  const objectiveField = template.sections.find(s => s.id === "objectives").fields[0];
  for (const answer of ['{}', '[null]', '[{"column_1":null}]', '[{"column_1":"Goal","extra":"Private"}]', JSON.stringify(Array(21).fill({ column_1: "Goal" }))]) {
    await assert.rejects(as(schoolUser, "select pilot_save_plan($1,$2,null,1)", [planId, JSON.stringify({ ...original.answers, [objectiveField.id]: answer })]), /table/i);
  }
  assert.equal(original.answers.preferred_name, profile.preferred_name);
  assert.equal(original.answers.strengths, profile.strengths);
  assert.ok(original.template_snapshot.sections.flatMap(s => s.fields).some(f => f.id === "review_on" && f.type === "date"));
  await as(schoolUser, "select pilot_save_plan($1,$2,'2026-12-01',1)", [planId, JSON.stringify({ ...original.answers, review_on: "2026-12-02" })]);
  assert.equal((await as(schoolUser, "select review_on::text as review_on from pilot_plans where id=$1", [planId])).rows[0].review_on, "2026-12-02");
  await assert.rejects(as(schoolUser, "select pilot_save_plan($1,$2,null,1)", [planId, JSON.stringify(original.answers)]), /changed/i);
  await assert.rejects(as(schoolUser, `select pilot_sign_plan_drawn($1,2,null,'SENCO',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}')`, [planId]), /confirm/i);
  await assert.rejects(as(schoolUser, `select pilot_sign_plan_drawn($1,null,'Signer','SENCO',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}')`, [planId]), /changed/i);
  await as(schoolUser, `select pilot_sign_plan_drawn($1,2,'School Signer','SENCO',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}')`, [planId]);
  const signed = (await as(schoolUser, "select * from pilot_plans where id=$1", [planId])).rows[0];
  assert.deepEqual(signed.signature, { version: 1, strokes: [[[10,10],[100,100]]] });
  await assert.rejects(db.query("update pilot_plans set signature=null where id=$1", [planId]), /immutable/i);
  assert.equal(signed.status, "signed"); assert.match(signed.content_hash, /^[a-f0-9]{64}$/);
  await assert.rejects(as(schoolUser, "select pilot_save_plan($1,$2,null,3)", [planId, JSON.stringify(original.answers)]), /locked/i);
  await assert.rejects(db.query("update pilot_plans set answers='{}' where id=$1", [planId]), /immutable/i);
  await assert.rejects(db.query("delete from pilot_plans where id=$1", [planId]), /cannot be deleted/i);
  await as(schoolUser, "select pilot_publish_plan($1,3)", [planId]);
  const reviewEvent = (await as(schoolUser, "select id,plan_id,starts_at from child_events where child_id=$1 and plan_id=$2", [childId, planId])).rows[0];
  assert.ok(reviewEvent);
  assert.equal(reviewEvent.plan_id, planId);
  assert.equal(new Date(reviewEvent.starts_at).toISOString(), "2026-12-02T09:00:00.000Z");
  await as(schoolUser, "select pilot_save_pupil($1,$2,1)", [childId, JSON.stringify({ ...profile, strengths: "New strength" })]);
  const frozen = (await as(schoolUser, "select * from pilot_plans where id=$1", [planId])).rows[0];
  assert.equal(frozen.profile_snapshot.strengths, "Shared strength"); assert.equal(frozen.answers.strengths, "Shared strength"); assert.equal(frozen.content_hash, signed.content_hash);
  const newPlan = await scalar(schoolUser, "select pilot_create_plan($1,null,$2) as value", [childId, planId]);
  await assert.rejects(db.query("update child_events set plan_id=$1 where id=$2", [newPlan, reviewEvent.id]), /published plan from the same child/i);
  await assert.rejects(db.query("insert into child_events(child_id,plan_id,title,starts_at,created_by) values($1,$2,'Invalid draft reference',now(),$3)", [childId, newPlan, schoolUser]), /published plan from the same child/i);
  await assert.rejects(db.query("update child_events set plan_id=$1 where id=$2", [randomUUID(), reviewEvent.id]), /published plan from the same child/i);
  assert.equal((await as(schoolUser, "select signature from pilot_plans where id=$1", [newPlan])).rows[0].signature, null);
  assert.equal((await as(schoolUser, "select answers from pilot_plans where id=$1", [newPlan])).rows[0].answers.strengths, "New strength");
  await assert.rejects(as(schoolUser, "select pilot_invite($1,'parent@example.test','parent','{}',$2,'{}')", [childId, [newPlan]]), /published/i);
  await assert.rejects(as(stranger, "select pilot_invite_parent($1,'parent@example.test','Parent One','Mother','{}','{}','{}')", [childId]), /authorised/i);
  await assert.rejects(as(schoolUser, "select pilot_invite_parent($1,'parent@example.test',null,'Mother','{}','{}','{}')", [childId]), /contact/i);
  // A replacement link invalidates only its pending predecessor, not active access.
  const oldToken = await scalar(schoolUser, "select pilot_invite_parent($1,'renew@example.test','Renew Parent','Guardian',$2,'{}','{}') as value", [childId, ["preferred_name"]]);
  const oldId = (await as(schoolUser, "select id from pilot_invitations where recipient_label='renew@example.test'")).rows[0].id;
  await db.query("update pilot_invitations set expires_at=now()-interval '1 day' where id=$1", [oldId]);
  await assert.rejects(as(stranger, "select pilot_renew_parent_invitation($1,'Renew Parent','Guardian','{}','{}','{}')", [oldId]), /unavailable/i);
  const replacement = await scalar(schoolUser, "select pilot_renew_parent_invitation($1,'Renew Parent','Guardian',$2,'{}','{}') as value", [oldId, ["preferred_name"]]);
  assert.notEqual(oldToken, replacement);
  const renewRows = (await as(schoolUser, "select status,recipient_label,expires_at from pilot_invitations where recipient_label='renew@example.test'")).rows;
  assert.equal(renewRows.filter(r => r.status === "pending").length, 1); assert.equal(renewRows.filter(r => r.status === "revoked").length, 1);
  await assert.rejects(as(schoolUser, "select pilot_renew_parent_invitation($1,'Renew Parent','Guardian','{}','{}','{}')", [oldId]), /unavailable/i);
  const token = await scalar(schoolUser, "select pilot_invite_parent($1,'parent@example.test','Parent One','Mother',$2,'{}','{}') as value", [childId, ["preferred_name", "strengths"]]);
  await assert.rejects(as(stranger, "select accept_pilot_invitation($1)", [token]), /unavailable/i);
  // A demoted issuer cannot keep granting access using previously issued links.
  await db.query("update organisation_memberships set role='parent' where organisation_id=$1 and user_id=$2", [schoolId, schoolUser]);
  await assert.rejects(as(parentUser, "select accept_pilot_invitation($1)", [token]), /unavailable/i);
  await db.query("update organisation_memberships set role='senco' where organisation_id=$1 and user_id=$2", [schoolId, schoolUser]);
  assert.equal(await scalar(parentUser, "select accept_pilot_invitation($1) as value", [token]), childId);
  await assert.rejects(as(parentUser, "select accept_pilot_invitation($1)", [token]), /unavailable/i);
  let shared = await scalar(parentUser, "select pilot_parent_view() as value");
  const secondToken = await scalar(schoolUser, "select pilot_invite_parent($1,'second@example.test','Parent Two','Father',$2,'{}','{}') as value", [childId, ["preferred_name"]]);
  await as(secondParent, "select accept_pilot_invitation($1)", [secondToken]);
  assert.equal((await scalar(secondParent, "select pilot_parent_view() as value"))[0].profile.strengths, undefined);
  assert.equal((await as(parentUser, "select contact_name from pilot_invitations")).rows.length, 0);
  assert.equal((await as(schoolUser, "select contact_name from pilot_invitations where accepted_by=$1", [parentUser])).rows[0].contact_name, "Parent One");
  assert.equal(shared[0].profile.strengths, "New strength"); assert.equal(shared[0].profile.needs, undefined); assert.equal(shared[0].profile.communication, undefined); assert.equal(shared[0].plans.length, 0);
  assert.equal((await as(parentUser, "select * from pilot_pupils")).rows.length, 0);
  assert.equal((await as(parentUser, "select * from children where id=$1", [childId])).rows.length, 0);
  assert.equal((await as(parentUser, "select * from pilot_plans")).rows.length, 0);
  assert.equal((await as(parentUser, "select * from pilot_templates")).rows.length, 0);
  await assert.rejects(as(parentUser, "select pilot_save_pupil($1,$2,2)", [childId, JSON.stringify(profile)]), /authorised/i);
  await assert.rejects(as(parentUser, "select pilot_save_template(null,$1,0)", [JSON.stringify(template)]), /school/i);
  await assert.rejects(as(parentUser, `select pilot_sign_plan_drawn($1,1,'Parent','Parent',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}')`, [newPlan]), /unavailable/i);
  const shareId = (await as(schoolUser, "select id from pilot_parent_shares where child_id=$1 and user_id=$2", [childId, parentUser])).rows[0].id;
  await as(schoolUser, "select pilot_set_sharing($1,$2,'{}',$3)", [shareId, ["preferred_name"], [reviewEvent.id]]);
  const eventOnlyView = await scalar(parentUser, "select pilot_parent_view() as value");
  assert.equal(eventOnlyView[0].plans.length, 0);
  assert.equal(eventOnlyView[0].events[0].id, reviewEvent.id);
  assert.deepEqual(Object.keys(eventOnlyView[0].events[0]).sort(), ["description", "id", "starts_at", "status", "title"]);
  await assert.rejects(as(secondParent, "select pilot_set_parent_sharing($1,'Changed','Guardian','{}','{}','{}')", [shareId]), /unavailable/i);
  await assert.rejects(as(schoolUser, "select pilot_set_sharing($1,$2,'{}','{}')", [shareId, ["internal_notes"]]), /invalid/i);
  const otherChild = await scalar(schoolUser, "select pilot_save_pupil(null,$1,0) as value", [JSON.stringify({ ...profile, preferred_name: "Other synthetic pupil" })]);
  const otherPlan = await scalar(schoolUser, "select pilot_create_plan($1,$2,null) as value", [otherChild, templateId]);
  await as(schoolUser, `select pilot_sign_plan_drawn($1,1,'School Signer','SENCO',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}')`, [otherPlan]);
  await assert.rejects(db.query("update child_events set plan_id=$1 where id=$2", [otherPlan, reviewEvent.id]), /published plan from the same child/i);
  await as(schoolUser, "select pilot_publish_plan($1,2)", [otherPlan]);
  await assert.rejects(db.query("update child_events set plan_id=$1 where id=$2", [otherPlan, reviewEvent.id]), /published plan from the same child/i);
  await assert.rejects(db.query("update child_events set child_id=$1 where id=$2", [otherChild, reviewEvent.id]), /published plan from the same child/i);
  assert.equal((await db.query("select plan_id from child_events where id=$1", [reviewEvent.id])).rows[0].plan_id, planId);
  await assert.rejects(as(schoolUser, "select pilot_set_sharing($1,'{}',$2,'{}')", [shareId, [otherPlan]]), /from this child/i);
  await as(schoolUser, "select pilot_set_parent_sharing($1,'Parent One Updated','Mother',$2,$3,'{}')", [shareId, ["preferred_name"], [planId]]);
  const secondView = await scalar(secondParent, "select pilot_parent_view() as value");
  assert.equal(secondView[0].plans.length, 0);
  assert.deepEqual(Object.keys(secondView[0].profile), ["preferred_name"]);
  assert.equal((await as(schoolUser, "select contact_name from pilot_invitations where accepted_by=$1", [secondParent])).rows[0].contact_name, "Parent Two");
  shared = await scalar(parentUser, "select pilot_parent_view() as value");
  assert.deepEqual(shared[0].plans[0].signature, signed.signature);
  assert.equal(shared[0].profile.strengths, undefined); assert.equal(shared[0].plans.length, 1); assert.equal(shared[0].plans[0].profile_snapshot, undefined); assert.equal(shared[0].plans[0].content_hash, signed.content_hash);
  assert.deepEqual(await scalar(stranger, "select pilot_parent_view() as value"), []);
  await assert.rejects(as(stranger, "select pilot_set_sharing($1,'{}','{}','{}')", [shareId]), /unavailable/i);
  await assert.rejects(as(parentUser, "update pilot_plans set title='changed' where id=$1", [planId]), /permission/i);
  const staffToken = await scalar(schoolUser, "select pilot_invite($1,'staff@example.test','school_staff') as value", [childId]);
  await as(staffUser, "select accept_pilot_invitation($1)", [staffToken]);
  assert.equal((await as(staffUser, "select * from pilot_pupils")).rows.length, 1);
  assert.equal((await as(staffUser, "select * from pilot_pupils where child_id=$1", [otherChild])).rows.length, 0);
  await as(schoolUser, "select pilot_revoke($1)", [shareId]);
  assert.deepEqual(await scalar(parentUser, "select pilot_parent_view() as value"), []);
  await as(staffUser, "select pilot_save_pupil($1,$2,2)", [childId, JSON.stringify({ ...profile, preferred_name: "Updated by school colleague" })]);
  // Installing the pilot must preserve the legacy organisation suspension gate.
  const legacyChild = randomUUID();
  await db.query("insert into children(id,owning_organisation_id,preferred_name) values($1,$2,'Legacy synthetic pupil')", [legacyChild, schoolId]);
  await db.query("insert into child_circle_memberships(child_id,user_id,organisation_id,role,status,permissions) values($1,$2,$3,'school_staff','active',$4)", [legacyChild, staffUser, schoolId, JSON.stringify({ read_areas: ["passport"], contribute_areas: [] })]);
  assert.equal(await scalar(staffUser, "select can_access_area($1,'passport','read') as value", [legacyChild]), true);
  await db.query("update organisations set verification_status='suspended' where id=$1", [schoolId]);
  assert.equal(await scalar(staffUser, "select can_access_area($1,'passport','read') as value", [legacyChild]), false);
  assert.equal((await as(staffUser, "select * from pilot_pupils")).rows.length, 0);
  await assert.rejects(as(schoolUser, "select pilot_create_plan($1,$2,null)", [childId, templateId]), /authorised/i);
  // The exact SQL used against a deployed database must pass locally first.
  const deployedChecks = await db.exec(readFileSync(new URL("./pilot-deployed-transaction.sql", import.meta.url), "utf8"));
  assert.match(deployedChecks.at(-1).rows[0].qa_result, /PASS: 33/);

  // Open school testing is self-service, never a global pupil grant.
  const pendingA = await scalar(stranger, "select create_platform_organisation('QA school A','school','senco') as value");
  const pendingB = await scalar(secondParent, "select create_platform_organisation('QA school B','school','senco') as value");
  assert.equal(await scalar(stranger, "select pilot_activate_school_access() as value"), 0);
  assert.equal(await scalar(stranger, "select pilot_school_id() as value"), null);
  await assert.rejects(as(stranger, "update pilot_admission_settings set school_enrolment_open=true"), /permission/i);
  await assert.rejects(as(stranger, "select * from pilot_admission_settings"), /permission/i);
  await db.exec("set role anon");
  assert.equal((await db.query("select pilot_school_enrolment_open() as value")).rows[0].value, false);
  await assert.rejects(db.query("select pilot_activate_school_access()"), /permission/i);
  await db.exec("reset role");

  await db.exec("update pilot_admission_settings set school_enrolment_open=true,updated_at=now()");
  await db.exec(readFileSync(new URL("0028_open_school_pilot.sql", folder), "utf8"));
  assert.equal((await db.query("select pilot_school_enrolment_open() as value")).rows[0].value, true, "replaying the migration does not reset the operator's switch");
  const unconfirmed = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'qa-unconfirmed@example.test')", [unconfirmed]);
  await assert.rejects(as(unconfirmed, "select pilot_activate_school_access()"), /confirm.*email/i);
  assert.equal(await scalar(parentUser, "select pilot_activate_school_access() as value"), 0, "a parent cannot activate somebody else's school");
  assert.equal(await scalar(stranger, "select pilot_activate_school_access() as value"), 1);
  assert.equal(await scalar(stranger, "select pilot_activate_school_access() as value"), 0, "activation is idempotent");
  assert.equal((await db.query("select count(*)::integer as value from audit_events where event_type='PILOT_SCHOOL_ACCESS_ACTIVATED' and entity_id=$1", [pendingA])).rows[0].value, 1);
  assert.equal((await db.query("select verification_status from organisations where id=$1", [pendingB])).rows[0].verification_status, "pending_verification", "activation never targets another school");
  assert.equal(await scalar(stranger, "select pilot_school_id() as value"), pendingA);
  const isolatedA = await scalar(stranger, "select pilot_save_pupil(null,$1,0) as value", [JSON.stringify({ ...profile, preferred_name: "School A fictional child" })]);
  assert.equal(await scalar(secondParent, "select pilot_activate_school_access() as value"), 1);
  const isolatedB = await scalar(secondParent, "select pilot_save_pupil(null,$1,0) as value", [JSON.stringify({ ...profile, preferred_name: "School B fictional child" })]);
  assert.equal((await as(stranger, "select * from pilot_pupils where child_id=$1", [isolatedB])).rows.length, 0);
  assert.equal((await as(secondParent, "select * from pilot_pupils where child_id=$1", [isolatedA])).rows.length, 0);
  assert.equal((await as(parentUser, "select * from pilot_pupils where child_id in ($1,$2)", [isolatedA, isolatedB])).rows.length, 0);

  // A pause is not an invitation to self-reactivate during open enrolment.
  await db.query("update organisations set verification_status='suspended' where id=$1", [pendingA]);
  assert.equal(await scalar(stranger, "select pilot_activate_school_access() as value"), 0);
  assert.equal(await scalar(stranger, "select pilot_school_id() as value"), null);
  assert.equal((await as(stranger, "select * from pilot_pupils where child_id=$1", [isolatedA])).rows.length, 0);
  assert.equal(await scalar(schoolUser, "select pilot_activate_school_access() as value"), 0, "the earlier suspended school remains blocked");
  const suspendedMembership = await scalar(staffUser, "select create_platform_organisation('QA suspended member','school','senco') as value");
  await db.query("update organisation_memberships set membership_status='suspended' where organisation_id=$1", [suspendedMembership]);
  assert.equal(await scalar(staffUser, "select pilot_activate_school_access() as value"), 0);

  await db.exec("update pilot_admission_settings set school_enrolment_open=false,updated_at=now()");
  const afterClose = await scalar(stranger, "select create_platform_organisation('QA after pilot closes','school','senco') as value");
  assert.equal(await scalar(stranger, "select pilot_activate_school_access() as value"), 0);
  assert.equal((await db.query("select verification_status from organisations where id=$1", [afterClose])).rows[0].verification_status, "pending_verification");
  assert.equal(await scalar(secondParent, "select pilot_school_id() as value"), pendingB, "closing new admissions does not revoke existing schools");
  await db.exec("update pilot_admission_settings set school_enrolment_open=true");
  const deployedAdmission = await db.exec(readFileSync(new URL("./pilot-admission-deployed-transaction.sql", import.meta.url), "utf8"));
  assert.match(deployedAdmission.at(-1).rows[0].qa_result, /PASS: 14/);
});
