import Link from "next/link";
import { getChildRecord, getPlatformContext } from "@/lib/platform-data";
import { createRecordItem, deleteChild, deleteRecordItem, updateChild } from "../actions";
import { DemoChildRecord } from "./demo-child-record";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";

const sections = [
  ["Passport", "Who the child is, how they communicate and what matters to them.", "passport"],
  ["Needs", "Strengths and needs described consistently across the circle.", "need"],
  ["Outcomes", "The changes everyone is working towards together.", "outcome"],
  ["Provision", "Support agreed, who provides it and how often.", "provision"],
  ["Evidence", "Reports, observations and contributions linked to the record.", "evidence"],
  ["Progress", "Visible updates against outcomes and provision.", "progress"],
  ["Reviews", "Meetings, decisions and the next review date.", "review"],
  ["Documents", "Secure files, letters and templates.", "documents"],
  ["My Circle", "People, roles, consent and access.", "circle"],
] as const;

type RecordItem = { id: string; record_area: string; title: string; body: unknown; updated_at: string };
const itemSummary = (body: unknown) => typeof body === "object" && body && "summary" in body && typeof (body as { summary?: unknown }).summary === "string" ? (body as { summary: string }).summary : "";

export default async function ChildRecord({ params, searchParams }: { params: Promise<{ childId: string }>; searchParams: Promise<{ area?: string; error?: string; message?: string }> }) {
  const { childId } = await params;
  const query = await searchParams;
  if ((await getPlatformContext()).demo) return <DemoChildRecord childId={childId} area={query.area} />;
  const { child, items } = await getChildRecord(childId);
  const activeArea = sections.some(([, , area]) => area === query.area) ? query.area! : null;
  const activeSection = sections.find(([, , area]) => area === activeArea);
  const activeItems = activeArea ? (items as RecordItem[]).filter((item) => item.record_area === activeArea) : [];
  const areasWithContent = new Set(items.map((item) => item.record_area));
  const startingAreas = new Set(["passport", "documents", "circle"]);
  const primarySections = sections.filter(([, , area]) => startingAreas.has(area));
  const additionalSections = sections.filter(([, , area]) => !startingAreas.has(area));
  const recordLink = (area: string) => area === "documents" ? "/documents" : area === "circle" ? "/my-circle" : `/children/${childId}?area=${area}`;
  return <>
    <header className="workspace-header"><div><p className="eyebrow">AUTHORISED CHILD RECORD</p><h1>{child.preferred_name}&apos;s circle</h1><p>Start with one small step. You can return and add more whenever you are ready.</p></div><Link className="profile" href="/children">My children</Link></header>
    {query.error && <p className="form-alert" role="alert">We could not save that change. Check your permissions and try again.</p>}
    {query.message && <p className="notice" role="status">Your change has been saved in the authorised record.</p>}
    <section className="record-next-step"><div><p className="eyebrow">START HERE</p><h2>What would help most today?</h2><p>You do not need to fill in every part of the record.</p></div><Link className="button" href={`/circle-ai?child=${encodeURIComponent(childId)}`}>Ask Circle AI</Link></section>
    <section className="record-start-grid">{primarySections.map(([section, copy, area]) => <Link key={section} href={recordLink(area)} data-selected={activeArea === area || undefined}><article><div className="record-card-top"><p className="eyebrow">{areasWithContent.has(area) ? "IN PROGRESS" : "READY TO START"}</p><span aria-hidden="true">→</span></div><h2>{section === "Passport" ? <><span>Tell us about</span> {child.preferred_name}</> : section}</h2><p>{section === "Passport" ? "Add only what will help people understand your child." : copy}</p></article></Link>)}</section>
    <details className="record-more"><summary><span>See more parts of the child record</span><small>Choose a section to open and add information</small></summary><p>You can use these when they are useful. Nothing needs to be completed all at once.</p><div className="record-grid">{additionalSections.map(([section, copy, area]) => <Link key={section} href={`${recordLink(area)}#record-area`} data-selected={activeArea === area || undefined}><article><div className="record-card-top"><p className="eyebrow">{areasWithContent.has(area) ? "IN PROGRESS" : "READY TO START"}</p><span aria-hidden="true">→</span></div><h2>{section}</h2><p>{copy}</p><strong className="card-action">Open section <span aria-hidden="true">›</span></strong></article></Link>)}</div></details>
    <details className="record-route"><summary>See how the support pathway fits together</summary><div className="golden-thread"><span>Need</span><b>→</b><span>Outcome</span><b>→</b><span>Provision</span><b>→</b><span>Delivery</span><b>→</b><span>Evidence</span><b>→</b><span>Review</span><b>→</b><span>Next action</span></div></details>
    {activeArea && activeSection && <section className="panel record-editor" id="record-area">
      <div className="panel-title"><div><p className="eyebrow">{activeArea.toUpperCase()}</p><h2>{activeSection[0]}</h2><p>{activeSection[1]}</p></div></div>
      {activeItems.length ? <div className="record-item-list">{activeItems.map((item) => <article key={item.id}><div><h3>{item.title}</h3>{itemSummary(item.body) && <p>{itemSummary(item.body)}</p>}<small>Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.updated_at))}</small></div><ConfirmDeleteForm action={deleteRecordItem} values={{ child_id: childId, item_id: item.id, record_area: activeArea }} itemName={item.title} itemType="record update" triggerClassName="quiet-button" /></article>)}</div> : <p className="empty-filter">Nothing has been added to this area yet.</p>}
      <form className="quick-create" action={createRecordItem}><input type="hidden" name="child_id" value={childId} /><input type="hidden" name="record_area" value={activeArea} /><label className="field">Title<input name="title" maxLength={200} required /></label><label className="field">Summary<textarea name="summary" rows={3} /></label><button className="button button--small" type="submit">Save to record</button></form>
    </section>}
    <section className="panel record-admin"><h2>Child details</h2><form action={updateChild} className="form-row"><input type="hidden" name="child_id" value={childId} /><label className="field">Preferred name<input name="child_name" defaultValue={child.preferred_name} maxLength={120} required /></label><label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue={child.date_of_birth ?? ""} /></label><button className="quiet-button" type="submit">Save details</button></form><ConfirmDeleteForm action={deleteChild} values={{ child_id: childId }} itemName={`${child.preferred_name}'s child record`} itemType="child record" triggerLabel="Delete child record" /></section>
  </>;
}
