import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { createChild } from "./actions";
import { DemoChildren } from "./demo-children";
import { OpenDetailsButton } from "@/components/open-details-button";

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext();
  if (context.demo) return <DemoChildren />;
  const query = await searchParams;
  const isFamily = context.role === "family";
  const canCreateChild = isFamily && !context.demo;
  return <>
    <header className="workspace-header"><div><p className="eyebrow">AUTHORISED RECORDS</p><h1>{isFamily ? "Your children" : "Children you can access"}</h1><p>Each record is separate. You only see a child after the circle grants access.</p></div>{canCreateChild && <OpenDetailsButton targetId="add-child">+ Add child</OpenDetailsButton>}</header>
    {query.error && <p className="form-alert" role="alert">We could not complete that change. Please review the details and try again.</p>}
    {query.message && <p className="notice" role="status">The change was saved.</p>}
    {canCreateChild && <details className="panel add-child-panel" id="add-child" open><summary><span><b aria-hidden="true">+</b><strong>Add another child</strong><small>Each child has a separate private record.</small></span><span aria-hidden="true">⌄</span></summary><div><p>Only the minimum information is needed. Nothing is shared automatically.</p><form action={createChild} className="form-row"><label className="field">Child&apos;s preferred name<input name="child_name" required maxLength={120} /></label><label className="field">Date of birth <span>(optional)</span><input name="date_of_birth" type="date" /></label><button className="button button--small" type="submit">Create record</button></form></div></details>}
    <section className="record-grid">{context.children.length ? context.children.map((child) => <Link key={child.id} href={`/children/${child.id}`}><article><div className="record-card-top"><p className="eyebrow">AUTHORISED RECORD</p><span aria-hidden="true">→</span></div><h2>{child.preferred_name}</h2><p>{child.date_of_birth ? "Open the child record and shared next actions." : "Open the child record and add only what is needed."}</p></article></Link>) : <article className="panel"><h2>No child records yet</h2><p>{isFamily ? "Create the first private circle from onboarding, then add another child here when needed." : "A family or record administrator must invite you before a child appears here."}</p>{isFamily && <Link className="button button--small" href="/onboarding">Create first circle</Link>}</article>}</section>
  </>;
}
