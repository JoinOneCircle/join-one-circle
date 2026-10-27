import assert from "node:assert/strict";
import test from "node:test";
import { pilotReviewLink } from "../src/lib/pilot-review-link.ts";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";
import { signature } from "./signature-fixture.mjs";

const event = { id: "review", child_id: "child", title: "Plan review", description: "School review reminder", starts_at: "2026-07-01T08:00:00Z", status: "scheduled" };
const plan = { id: "v1", child_id: "child", status: "published", review_on: "2026-07-01" };
const list = "/children?child=child&tab=documents";

test("new review links stay on the exact published version even when dates match", () => {
  assert.deepEqual(pilotReviewLink({ ...event, plan_id: "v1" }, [plan, { ...plan, id: "v2" }]), { href: `${list}&plan=v1`, planId: "v1" });
});

test("unavailable, draft or other-child exact references never guess another version", () => {
  for (const candidate of [undefined, { ...plan, status: "draft" }, { ...plan, child_id: "other" }]) {
    assert.deepEqual(pilotReviewLink({ ...event, plan_id: "v1" }, [{ ...plan, id: "v2" }, ...(candidate ? [candidate] : [])]), { href: list, planId: null });
  }
});

test("legacy reminders resolve only one published document for the same child and London day", () => {
  // At 23:30 UTC it is already the next day in London (BST).
  assert.equal(pilotReviewLink({ ...event, starts_at: "2026-06-30T23:30:00Z" }, [plan])?.planId, "v1");
  assert.equal(pilotReviewLink(event, [plan, { ...plan, id: "draft", status: "draft" }, { ...plan, id: "other", child_id: "other" }])?.planId, "v1");
  for (const plans of [[], [{ ...plan, review_on: "2026-07-02" }], [plan, { ...plan, id: "v2" }]]) {
    assert.deepEqual(pilotReviewLink(event, plans), { href: list, planId: null });
  }
  assert.deepEqual(pilotReviewLink({ ...event, starts_at: "invalid" }, [plan]), { href: list, planId: null });
});

test("ordinary events do not acquire document links and URLs encode identifiers", () => {
  assert.equal(pilotReviewLink({ ...event, title: "Team meeting" }, [plan]), null);
  assert.equal(pilotReviewLink({ ...event, child_id: "child & one", plan_id: "v 1" }, [{ ...plan, id: "v 1", child_id: "child & one" }])?.href, "/children?child=child%20%26%20one&tab=documents&plan=v%201");
});

test("publishing a demo plan records the immutable version without sharing it", async () => {
  let state = initialPilotDemo();
  state = (await changePilotDemo(state, { operation: "template", definition: pilotCatalogue[0].definition }, undefined, "template")).data;
  state = (await changePilotDemo(state, { operation: "plan-create", child_id: "demo-child", template_id: "template" }, undefined, "v1")).data;
  state = (await changePilotDemo(state, { operation: "plan-save", id: "v1", revision: 1, answers: { ...state.plans[0].answers, review_on: "2026-07-01" } })).data;
  state = (await changePilotDemo(state, { operation: "plan-sign", id: "v1", revision: 2, signer_name: "QA Synthetic", signer_role: "School", confirm: true, signature })).data;
  state = (await changePilotDemo(state, { operation: "plan-publish", id: "v1", revision: 3 }, undefined, "review")).data;
  assert.equal(state.events[0].plan_id, "v1");
  assert.equal(pilotReviewLink(state.events[0], state.plans)?.planId, "v1");
  assert.equal(state.recipients.length, 0);
});
