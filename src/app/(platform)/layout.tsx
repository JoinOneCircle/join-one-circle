import Link from "next/link";

export default function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/">join one circle</Link><p>YOUR SECURE SEND SPACE</p><nav><Link href="/dashboard">Today</Link><Link href="/children/demo-child">Children</Link><a href="#">Actions</a><a href="#">Documents</a><a href="#">Circle AI</a></nav><div className="privacy-note">Only authorised people can access a child&apos;s record.</div></aside>
    <main className="workspace">{children}</main>
  </div>;
}
