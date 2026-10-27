import { getPlatformContext } from "@/lib/platform-data";
import { ParentPortal } from "@/components/pilot/parent-portal";
export default async function ParentPage({ searchParams }: { searchParams: Promise<{ recipient?: string; child?: string }> }) {
  const context = await getPlatformContext();
  const query = await searchParams;
  // An existing staff/professional account may also accept a parent invitation.
  // The parent RPC still decides its exact access; the URL grants nothing.
  const schoolPreview = context.role === "school" && !(query.child && !query.recipient);
  return <ParentPortal demo={context.demo} schoolPreview={schoolPreview} initialChild={query.child} initialRecipient={context.role === "school" || context.demo ? query.recipient : undefined} />;
}
