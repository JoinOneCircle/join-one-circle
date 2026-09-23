import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type AppIconName } from "@/components/app-icon";
import { getPlatformContext, type ViewerRole } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WorkspaceModuleClient } from "./workspace-module-client";
import { SchoolWorkspaceClient, type SchoolWorkspaceItem } from "./school-workspace-client";
import { InstitutionalWorkspace, type InstitutionalChild, type InstitutionalModule, type InstitutionalWorkspaceItem } from "./institutional-workspace";
import { InstitutionalLiveProjections, type LiveProjection } from "./institutional-live-projections";

type Module = { icon: AppIconName; eyebrow: string; title: string; intro: string; cta: string; rows: [string, string, string][] };
type OrganisationMembership = { role: string; membership_status: string; organisations: { organisation_type: string; verification_status: string } | null };
const modules: Record<string, Module> = {
  "send-register": { icon: "register", eyebrow: "SCHOOL", title: "SEND register", intro: "A whole-school view of needs, support level, goals and current risk.", cta: "Add pupil", rows: [["Alex Morgan", "EHCP · Communication", "Review due"], ["Maya Patel", "SEN support · Cognition", "On track"], ["Sam Jones", "Monitoring · SEMH", "Action needed"]] },
  plans: { icon: "plans", eyebrow: "ASSESS · PLAN · DO · REVIEW", title: "Plans and APDR", intro: "Keep needs, outcomes, provision, delivery evidence and reviews connected.", cta: "Create plan", rows: [["Alex Morgan", "Autumn support plan", "Review due"], ["Maya Patel", "Spring APDR cycle", "In progress"], ["Sam Jones", "Initial assessment", "Draft"]] },
  "ehcp-tracker": { icon: "ehcp", eyebrow: "STATUTORY JOURNEY", title: "EHCP tracker", intro: "See requests, consultations, deadlines, plan versions and next ownership in one place.", cta: "Start request", rows: [["JOC-1048", "EHC needs assessment", "Week 5 of 6"], ["JOC-1039", "Draft plan review", "Parent response due"], ["JOC-1027", "Annual review", "LA decision due"]] },
  provision: { icon: "provision", eyebrow: "DELIVERY", title: "Provision and timetable", intro: "Plan interventions, assign staff, record delivery and see gaps before they become missed support.", cta: "Add provision", rows: [["Speech and language", "Tuesday · 10:00", "Cover needed"], ["Literacy intervention", "Monday / Thursday", "Delivered"], ["Regulation check-in", "Daily", "Assigned"]] },
  reviews: { icon: "reviews", eyebrow: "REVIEW", title: "Reviews", intro: "Prepare evidence, collect contributions and keep outcomes linked to the plan.", cta: "Schedule review", rows: [["Alex Morgan", "Annual review", "Evidence due today"], ["Maya Patel", "APDR review", "4 days"], ["Sam Jones", "Initial review", "12 days"]] },
  reports: { icon: "reports", eyebrow: "IMPACT", title: "Reports", intro: "Understand progress, provision delivery, deadlines and workload without rebuilding spreadsheets.", cta: "Create report", rows: [["Provision delivery", "This term", "96%"], ["Reviews completed", "This month", "12"], ["Open statutory actions", "Current", "6"]] },
  team: { icon: "team", eyebrow: "ACCESS", title: "Team and permissions", intro: "Give each member only the access needed for their responsibilities.", cta: "Invite team member", rows: [["Helen Wright", "SENCO", "Administrator"], ["Mark Lee", "Teaching assistant", "Provision only"], ["Sara Khan", "DSL", "Safeguarding only"]] },
  caseload: { icon: "caseload", eyebrow: "PROFESSIONAL", title: "Authorised caseload", intro: "Only children whose circle has granted your organisation active access appear here.", cta: "View invitations", rows: [["Alex Morgan", "Communication assessment", "Active"], ["Maya Patel", "OT recommendations", "Report due"], ["Sam Jones", "Observation", "Invitation pending"]] },
  requests: { icon: "requests", eyebrow: "CONTRIBUTIONS", title: "Requests", intro: "Respond to focused requests without receiving an entire child record.", cta: "Filter requests", rows: [["Alex Morgan", "Communication recommendations", "Due today"], ["Maya Patel", "Reviewed assessment", "3 days"], ["Sam Jones", "Attendance confirmation", "6 days"]] },
  cases: { icon: "caseload", eyebrow: "LOCAL AUTHORITY", title: "Cases", intro: "A prioritised view of active cases and the record areas authorised for your team.", cta: "Add case", rows: [["JOC-1048", "EHC needs assessment", "Priority"], ["JOC-1039", "Draft plan", "In review"], ["JOC-1027", "Annual review decision", "Due"]] },
  consultations: { icon: "requests", eyebrow: "LOCAL AUTHORITY", title: "Consultations", intro: "Track requests, responses, capacity and evidence without scattered email chains.", cta: "Add consultation", rows: [["JOC-1048", "Mainstream placement", "Response due today"], ["JOC-1041", "Specialist provision", "4 responses"], ["JOC-1035", "Health advice", "Waiting"]] },
  deadlines: { icon: "reviews", eyebrow: "STATUTORY", title: "Statutory deadlines", intro: "See approaching dates, ownership and evidence gaps before deadlines are missed.", cta: "Export schedule", rows: [["JOC-1048", "Consultation response", "Today"], ["JOC-1039", "Issue final plan", "2 days"], ["JOC-1027", "Decision letter", "3 days"]] },
  decisions: { icon: "decisions", eyebrow: "GOVERNANCE", title: "Decisions", intro: "Record rationale, evidence used, approval and communication as an auditable chain.", cta: "Record decision", rows: [["JOC-1027", "Maintain EHCP", "Awaiting approval"], ["JOC-1021", "Amend plan", "Approved"], ["JOC-1018", "Assessment agreed", "Communicated"]] },
  audit: { icon: "audit", eyebrow: "SECURITY", title: "Audit history", intro: "A clear record of access, contributions, approvals and sharing events.", cta: "Export audit", rows: [["09:42", "Document viewed", "JOC-1048"], ["09:18", "Permission changed", "JOC-1039"], ["Yesterday", "Decision approved", "JOC-1027"]] },
};

