import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initialPilotDemo } from "../src/lib/pilot-demo.ts";
import { chooseSharedChild, childRecordHref, schoolNextActions } from "../src/lib/pilot-ux.ts";

test("accounts awaiting or losing access can sign out from onboarding without creating another workspace", () => {
  const page = readFileSync(new URL("../src/app/onboarding/page.tsx", import.meta.url), "utf8");
  assert.match(page, /signedIn = Boolean\(data\.user\)/);
  assert.match(page, /signedIn \? <form action=\{signOut\}>/);
  assert.match(page, /type="submit">Sign out<\/button>/);
});

test("the free host badge cannot overlap the sticky save bar", () => {
  const css = readFileSync(new URL("../src/components/pilot/pilot-ux.css", import.meta.url), "utf8");
  assert.match(css, /body:has\(#nl-badge-frame\) \.ux-savebar\s*\{\s*bottom:80px;/);
});

test("school next steps follow prerequisites and prioritise signing/publication in the right record", () => {
  const data = initialPilotDemo(); data.pupils = [];
  assert.equal(schoolNextActions(data)[0].kind,"add-child");
  data.pupils = initialPilotDemo().pupils;
  assert.equal(schoolNextActions(data)[0].kind,"template");
  data.templates = [{ id:"model" }];
  assert.equal(schoolNextActions(data)[0].kind,"first-document");
  data.plans = [
    { id:"draft", child_id:"demo-child", status:"draft", title:"Draft", updated_at:"2026-10-20" },
    { id:"signed", child_id:"demo-child", status:"signed", title:"Signed", updated_at:"2026-10-19" },
    { id:"published", child_id:"demo-child", status:"published", title:"Published", updated_at:"2026-10-20" },
  ];
  const steps = schoolNextActions(data);
  assert.deepEqual(steps.map(s=>s.kind),["publish","complete"]);
  assert.equal(steps[0].href,childRecordHref("demo-child","documents","signed"));
  assert.equal(new URL(steps[1].href,"https://local.test").searchParams.get("plan"),"draft");
});

test("parent selection stays scoped to authorised children and never silently changes on revocation", () => {
  const children = [{child_id:"one"},{child_id:"two"}];
  assert.equal(chooseSharedChild(children,"").child_id,"one");
  assert.equal(chooseSharedChild(children,"two").child_id,"two");
  assert.equal(chooseSharedChild([children[0]],"two"),undefined);
  assert.equal(chooseSharedChild(children,"unrelated"),undefined);
  assert.equal(chooseSharedChild([],""),undefined);
});

test("school-parent journeys keep context, explain previews and preserve drafts on temporary refresh errors", () => {
  const source = name => readFileSync(new URL(`../src/components/pilot/${name}`,import.meta.url),"utf8");
  const calendar = source("school-calendar.tsx"); const parent = source("parent-portal.tsx");
  assert.match(calendar,/name="child_id" value=\{initialChild\}/);
  assert.match(calendar,/setSavedChild/); assert.match(calendar,/pendingCancel/);
  assert.match(source("pupil-record.tsx"),/SchoolPilotCalendar/);
  assert.match(parent,/schoolPreview/); assert.match(parent,/chooseSharedChild\(children,selected\)/);
  assert.match(parent,/useParentChildSelection/); assert.match(parent,/setChildren\(\[\]\); setLoading\(true\)/);
  assert.doesNotMatch(parent,/operation:|\/pdf|download=|window\.print/);
  const hook = source("use-pilot.ts");
  assert.match(hook,/r\.status === 401 \|\| r\.status === 403\) setData\(null\)/);
  assert.match(hook,/School data refresh failed/);
  assert.doesNotMatch(hook,/catch \(error\) \{ setData\(null\)/);
  const files = source("school-files.tsx");
  assert.match(files,/setInterval\(refresh,15000\)/); assert.match(files,/joc-pilot-files-change/);
  assert.match(source("sharing-editor.tsx"),/onDirtyChange\?\.\(dirty\)/);
  const invite = readFileSync(new URL("../src/app/invite/[token]/actions.ts",import.meta.url),"utf8");
  assert.match(invite,/\/parent\?child=/);
  assert.match(invite,/switchInvitationAccount/);
  assert.match(source("pupil-record.tsx"),/replacePilotQuery\(\{ tab: next, plan: null, newDocument: null \}\)/);
});
