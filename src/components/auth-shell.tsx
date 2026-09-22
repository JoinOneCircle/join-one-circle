import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function AuthShell({ children, title, copy }: { children: React.ReactNode; title: string; copy: string }) {
  return <main className="auth-shell">
    <section className="auth-intro"><BrandLogo light /><div className="auth-message"><p className="eyebrow eyebrow--light">ONE CHILD · ONE CONNECTED CIRCLE</p><h1>{title}</h1><p>{copy}</p></div><div className="auth-proof"><span>Authorised access</span><span>Private records</span><span>Clear audit history</span></div></section>
    <section className="auth-card-wrap"><div className="auth-card">{children}<p className="auth-switch"><Link href="/">← Back to website</Link></p></div></section>
  </main>;
}
