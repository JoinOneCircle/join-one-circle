import { redirect } from "next/navigation";
import { getPlatformContext } from "@/lib/platform-data";
import { DataImportPreview } from "./data-import-preview";

export default async function DataImportPage() {
  const context = await getPlatformContext();
  if (context.role !== "school") redirect("/dashboard");
  return <>
    <header className="workspace-header"><div><p className="eyebrow">SCHOOL SETUP</p><h1>Import pupil list</h1><p>Check a simple spreadsheet before adding anything to the SEND register.</p></div></header>
    <DataImportPreview />
  </>;
}
