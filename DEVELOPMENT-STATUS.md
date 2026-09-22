# Join One Circle — development status

This is an implementation ledger, not a proposal. The product is being built as a new platform, with Little Steps reused only where it is safe and useful.

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
