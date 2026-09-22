import { CircleAiChat } from "./circle-ai-chat";
import { getPlatformContext } from "@/lib/platform-data";

export default async function CircleAiPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const context = await getPlatformContext();
  const requestedChildId = (await searchParams).child;
  const authorisedChild = context.children.find((child) => child.id === requestedChildId) ?? context.children[0] ?? { id: "demo-child", preferred_name: "Authorised child" };
  // Demo records live in the browser, so the client component validates the
  // requested id against its local sample state before using it.
  const childId = context.demo && requestedChildId ? requestedChildId : authorisedChild.id;
  return <><header className="workspace-header"><div><p className="eyebrow">CIRCLE AI</p><h1>What can we make clearer?</h1><p>Explain information, prepare drafts and find the next action using only the authorised record.</p></div><a className="profile" href="#conversation-history">Current conversation</a></header><CircleAiChat childId={childId} childName={authorisedChild.preferred_name} viewerRole={context.role} demo={context.demo} /></>;
}
