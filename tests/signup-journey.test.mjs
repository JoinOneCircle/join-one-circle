import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pilotSignupRole, signupRoleForDestination } from "../src/lib/signup-role.ts";
import { translateUi } from "../src/lib/ui-translations.ts";
import { JOC_SUPPORT_EMAIL, SCHOOL_VERIFICATION_BUSINESS_DAYS } from "../src/lib/support-contact.ts";

const require = createRequire(import.meta.url);
// Exercise the real component's initial render without granting any live access.
function compile(relative, mocks) {
  const filename = resolve(fileURLToPath(new URL("..", import.meta.url)), relative);
  const source = readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const output = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in mocks) return mocks[name];
    if (name.endsWith(".module.css")) return { default: {} };
    return require(name);
  }, output, output.exports);
  return output.exports;
}

function onboarding(language = "en") {
  const languageMock = { usePilotLanguage: () => ({ l: (...copy) => copy[language === "pt" ? 1 : language === "es" ? 2 : 0] }) };
  const { VerificationContact } = compile("src/components/pilot/verification-contact.tsx", {
    "@/components/app-icon": { AppIcon: () => null },
    "@/lib/support-contact": { JOC_SUPPORT_EMAIL, SCHOOL_VERIFICATION_BUSINESS_DAYS },
    "./pilot-language": languageMock,
  });
  const notice = compile("src/components/pilot/pilot-ui.tsx", {
    "@/components/app-icon": { AppIcon: () => null }, "./pilot-language": languageMock, "./verification-contact": { VerificationContact },
  });
  return { ...notice, ...compile("src/components/pilot/pilot-onboarding.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { useRouter: () => ({ push() {}, refresh() {} }) },
    "@/components/app-icon": { AppIcon: () => null },
    "@/app/onboarding/actions": { completeOrganisationOnboarding() {} },
    "@/lib/demo-workspace": { DEMO_WORKSPACE_COOKIE: "test" },
    "@/lib/signup-role": { pilotSignupRole },
    "./pilot-language": languageMock,
    "./verification-contact": { VerificationContact },
  }) };
}

test("signup role preferences accept only pilot types and invitations always retain family context", () => {
  for (const value of [undefined, null, "", "admin", "professional", {}, ["school"]]) assert.equal(pilotSignupRole(value), undefined);
  assert.equal(pilotSignupRole("school"), "school");
  assert.equal(pilotSignupRole("family"), "family");
  assert.equal(signupRoleForDestination("/onboarding", "school"), "school");
  assert.equal(signupRoleForDestination("/invite/test-token", "school"), "family");
  assert.equal(signupRoleForDestination("/invite/test-token", undefined), "family");
});

test("a school chosen at signup goes directly to school details, not a second role picker", () => {
  const { PilotOnboarding, PilotOnboardingIntro } = onboarding();
  const html = renderToStaticMarkup(React.createElement(PilotOnboarding, { initialRole: "school", demo: false }));
  assert.match(html, /Tell us about your school/);
  assert.match(html, /name="organisation_name"/);
  assert.match(html, /name="role" value="school"/);
  assert.match(html, /Change account type/);
  assert.match(html, /Request school access/);
  assert.doesNotMatch(html, /role-choice-grid|How will you use|Parent \/ carer/);
  const intro = renderToStaticMarkup(React.createElement(PilotOnboardingIntro, { initialRole: "school" }));
  assert.doesNotMatch(intro, /Choose your role/);
});

test("a parent chosen at signup is guided to the email-bound invitation, never asked to recreate the child", () => {
  const { PilotOnboarding } = onboarding();
  const html = renderToStaticMarkup(React.createElement(PilotOnboarding, { initialRole: "family", demo: false }));
  assert.match(html, /Your invitation is the next step/);
  assert.match(html, /email matches the invited email/);
  assert.match(html, /href="\/parent"/);
  assert.doesNotMatch(html, /role-choice-grid|organisation_name|child_name|date_of_birth|Request school access/);
});

test("older accounts without a role still get one explicit choice and all pilot languages render", () => {
  const expected = { en: "How will you use Join One Circle?", pt: "Como você vai usar a Join One Circle?", es: "¿Cómo usará Join One Circle?" };
  for (const language of ["en", "pt", "es"]) {
    const { PilotOnboarding } = onboarding(language);
    const unselected = renderToStaticMarkup(React.createElement(PilotOnboarding, { demo: false }));
    assert.ok(unselected.includes(expected[language]));
    assert.match(unselected, /role-choice-grid/);
    const selected = renderToStaticMarkup(React.createElement(PilotOnboarding, { initialRole: "school", demo: false }));
    assert.doesNotMatch(selected, /role-choice-grid/);
    if (language !== "en") assert.doesNotMatch(selected, /Tell us about your school|Change account type|What happens next/);
  }
});

