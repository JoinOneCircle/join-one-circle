# Join One Circle — development status

This is an implementation ledger, not a proposal. The product is being built as a new platform, with Little Steps reused only where it is safe and useful.

## Existing-account live verification — 2026-10-26

This entry supersedes earlier remote-testing gaps for the specifically tested scenarios; older entries below are historical. Verified 0022–0025 in Supabase project `frhrwuoktohxrjbtdutm`, applied 0026/0027, checked signature column/review link/trigger and unchanged pre-existing plan count. The deployed transactional audit passed 33 assertions and rolled back all of its synthetic fixtures.

Separate browser QA used real Auth sign-ins (school and two parents), an isolated fictitious verified school and a fictitious pupil. School UI created the pupil, uploaded a 2,360,852-byte PNG to private Storage and generated email-bound invitation links. School download matched SHA-256. Wrong-email acceptance and token replay were rejected. Parent A saw name/strengths plus only its selected signed plan/event; parent B saw only the name, no plan/event. Updating the profile changed the parent's current fields without changing the signed document. Revocation removed A without removing B; suspending the QA school removed B's projection. Parent direct attachment download and anonymous table/Storage requests were denied. Plan publication, profile/sharing changes and revocation were invoked via deployed authenticated-role SQL/RPCs; school suspension used scoped admin SQL. Do not report these particular mutations as browser-click coverage.

The QA school `b0ee0136-23a1-414d-ae14-f95fbf8a98b0` is suspended; synthetic signed records and four QA Auth identities remain for audit, with no credentials/tokens saved in this ledger. Existing customer-school permissions were not widened. No purchase, plan upgrade or Netlify deployment. Fixed a missed PT/ES invitation subtitle and added an authenticated onboarding sign-out so an account without access can leave without creating another workspace.

SMTP is not enabled in the dashboard. Controlled-mailbox signup confirmation/recovery delivery, updated HTTPS deployment, malware handling, backups/restore, staff MFA and operational/privacy sign-off remain release gates. Existing Supabase Site URL and HTTPS callback are correct; the production build needs that same HTTPS canonical origin rather than the development localhost setting. See README for exact test scope and identifiers.

## Pilot regression review — 2026-10-26

Fixed unsaved Back/Forward/link exits with a shared in-app confirmation, version/recipient URL context, accent-insensitive search and cross-tab language synchronisation. Model templates are visible in primary desktop/mobile navigation. Objective text can be explicitly imported into repeated rows without replacing evidence. Parent access preserves existing whitelists, proposes only a removable child name for new contacts, and clearly previews entire signed documents before confirmation. Revocation clears the open preview and identifies the revoked access.

PDF headings stay with their first content; exported names include the frozen child name, document title and human version. New review reminders link to the exact published document. Additive migration `0027_pilot_review_plan_link.sql` enforces same-child/published-version references and must be checked/applied after pending prerequisites before deployment. No remote SQL or deployment was performed in this review.

Final local suite: 65 tests, 64 passed and one optional live integration skipped. Type checking, lint and production compilation passed. The root agent operated the browser regressions and a fresh drawn-signature/publication/PDF flow; three persona agents independently reviewed code, tests and supplied captures because their browser control was unavailable. Existing permissions were not widened, raw attachments remain school-only, and real Auth/Storage/invitation delivery/revocation still require deployed independent-account verification. This is not a claim of production readiness.

## School/parent pilot update — 2026-10-22

Added a bounded numeric-stroke school signature pad (mouse/touch/pen), undo/clear, matching document/PDF rendering and hash coverage. New signatures require a drawing; legacy signed documents remain unchanged. The signature is neither reused for another document nor inherited by a revised draft. Parents see it only inside a document individually selected for them and still have no PDF/edit controls.

The template builder now supports repeated-item tables (up to 8 columns and 20 rows). New ISP/APDR/provision starting models include objectives/success criteria, support delivery and evidence/review decisions. A review can reuse its own planned objectives without duplicating them or overwriting recorded evidence. This is a document-centred pilot workflow, not a full TES target bank, MIS integration, intervention-costing or reporting module. Existing school templates are not silently replaced.

`0026_pilot_drawn_signature_and_tables.sql` is additive, transactional, replay-tested locally, and NOT applied to the customer's Supabase in this change. It must be applied after 0022–0025 before deploying this code. Production PDF access continues to use the authenticated persisted-version endpoint with RLS; synthetic browser snapshots are accepted only by the local development preview PDF endpoint, which returns 404 in production/connected environments. Corrected same-origin checks for Next's localhost normalisation without admitting cross-site requests.

Browser QA confirmed drawing and locking a fictitious school document, downloading its PDF, and creating/saving a new child document with objective rows. The downloaded PDF was rendered and visually inspected. Local checks include lint, type checking, build and PostgreSQL lifecycle tests. Independent live Supabase accounts/invitation acceptance, Storage and release/privacy gates remain separate and are not claimed complete.

## Earlier school/parent pilot update — 2026-10-20

