import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { DemoPrivacyCenter } from "./demo-privacy-center";

export default async function PrivacyPage() {
  const context = await getPlatformContext();
  if (context.demo) return <DemoPrivacyCenter />;
  return <><header className="workspace-header"><div><p className="eyebrow">PRIVACY & SECURITY</p><h1>Your data and access</h1><p>Changes to a child&apos;s live record are protected by the connected account and its authorisation rules.</p></div></header><section className="panel"><h2>Manage access</h2><p>Use My Circle to review the people and record areas shared with each child. Account export, erasure and retention require a verified request and are not automated in this release.</p><Link className="button button--small" href="/my-circle">Open My Circle</Link></section></>;
}