test("signup saves the role to auth metadata, retains it on validation errors, and does not grant membership", async () => {
  let payload;
  const { signUp } = compile("src/app/auth/actions.ts", {
    "next/headers": { headers: async () => new Headers(), cookies: async () => ({ get() {} }) },
    "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } },
    "@/lib/supabase/config": { isSupabaseConfigured: true, isLocalDemoMode: false },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { signUp: async (input) => { payload = input; return { data: { session: {} }, error: null }; } }, rpc: () => { throw new Error("Signup must not create membership"); } }) },
    "@/lib/security/redirect": { safeInternalPath: (path, fallback) => path?.startsWith("/") && !path.startsWith("//") ? path : fallback, configuredSiteOrigin: () => "https://joinonecircle.netlify.app" },
    "@/lib/signup-role": { pilotSignupRole, signupRoleForDestination },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "QA Fictitious School", email: "qa@example.test", password: "Synthetic-only-42", confirm_password: "Synthetic-only-42", privacy_consent: "on", intended_role: "school", next: "/onboarding" })) form.set(key, value);
  await assert.rejects(signUp(form), /REDIRECT:\/onboarding$/);
  assert.equal(payload.options.data.intended_role, "school");
  form.set("confirm_password", "mismatch");
  await assert.rejects(signUp(form), /REDIRECT:\/signup\?.*&role=school&error=/);
});

test("landing page separates real pilot functions from examples and has no invented prices or AI promises", () => {
  const home = readFileSync(new URL("../src/components/pilot/pilot-home.tsx", import.meta.url), "utf8");
  assert.match(home, /Illustrative preview with fictional data/);
  assert.match(home, /Raw uploaded attachments remain school-only/);
  assert.match(home, /does not unlock child records/);
  assert.match(home, /not part of this pilot/);
  assert.match(home, /aria-selected=/);
  assert.match(home, /<details/);
  assert.doesNotMatch(home, /\$\d+|£\d+|GDPR certified|ISO 27001 certified|AI-powered/);
});

test("the signup intro and role explanation are translated in both non-English languages", () => {
  const copy = ["School and family, connected.", "The school manages the record. Parents read only the information the school chooses to share.", "Parents need a school invitation before any child information becomes available.", "This gives you the right first step after confirmation. Access to children is never automatic."];
  for (const language of ["pt", "es"]) for (const text of copy) assert.notEqual(translateUi(language,text),text);
});

test("open pilot onboarding has immediate school entry and support, not an approval promise", () => {
  const { PilotOnboarding } = onboarding("pt");
  const open = renderToStaticMarkup(React.createElement(PilotOnboarding, { initialRole: "school", demo: false, openSchoolPilot: true }));
  assert.match(open, /Abrir painel da escola/);
  assert.match(open, /sem aprovação manual/);
  assert.match(open, /mailto:hello@joinonecircle.com/);
  assert.doesNotMatch(open, /dias úteis|Solicitar acesso|prazo passou/);
  const closed = renderToStaticMarkup(React.createElement(PilotOnboarding, { initialRole: "school", demo: false, openSchoolPilot: false }));
  assert.match(closed, /até 2 dias úteis/);
  assert.match(closed, /mailto:hello@joinonecircle.com/);
  assert.match(closed, /Solicitar acesso da escola/);
});

test("verification fallback shows the confirmed deadline/contact, while a suspension never promises automatic reopening", () => {
  for (const language of ["en", "pt", "es"]) {
    const { SchoolVerificationNotice } = onboarding(language);
    const pending = renderToStaticMarkup(React.createElement(SchoolVerificationNotice));
    assert.match(pending, /mailto:hello@joinonecircle.com/);
    assert.match(pending, /(?:2 working days|2 dias úteis|2 días laborables)/);
    const paused = renderToStaticMarkup(React.createElement(SchoolVerificationNotice, { status: "suspended", openSchoolPilot: true }));
    assert.match(paused, /mailto:hello@joinonecircle.com/);
    assert.doesNotMatch(paused, /2 working days|2 dias úteis|2 días laborables/);
  }
});