const persistentModules = new Set<InstitutionalModule>([
  "send-register", "plans", "ehcp-tracker", "provision", "reviews", "reports", "team",
  "caseload", "requests", "cases", "consultations", "deadlines", "decisions", "audit",
]);

type LiveRecord = { id: string; child_id: string; record_area: string; title: string; updated_at: string };
type LiveDocument = { id: string; child_id: string; title: string; category: string; created_at: string };
type LiveAction = { id: string; child_id: string; title: string; status: string; due_at: string | null; updated_at: string };
type LiveEvent = { id: string; child_id: string; title: string; starts_at: string; status: string };
type LiveConfirmation = { document_id: string; confirmed_at: string };
type LiveNotification = { id: string; child_id: string | null; title: string; body: string; created_at: string };
type LiveAudit = { id: string; child_id: string | null; event_type: string; entity_type: string; created_at: string };
type LiveMember = { user_id: string; child_id: string; role: string; status: string; display_name: string | null };

const moduleAreas: Partial<Record<InstitutionalModule, string[]>> = {
  "send-register": ["need"], plans: ["outcome", "provision", "review"], "ehcp-tracker": ["ehcp", "review"], provision: ["provision", "delivery"],
  reviews: ["review", "progress"], caseload: ["evidence", "progress"], requests: ["evidence"], cases: ["ehcp", "review"], consultations: ["ehcp", "review"], decisions: ["review"],
};

