"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSelect } from "@/components/language-preference";
import { updateProfile } from "./actions";
import { MfaSettings } from "./mfa-settings";

export function AccountSettings({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  return <section className="settings-grid"><article className="panel"><h2>Your profile</h2>{editing ? <form className="inline-edit" action={updateProfile}><label className="field">Name<input name="name" defaultValue={name} maxLength={120} required autoFocus /></label><button className="button button--small" type="submit">Save</button><button className="quiet-button" type="button" onClick={() => setEditing(false)}>Cancel</button></form> : <div className="settings-row"><span>Name</span><strong>{name}</strong><button type="button" onClick={() => setEditing(true)}>Edit</button></div>}<div className="settings-row"><span>Language</span><div className="settings-language"><LanguageSelect ariaLabel="Tool language" /></div></div></article><article className="panel"><h2>Security</h2><div className="settings-row settings-row--password"><span>Password</span><div><strong>Managed securely by your account</strong><small>Forgot your password? We will email a secure reset link.</small></div><Link href="/forgot-password">Change or reset password</Link></div><MfaSettings /></article></section>;
}
