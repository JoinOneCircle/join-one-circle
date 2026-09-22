# Security readiness — Join One Circle

This is a development checklist, not a certification or a statement that the platform is ready to hold real children's records. Keep real personal and SEND data out of the local demonstration.

## Current boundaries

- Without Supabase, the development-only demonstration stores sample metadata in this browser's `localStorage` and sample files in IndexedDB. It has no sign-in or cross-device access. Do not enter actual names, e-mail addresses, reports or health data. Leaving the demo does not erase browser storage.
- Production does not fall back to the local demo when Supabase settings are absent. The application must fail closed.
- Live child records are intended to use Supabase Auth, row-level security (RLS) and private Storage. Role-specific navigation does not replace database authorization.
- Circle AI must not be given an API key for live use until the connected Supabase environment, access policies, consent/retention rules and rate limiting are verified.

## Release gates before any real child data

1. Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS production origin. Do not use a request's `Origin`/`Host` header to form confirmation or password-reset links. Configure the same approved redirects in Supabase Auth.
2. Run migrations `0001` through `0012` in a disposable Supabase project first. Review the SQL Editor result, function grants and RLS policies; then repeat in the client-owned project. A migration file existing in the repository does not mean it ran.
3. Use separate test accounts for Parent A/Child A, Parent B/Child B, school pending, school approved, school revoked and a professional with one permitted area. Test PostgREST queries, RPC calls, Storage object paths and UI URLs as each account.
4. Verify every direct URL and manually changed UUID returns no unrelated data. A pending or revoked member must not see metadata, files, AI history or audit events. Test a contributor with no `passport` permission separately.
5. Verify invitations are single-use, time-limited, bound to the confirmed recipient e-mail and cannot grant family ownership. Do not send a token through analytics, support screenshots or third-party URLs. Review who can list active members and revoke access.
6. Verify upload-to-download lifecycle: size and MIME validation, private bucket, path tied to child/document identity, no direct download before finalization, short-lived signed URLs, deletion/retention behavior and malware-scanning process. A browser-supplied MIME type is not proof of file contents.
7. After applying `0012`, test that the persistent Circle AI request limit rejects the eleventh request in a minute and that AI input contains only the current user's permitted record areas and does not accept another child's conversation ID.
8. Configure MFA policy for staff and administrators, e-mail service, backups, restore drills, access logging, secrets rotation, incident response, data-retention/deletion policy and an independent security test. Do not claim Cyber Essentials or Cyber Essentials Plus certification before the actual assessment.

## Known limitations to resolve

- A local demo is deliberately not an authenticated privacy boundary. Its browser storage persists until removed by the browser/user.
- No connected Supabase project or test identities are included in this checkout, so RLS/Storage behavior cannot be proved here by code review or TypeScript tests alone.
- The Supabase migrations must be independently tested before deployment. In particular, verify pending document uploads against metadata RLS, record-version restore behavior, invitation acceptance, institutional verification status, CSV import permissions and persistent AI rate limiting.
- The current CSP still permits inline scripts/styles for compatibility with the Next runtime. Replace with a nonce-based policy and retest before a formal security assessment.
