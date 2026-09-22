"use client";

import { useState } from "react";

export function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: "current-password" | "new-password" }) {
  const [visible, setVisible] = useState(false);
  return <label className="field">{label}<span className="password-input"><input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? "Hide" : "Show"}</button></span>{autoComplete === "new-password" && <span className="field-hint">Use at least 8 characters. A password manager is recommended.</span>}</label>;
}
