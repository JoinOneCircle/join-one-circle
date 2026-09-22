import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type AppIconName } from "@/components/app-icon";
import { getPlatformContext, type ViewerRole } from "@/lib/platform-data";
import { WorkspaceModuleClient } from "./workspace-module-client";
import { SchoolWorkspaceClient, type SchoolWorkspaceItem } from "./school-workspace-client";

type Module = { icon: AppIconName; eyebrow: string; title: string; intro: string; cta: string; rows: [string, string, string][] };
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

export default async function WorkspaceModule({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleId } = await params;
  const view = modules[moduleId];
  if (!view) notFound();
  const context = await getPlatformContext();
  const allowedRoles: Record<string, ViewerRole[]> = {
    "send-register": ["school"], plans: ["school"], "ehcp-tracker": ["school"], provision: ["school"], reviews: ["school"], team: ["school"],
    caseload: ["professional"], requests: ["professional"], cases: ["local_authority"], consultations: ["local_authority"], deadlines: ["local_authority"], decisions: ["local_authority"],
    reports: ["school", "local_authority"], audit: ["local_authority"],
  };
  if (!allowedRoles[moduleId]?.includes(context.role)) redirect("/dashboard");
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