function workspaceLiveRows(moduleId: InstitutionalModule, source: {
  records: LiveRecord[]; documents: LiveDocument[]; actions: LiveAction[]; events: LiveEvent[]; confirmations: LiveConfirmation[]; notifications: LiveNotification[]; audits: LiveAudit[]; members: LiveMember[];
}) {
  const rows: LiveProjection[] = [];
  const addRecords = (areas: string[]) => source.records.filter((item) => areas.includes(item.record_area)).forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "record", title: item.title, detail: item.record_area.replaceAll("_", " "), at: item.updated_at }));
  const addDocuments = () => source.documents.forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "document", title: item.title, detail: item.category, at: item.created_at }));
  const addActions = () => source.actions.forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "action", title: item.title, detail: item.status.replaceAll("_", " "), at: item.due_at ?? item.updated_at }));
  const addEvents = () => source.events.filter((item) => item.status === "scheduled").forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "event", title: item.title, detail: "Scheduled", at: item.starts_at }));
  const addNotifications = () => source.notifications.forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "notification", title: item.title, detail: item.body, at: item.created_at }));
  const addAudit = () => source.audits.forEach((item) => rows.push({ id: item.id, childId: item.child_id, kind: "audit", title: item.event_type.replaceAll("_", " "), detail: item.entity_type.replaceAll("_", " "), at: item.created_at }));

  if (moduleId === "reports") addDocuments();
  else if (moduleId === "team") source.members.forEach((item) => rows.push({ id: `${item.child_id}-${item.user_id}`, childId: item.child_id, kind: "member", title: item.display_name ?? "Authorised person", detail: `${item.role.replaceAll("_", " ")} · ${item.status}`, at: null }));
  else if (moduleId === "audit") addAudit();
  else if (moduleId === "deadlines") { addEvents(); addActions(); }
  else if (moduleId === "requests") { addDocuments(); addNotifications(); }
  else if (moduleId === "reviews") { addRecords(moduleAreas[moduleId] ?? []); addEvents(); }
  else if (moduleId === "consultations") { addRecords(moduleAreas[moduleId] ?? []); addEvents(); addDocuments(); }
  else {
    addRecords(moduleAreas[moduleId] ?? []);
    if (["provision", "caseload", "cases"].includes(moduleId)) addActions();
    if (["caseload", "cases", "ehcp-tracker", "decisions"].includes(moduleId)) addDocuments();
  }
  const confirmationDocumentIds = new Set(source.confirmations.map((item) => item.document_id));
  if (["requests", "decisions"].includes(moduleId)) source.documents.filter((item) => confirmationDocumentIds.has(item.id)).forEach((item) => rows.push({ id: `confirmation-${item.id}`, childId: item.child_id, kind: "confirmation", title: `${item.title} confirmed`, detail: "A circle member has acknowledged this document", at: item.created_at }));
  return rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 12);
}

function organisationCanUseModule(membership: OrganisationMembership, moduleId: string) {
  const organisation = membership.organisations;
  if (membership.membership_status !== "active" || organisation?.verification_status !== "verified") return false;
  if (["send-register", "plans", "ehcp-tracker", "provision", "reviews", "team"].includes(moduleId)) return organisation.organisation_type === "school";
  if (moduleId === "reports") return ["school", "local_authority"].includes(organisation.organisation_type);
  if (["caseload", "requests"].includes(moduleId)) return organisation.organisation_type === "professional_practice";
  return organisation.organisation_type === "local_authority";
}

