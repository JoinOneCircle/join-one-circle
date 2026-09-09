import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="topbar"><b>join one circle</b><span>Secure SEND platform</span><Link href="/dashboard">Open prototype</Link></nav>
      <section className="hero">
        <p className="eyebrow">ONE CHILD. ONE RECORD. ONE CONNECTED CIRCLE.</p>
        <h1>Everyone supporting a child, working from the same trusted record.</h1>
        <p>For families, schools, SENCOs, professionals and Local Authorities - with authorised access, clearer action and less repetition.</p>
        <Link className="primary" href="/dashboard">View the first workspace</Link>
      </section>
      <section className="principles">
        <article><strong>One child record</strong><span>Needs, outcomes, provision, evidence, progress and next actions in one place.</span></article>
        <article><strong>Access that follows consent</strong><span>Every person sees only the children and information they have been authorised to support.</span></article>
        <article><strong>Circle AI, with review</strong><span>Helpful drafts from authorised information - never automatic decisions or silent record changes.</span></article>
      </section>
    </main>
  );
}
