import Link from "next/link";

const items = [
  ["1", "Confirm My Circle", "Check who is currently authorised to see and contribute to each child record."],
  ["2", "Review next actions", "See what needs to happen, who owns it and when it is due."],
  ["3", "Add evidence safely", "Keep reports and contributions with the child record, not in scattered email threads."],
];

export default function Dashboard() {
  return <><header className="workspace-header"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Good morning</h1><p>Start with the children and actions that need your attention.</p></div><button className="profile">Account</button></header>
    <section className="notice"><b>This is a protected space.</b><span>Access is limited to children you are currently authorised to support.</span></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">START HERE</p><h2>One clear route forward</h2></div><Link href="/children/demo-child">Open child record</Link></div><div className="step-grid">{items.map(([number,title,copy]) => <article key={number}><i>{number}</i><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="panel empty"><p className="eyebrow">NEXT ACTIONS</p><h2>No live actions yet</h2><p>When the first child record is authorised, their next actions and statutory dates will appear here.</p></section>
  </>;
}
