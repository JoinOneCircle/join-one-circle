"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LanguageSelect } from "@/components/language-preference";
import { updateDemoState, useDemoState } from "@/lib/demo-store";

export function DemoAccountSettings() {
  const state = useDemoState();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name || name.length > 120) { setError("Enter a name of up to 120 characters."); return; }
    try {
      updateDemoState((current) => ({ ...current, profile_name: name }));
      setEditing(false); setError(""); setMessage("Profile saved.");
    } catch { setError("Your profile could not be saved."); }
  };
  return <>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <section className="settings-grid demo-settings-grid"><article className="panel"><h2>Your profile</h2>{editing ? <form className="inline-edit" onSubmit={save}><label className="field">Name<input name="name" defaultValue={state.profile_name} maxLength={120} required autoFocus /></label><button className="button button--small" type="submit">Save</button><button className="quiet-button" type="button" onClick={() => setEditing(false)}>Cancel</button></form> : <div className="settings-row"><span>Name</span><strong>{state.profile_name}</strong><button type="button" onClick={() => setEditing(true)}>Edit</button></div>}<div className="settings-row"><span>Language</span><div className="settings-language"><LanguageSelect ariaLabel="Tool language" /></div></div></article><article className="panel"><h2>Privacy &amp; security</h2><p>Review changes, restore previous record versions, manage access and data.</p><Link className="button button--small" href="/privacy">Open privacy center</Link></article></section>
  </>;
}
