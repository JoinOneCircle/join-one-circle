"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { demoId, updateDemoState, useDemoState } from "@/lib/demo-store";

export function DemoChildren() {
  const state = useDemoState();
  const router = useRouter();
  const [error, setError] = useState("");
  const formPanel = useRef<HTMLDetailsElement>(null);
  const addChild = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("child_name") ?? "").trim();
    const dateOfBirth = String(data.get("date_of_birth") ?? "") || null;
    if (!name || name.length > 120) { setError("Enter a preferred name of up to 120 characters."); return; }
    const id = demoId();
    try {
      updateDemoState((current) => ({ ...current, children: [...current.children, { id, preferred_name: name, date_of_birth: dateOfBirth }] }));
      setError("");
      form.reset();
      router.push(`/children/${id}`);
    } catch { setError("This record could not be saved. Please try again."); }
  };
  return <>
    <header className="workspace-header"><div><p className="eyebrow">YOUR CHILDREN</p><h1>Your children</h1><p>Keep a separate record for every child you support.</p></div><button className="button button--small" type="button" onClick={() => { if (formPanel.current) { formPanel.current.open = true; formPanel.current.scrollIntoView({ behavior: "smooth", block: "start" }); formPanel.current.querySelector("input")?.focus(); } }}>+ Add child</button></header>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <details className="panel add-child-panel" ref={formPanel}><summary><span><b aria-hidden="true">+</b><strong>Add another child</strong><small>Each child has a separate record.</small></span><span aria-hidden="true">⌄</span></summary><div><form onSubmit={addChild} className="form-row"><label className="field">Child&apos;s preferred name<input name="child_name" required maxLength={120} /></label><label className="field">Date of birth <span>(optional)</span><input name="date_of_birth" type="date" /></label><button className="button button--small" type="submit">Create record</button></form></div></details>
    <section className="record-grid">{state.children.length ? state.children.map((child) => <Link key={child.id} href={`/children/${child.id}`}><article><div className="record-card-top"><p className="eyebrow">CHILD RECORD</p><span aria-hidden="true">→</span></div><h2>{child.preferred_name}</h2><p>Open this child&apos;s record.</p></article></Link>) : <article className="panel"><h2>No children yet</h2><p>Add a child above to create the first record.</p></article>}</section>
  </>;
}