UX revision: task-based child creation replaces the mandatory wizard; contextual pupil records, searchable/filterable lists, school/starter template libraries with preview, section jumps, human version numbers, per-recipient parent simulation and agenda-first calendar. File selection has a drop area, filename-derived editable title and private-save feedback. Unsaved-edit guards and busy states cover record/template/plan/access editors. Pending/unverified schools see an explicit approval boundary rather than usable empty tools. Auth errors retain the invite destination and invitation signup avoids another role question.

Pending migrations now include `0024_pilot_review_date.sql` (canonical review date, drafts only) and `0025_pilot_renew_invitation.sql` (reviewed replacement for a pending link, old token revoked atomically). They are locally tested, NOT applied remotely. Current suite: 36 tests, 35 passed locally and one remote opt-in skip. Live release gates below remain outstanding; browser-only simulations are not proof of deployed access or email delivery.

The new active school UI implements structured pupil records, an editable section/field template builder, 20 original starting drafts, automatic profile-field prefilling, frozen plan snapshots, school signature attribution/content hashes, immutable signed/published versions, school PDFs, parent-specific read-only projections and selected calendar events. Local preview runs with synthetic browser-only data; it does not send invitations or grant access. Raw uploaded school files are not selectable for parents yet. The signature is not an external certified digital-signature service.

Migration `0022_school_parent_pilot.sql` is prepared and locally tested against PostgreSQL with all prior migrations. It has NOT been applied to the customer's Supabase project during this implementation. No deploy, production account changes or legacy circle conversion occurred. Current checks: 29 local tests pass, one live integration test is skipped; lint, type check and production build are release checks. Live Supabase Auth/PostgREST/Storage, confirmation email, actual two-account acceptance/revocation and operational/privacy gates remain required. See README's current pilot section before the historical ledger below.

No AI, paid school subscription flow, professional workspace rollout or MIS import integration is included in the active school/parent pilot. AI requires an explicit enable flag in addition to a key; leave it disabled. Dependencies were updated to Next 16.4.2; the current production dependency audit is clear, with five high advisories remaining in development-only lint tooling.

## Working now

- Responsive public home with the new Join One Circle identity.
- Sign-up, sign-in, email confirmation callback and sign-out flow.
- Role-first onboarding: family, school/SENCO, professional and Local Authority paths no longer share one child-first form.
- Four role-specific dashboards and navigation sets, with icon-led desktop and mobile navigation.
- Navigable dashboard, child record, persisted actions, private document upload, My Circle, Circle AI and account security screens.
- Local demonstration fallback while the client Supabase environment is not connected. Family demo records, actions, sample files, invitation drafts, profile edits and a local Circle AI preview persist across refreshes on the same browser only; no invitation is sent, no access is granted and no external AI service is contacted.
- Demo-only privacy center with local audit timeline, restorable child-record versions, access lifecycle simulation, JSON metadata export, manual history retention and full local erasure.
- Verified organisation workspaces are persisted and audited: SEND register, plans, EHCP tracker, provision, reviews, reports, team coordination, professional caseload/requests and Local Authority cases, consultations, deadlines, decisions and audit notes. They only expose children and record areas explicitly shared with that verified organisation.
- Schools can review a CSV locally and import up to 100 validated pupil rows through a verified SENCO/admin-only, auditable transaction. The original CSV is never stored.
- Document upload, short-lived preview/download links and creator-only deletion are implemented in the live workspace. Record versions can be restored by an access administrator without erasing the current version from history.
- Authenticator-app MFA enrolment and challenge flow are implemented. Circle AI has a persistent per-account request limit after migration `0012` is applied.
- Supabase foundation with deny-by-default RLS, child records and audit history.
- Granular record-area permissions, private document bucket, actions, invitations, invitation acceptance and private AI conversation schema.
- English, Portuguese and Spanish interface translation with browser detection and a persistent manual override.
- Circle AI server route with authentication in live mode, RLS-authorised record retrieval, PII redaction, rate limiting and account conversation persistence.
- Restrictive browser security headers and same-origin protections.

## Next implementation passes

1. Apply migrations `0001` → `0012` in a disposable Supabase project, then in the client-owned project.
2. Configure the client-owned `OPENAI_API_KEY` and choose an approved model for Circle AI.
3. Configure SMTP in Supabase and verify confirmation, invitation and password-reset links using the final domain.
4. Add a malware-scanning provider and written retention process before accepting production files.
5. Set organisation policy for mandatory MFA, backup/restore drills, DPIA evidence and an independent security test before holding real child data.

## Security boundary

The current code is prepared for secure implementation, but no software should be described as Cyber Essentials or Cyber Essentials Plus certified until the organisation, devices, hosting, policies and independent assessment have all completed the official process.

The browser-only demonstration is not an authenticated or secure child record. It must never receive real child, health or identity information. Live school, professional and Local Authority workspaces require a verified organisation and explicit child-area access; an empty workspace is not a simulated caseload.
