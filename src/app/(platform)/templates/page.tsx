import { redirect } from "next/navigation";
import { getPlatformContext } from "@/lib/platform-data";
import { SchoolPilotWorkspace } from "@/components/pilot/school-workspace";
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const context = await getPlatformContext();
  if (context.role !== "school") redirect("/dashboard");
  const query = await searchParams;
  return <SchoolPilotWorkspace key={query.child ?? "templates"} demo={context.demo} section="templates" initialChild={query.child} />;
}
