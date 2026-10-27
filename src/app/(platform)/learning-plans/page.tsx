import { redirect } from "next/navigation";
import { getPlatformContext } from "@/lib/platform-data";
import { SchoolPilotWorkspace } from "@/components/pilot/school-workspace";
export default async function LearningPlansPage({ searchParams }: { searchParams: Promise<{ child?: string; plan?: string; template?: string }> }) {
  const context = await getPlatformContext();
  if (context.role !== "school") redirect("/dashboard");
  const query = await searchParams;
  return <SchoolPilotWorkspace key={`${query.child ?? "all"}-${query.plan ?? ""}-${query.template ?? ""}`} demo={context.demo} section="plans" initialChild={query.child} initialPlan={query.plan} initialTemplate={query.template} />;
}
