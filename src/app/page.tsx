import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSelect } from "@/components/language-preference";

const roles = [
  ["Families", "Tell your story once and keep every next step visible."],
  ["Schools & SENCOs", "Coordinate provision, evidence and reviews around the same record."],
  ["Professionals", "Contribute reports and recommendations without fragmented email chains."],
  ["Local Authorities", "Access clear, authorised information and a complete audit trail."],
];

const steps = [
  ["01", "Create the child’s circle", "Start with only the details needed now. You stay in control of who joins."],
  ["02", "Bring the right people together", "Invite family, school, professionals and the Local Authority with role-based access."],
  ["03", "Move forward with clarity", "See the record, documents, actions and progress together — with one clear next step."],
];

export default function Home() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <BrandLogo />
        <nav className="marketing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#who-it-is-for">Who it’s for</a>
          <a href="#circle-ai">Circle AI</a>
          <a href="#security">Security</a>
        </nav>
        <div className="header-actions">
          <label className="language-picker">
            <span className="sr-only">Language</span>
            <LanguageSelect />
          </label>
          <Link className="text-button" href="/login">Sign in</Link>
          <Link className="button button--small" href="/signup">Get started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">ONE CHILD · ONE RECORD · ONE CONNECTED CIRCLE</p>
          <h1>Everyone around a child, moving forward together.</h1>
          <p className="hero-intro">Join One Circle gives families, schools, professionals and Local Authorities one secure place to understand needs, coordinate support and keep progress visible.</p>
          <div className="hero-actions">
            <Link className="button" href="/signup">Create your circle <span className="link-chevron" aria-hidden="true">›</span></Link>
            <a className="button button--secondary" href="#how-it-works">See how it works</a>
          </div>
          <ul className="trust-list" aria-label="Platform assurances">
            <li>Authorised access</li><li>Clear audit history</li><li>Human-reviewed AI</li>
          </ul>
        </div>

        <div className="record-preview" aria-label="Example child record overview">
          <div className="preview-topline"><span className="status-dot" /> Child record protected <span>•••</span></div>
          <div className="child-summary"><div className="child-avatar">A</div><div><small>CHILD’S CIRCLE</small><h2>Alex’s support</h2><p>5 authorised people</p></div></div>
          <div className="next-step-card"><div><small>NEXT STEP</small><strong>Review school support outcomes</strong></div><span>Due in 4 days</span></div>
          <div className="preview-grid"><article><span>Needs</span><strong>6</strong><small>2 updated</small></article><article><span>Documents</span><strong>12</strong><small>All together</small></article><article><span>Actions</span><strong>3</strong><small>1 for you</small></article></div>
          <div className="circle-people"><span>Family</span><span>School</span><span>Professional</span><b>+2</b></div>
        </div>
      </section>

      <section className="value-strip" aria-label="Key benefits">
        <p><strong>Less repetition.</strong> Families tell their story once.</p><p><strong>Less searching.</strong> The latest record is always clear.</p><p><strong>Less uncertainty.</strong> Everyone can see the next action.</p>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-heading"><p className="eyebrow">HOW IT WORKS</p><h2>A calm, guided route from “where do I start?” to “we know what happens next.”</h2></div>
        <div className="steps-grid">{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="section section--tint" id="who-it-is-for">
        <div className="section-heading section-heading--split"><div><p className="eyebrow">ONE CONNECTED CIRCLE</p><h2>Built for every person authorised to support the child.</h2></div><p>Each role gets a focused view, the right permissions and a clear next action — without a feed, groups or unnecessary noise.</p></div>
        <div className="role-grid">{roles.map(([title, copy], index) => <article key={title}><i>{index + 1}</i><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="section ai-section" id="circle-ai">
        <div className="ai-orbit" aria-hidden="true"><span>AI</span></div>
        <div><p className="eyebrow eyebrow--light">CIRCLE AI</p><h2>Help grounded in the child’s authorised record.</h2><p>Explain a document, prepare a letter or turn scattered information into a reviewed draft. Circle AI uses only information the person is allowed to access and never sends or changes anything without human approval.</p><Link className="button button--light" href="/signup">Start securely</Link></div>
      </section>

      <section className="section security-section" id="security">
        <div><p className="eyebrow">SECURITY FROM THE START</p><h2>Privacy is part of the product, not a setting added later.</h2></div>
        <div className="security-points"><p><strong>Role-based access</strong><span>People see only the children and information they are authorised to support.</span></p><p><strong>Consent and audit trail</strong><span>Access and important record changes remain visible and accountable.</span></p><p><strong>Protected documents</strong><span>Private storage and secure links keep sensitive files out of public spaces.</span></p></div>
      </section>

      <section className="final-cta"><BrandLogo compact light /><h2>Ready to bring the right people together?</h2><p>Create one secure circle around the child and make the next step clear.</p><Link className="button button--light" href="/signup">Create your circle</Link></section>
      <footer className="marketing-footer"><BrandLogo /><p>Secure, clear SEND coordination for every authorised person around the child.</p><div><a href="#security">Security</a><Link href="/login">Sign in</Link></div><small>© 2026 Join One Circle. Guidance does not replace legal advice.</small></footer>
    </main>
  );
}