export default async function WorkspaceModule({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { module: moduleId } = await params;
  const query = await searchParams;
  const view = modules[moduleId];
  if (!view) notFound();
  const context = await getPlatformContext();
  const allowedRoles: Record<string, ViewerRole[]> = {
    "send-register": ["school"], plans: ["school"], "ehcp-tracker": ["school"], provision: ["school"], reviews: ["school"], team: ["school"],
    caseload: ["professional"], requests: ["professional"], cases: ["local_authority"], consultations: ["local_authority"], deadlines: ["local_authority"], decisions: ["local_authority"],
    reports: ["school", "local_authority"], audit: ["local_authority"],
  };
  if (!allowedRoles[moduleId]?.includes(context.role)) redirect("/dashboard");
  // The core operational workspaces are backed by tenant-scoped Supabase rows.
  // Demo keeps its isolated browser experience, while a live account never
  // falls back to static names or localStorage.
  if (!context.demo && persistentModules.has(moduleId as InstitutionalModule)) {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase!.auth.getUser();
    if (!auth.user) redirect(`/login?next=/workspace/${moduleId}`);
    const [{ data: children }, { data: items }, { data: memberships }, { data: records }, { data: documents }, { data: actions }, { data: events }, { data: confirmations }, { data: notifications }, { data: audits }, { data: members }] = await Promise.all([
      supabase!.rpc("list_workspace_children", { p_module: moduleId }),
      supabase!.from("institutional_workspace_items").select("id, child_id, title, summary, due_on, status, created_by, linked_record_item_id").eq("workspace_module", moduleId).order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase!.from("organisation_memberships").select("role, membership_status, organisations(organisation_type, verification_status)").eq("user_id", auth.user.id),
      supabase!.from("child_record_items").select("id, child_id, record_area, title, updated_at").order("updated_at", { ascending: false }).limit(80),
      supabase!.from("child_documents").select("id, child_id, title, category, created_at").order("created_at", { ascending: false }).limit(80),
      supabase!.from("child_actions").select("id, child_id, title, status, due_at, updated_at").order("updated_at", { ascending: false }).limit(80),
      supabase!.from("child_events").select("id, child_id, title, starts_at, status").order("starts_at", { ascending: true }).limit(80),
      supabase!.from("child_document_confirmations").select("document_id, confirmed_at").order("confirmed_at", { ascending: false }).limit(80),
      supabase!.from("notifications").select("id, child_id, title, body, created_at").order("created_at", { ascending: false }).limit(80),
      supabase!.from("audit_events").select("id, child_id, event_type, entity_type, created_at").not("child_id", "is", null).order("created_at", { ascending: false }).limit(80),
      supabase!.rpc("list_visible_circle_members"),
    ]);
    const liveChildren = (children ?? []) as InstitutionalChild[];
    const liveItems = (items ?? []) as InstitutionalWorkspaceItem[];
    const childNames = new Map<string, string>([...liveChildren, ...context.children].map((child) => [child.id, child.preferred_name]));
    const liveRows = workspaceLiveRows(moduleId as InstitutionalModule, {
      records: (records ?? []) as LiveRecord[], documents: (documents ?? []) as LiveDocument[], actions: (actions ?? []) as LiveAction[], events: (events ?? []) as LiveEvent[],
      confirmations: (confirmations ?? []) as LiveConfirmation[], notifications: (notifications ?? []) as LiveNotification[], audits: (audits ?? []) as LiveAudit[], members: (members ?? []) as LiveMember[],
    });
    const workspaceReady = ((memberships ?? []) as unknown as OrganisationMembership[]).some((membership) => organisationCanUseModule(membership, moduleId));
    return <>
      <header className="workspace-header"><div><p className="eyebrow">{view.eyebrow}</p><h1>{view.title}</h1><p>{view.intro}</p></div><Link className="profile" href="/dashboard">Dashboard</Link></header>
      <InstitutionalLiveProjections moduleId={moduleId as InstitutionalModule} rows={liveRows} childNames={childNames} openableChildIds={new Set([...liveChildren, ...context.children].filter((child) => child.can_open_record !== false).map((child) => child.id))} />
      <InstitutionalWorkspace moduleId={moduleId as InstitutionalModule} title={view.title} icon={view.icon} childList={liveChildren} sharedChildren={context.children.map((child) => ({ id: child.id, preferred_name: child.preferred_name, can_contribute: false, can_open_record: child.can_open_record ?? true }))} items={liveItems} canContribute={liveChildren.some((child) => child.can_contribute)} workspaceReady={workspaceReady} userId={auth.user.id} error={query.error} message={query.message} />
    </>;
  }
  if (moduleId === "send-register" || moduleId === "plans") {
    const initialItems: SchoolWorkspaceItem[] = moduleId === "send-register"
      ? [
        { id: "send-alex", pupil: "Alex Morgan", type: "EHCP", focus: "Communication", reviewDate: "2026-10-02", status: "Review due" },
        { id: "send-maya", pupil: "Maya Patel", type: "SEN support", focus: "Cognition", reviewDate: "2026-10-16", status: "On track" },
        { id: "send-sam", pupil: "Sam Jones", type: "Monitoring", focus: "SEMH", reviewDate: "2026-09-28", status: "Action needed" },
      ]
      : [
        { id: "plan-alex", pupil: "Alex Morgan", type: "APDR cycle", focus: "Communication and classroom participation", reviewDate: "2026-10-02", owner: "SENCO", status: "Review due" },
        { id: "plan-maya", pupil: "Maya Patel", type: "Support plan", focus: "Working-memory strategies", reviewDate: "2026-10-16", owner: "Class teacher", status: "In progress" },
        { id: "plan-sam", pupil: "Sam Jones", type: "APDR cycle", focus: "Regulation and attendance", reviewDate: "2026-09-28", owner: "Pastoral lead", status: "Draft" },
      ];
    return <><header className="workspace-header"><div><p className="eyebrow">{view.eyebrow}</p><h1>{view.title}</h1><p>{view.intro}</p></div><Link className="profile" href="/dashboard">Dashboard</Link></header><SchoolWorkspaceClient moduleId={moduleId} title={view.title} icon={view.icon} cta={view.cta} initialItems={initialItems} /></>;
  }
  return <><header className="workspace-header"><div><p className="eyebrow">{view.eyebrow}</p><h1>{view.title}</h1><p>{view.intro}</p></div><Link className="profile" href="/dashboard">Dashboard</Link></header>
    <WorkspaceModuleClient moduleId={moduleId} icon={view.icon} title={view.title} cta={view.cta} initialRows={view.rows.map(([record, stage, status], index) => ({ id: `${moduleId}-${index}`, record, stage, status }))} />
  </>;
}
