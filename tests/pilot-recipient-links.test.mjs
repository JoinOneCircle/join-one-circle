import assert from "node:assert/strict";
import test from "node:test";
import { parentContactForShare, parentInvitationRepresented } from "../src/lib/pilot-recipient-links.ts";

const share = { child_id: "child-a", user_id: "parent-a" };
const invite = { child_id: "child-a", accepted_by: "parent-a", recipient_role: "parent", status: "revoked", contact_name: "School contact A" };

test("a revoked accepted parent invitation is not rendered as a second recipient", () => {
  assert.equal(parentInvitationRepresented(invite, [share]), true);
  assert.equal(parentInvitationRepresented({ ...invite, status: "accepted" }, [share]), true);
  assert.equal(parentContactForShare(share, [invite]).contact_name, "School contact A");
});

test("recipient deduplication never crosses a child or a user and retains unaccepted history", () => {
  assert.equal(parentInvitationRepresented({ ...invite, child_id: "child-b" }, [share]), false);
  assert.equal(parentInvitationRepresented({ ...invite, accepted_by: "parent-b" }, [share]), false);
  assert.equal(parentInvitationRepresented({ ...invite, accepted_by: null }, [share]), false);
  assert.equal(parentInvitationRepresented({ ...invite, recipient_role: "school_staff" }, [share]), false);
  assert.equal(parentContactForShare({ ...share, child_id: "child-b" }, [invite]), undefined);
});

test("the current accepted contact takes precedence without replacing the school's label with a global name", () => {
  const accepted = { ...invite, status: "accepted", contact_name: "Current school contact" };
  assert.equal(parentContactForShare(share, [invite, accepted]), accepted);
});
