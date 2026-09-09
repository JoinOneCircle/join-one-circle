const sections = ["Passport", "Needs", "Outcomes", "Provision", "Evidence", "Progress", "Reviews", "Documents", "My Circle"];

export default async function ChildRecord({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return <><header className="workspace-header"><div><p className="eyebrow">CHILD RECORD · PROTOTYPE</p><h1>Child record</h1><p>Record ID: {childId}. Live child data is not shown until Supabase access controls are configured.</p></div><button className="profile">My Circle</button></header>
    <section className="golden-thread"><span>Need</span><b>→</b><span>Outcome</span><b>→</b><span>Provision</span><b>→</b><span>Delivery</span><b>→</b><span>Evidence</span><b>→</b><span>Review</span><b>→</b><span>Next action</span></section>
    <section className="record-grid">{sections.map((section) => <article key={section}><p className="eyebrow">AUTHORISED RECORD</p><h2>{section}</h2><p>This section is intentionally empty in the prototype. It will be loaded only after the server confirms the viewer has active access.</p></article>)}</section>
  </>;
}
