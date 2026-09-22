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
- Role workspaces now support a local, interactive preview: add an item, update its stage or status and remove it. School users can also validate and review a CSV pupil list locally before a future approved import.
- Supabase foundation with deny-by-default RLS, child records and audit history.
- Granular record-area permissions, private document bucket, actions, invitations, invitation acceptance and private AI conversation schema.
- English, Portuguese and Spanish interface translation with browser detection and a persistent manual override.
- Circle AI server route with authentication in live mode, RLS-authorised record retrieval, PII redaction, rate limiting and account conversation persistence.
- Restrictive browser security headers and same-origin protections.

## Next implementation passes

1. Connect the client Supabase project and run migrations `0001` → `0005`.
2. Connect the client-owned `OPENAI_API_KEY`; the local Circle AI preview must then be replaced by the authenticated, authorised-record service.
3. Configure email delivery for invitations; the current secure link is intentionally shown only to the access administrator until SMTP is connected.
4. Add live document preview, versioning, malware scanning and retention controls (the current local preview does not replace a secure file workflow).
5. Add letter/template generation and reviewed export to the working Circle AI route.
6. Move the current translation layer to locale-prefixed, server-rendered public routes before SEO launch.
7. Add MFA enforcement, operational audit screens, backup checks, DPIA evidence and independent security testing before production.

## Security boundary

The current code is prepared for secure implementation, but no software should be described as Cyber Essentials or Cyber Essentials Plus certified until the organisation, devices, hosting, policies and independent assessment have all completed the official process.

The browser-only demonstration is not an authenticated or secure child record. It must never receive real child, health or identity information. School, professional and Local Authority views disclose that they are previews until a connected account has authorised live records; they must not be presented as live caseloads.
