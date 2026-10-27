import { redirect } from "next/navigation";
import { getPlatformContext } from "@/lib/platform-data";
export default async function ParentAccessPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const context = await getPlatformContext();
  if (context.role !== "school") redirect("/dashboard");
  const child = (await searchParams).child;
  redirect(child ? `/children?child=${encodeURIComponent(child)}&tab=parents` : "/children");
}
