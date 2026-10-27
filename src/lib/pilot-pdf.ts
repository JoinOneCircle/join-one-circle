import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PilotPlan } from "./pilot-model";
import { validateSignature } from "./pilot-signature.ts";
import { readTable } from "./pilot-table.ts";

// The PDF is generated only from a persisted version, never the live profile.
// A recorded school signature is not a cryptographic PDF signing certificate.
export async function renderPilotPdf(plan: PilotPlan, version = 1): Promise<Uint8Array> {
  const [regular, bold] = await Promise.all([readFile(join(process.cwd(), "src/fonts/Poppins-Regular.ttf")), readFile(join(process.cwd(), "src/fonts/Poppins-SemiBold.ttf"))]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.addFileToVFS("Poppins-Regular.ttf", regular.toString("base64")); pdf.addFont("Poppins-Regular.ttf", "Poppins", "normal");
  pdf.addFileToVFS("Poppins-SemiBold.ttf", bold.toString("base64")); pdf.addFont("Poppins-SemiBold.ttf", "Poppins", "bold");
  pdf.setProperties({ title: plan.title, author: "Join One Circle", subject: "School document version" });
  let y = 22;
  const page = () => { pdf.addPage(); y = 22; };
  const measure = (value: string, size: number, weight = "normal") => {
    pdf.setFont("Poppins", weight); pdf.setFontSize(size);
    return (pdf.splitTextToSize(value.replace(/\r\n/g, "\n"), 172) as string[]).length * size * .48 + 3;
  };
  const ensure = (space: number) => { if (y + Math.min(space, 251) > 273) page(); };
  const text = (value: string, size = 9, weight = "normal", color = "#264b3b") => {
    pdf.setFont("Poppins", weight); pdf.setFontSize(size); pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(value.replace(/\r\n/g, "\n"), 172) as string[];
    const height = size * .48;
    for (const line of lines) { if (y + height > 273) page(); pdf.text(line, 19, y); y += height; }
    y += 3;
  };
  text("Join One Circle", 11, "bold"); text(plan.title, 19, "bold");
  text(`Version: ${version} | ${plan.status.toUpperCase()}`, 8, "normal", "#64776a");
  text(`Document ID: ${plan.id}`, 7, "normal", "#64776a");
  for (const section of plan.template_snapshot.sections) {
    const first = section.fields[0];
    ensure(5 + measure(section.title, 12, "bold") + (first ? measure(first.label, 9, "bold") + (first.type === "table" ? 25 : 9) : 0));
    y += 5; text(section.title, 12, "bold");
    for (const field of section.fields) {
      ensure(measure(field.label, 9, "bold") + (field.type === "table" ? 25 : 8)); text(field.label, 9, "bold");
      if (field.type === "table") {
        const rows = readTable(plan.answers[field.id] || "");
        if (!rows.length) text("-");
        rows.forEach((row, index) => { ensure(24); text(`Item ${index+1}`, 9, "bold"); for (const column of field.columns ?? []) { ensure(measure(column.label, 8, "bold") + 8); text(column.label, 8, "bold"); text(row[column.id] || "-", 9); } y += 2; });
      } else text(plan.answers[field.id] || "-", 9);
      y += 2;
    }
  }
  const signatureNote = "Locked school document version. This signature record is not an external digital-signature certificate.";
  ensure(7 + measure("School electronic signature record", 12, "bold") + (plan.signature ? 40 : 0) + measure(`${plan.signer_name ?? ""} | ${plan.signer_role ?? ""}`, 9) + measure(`Recorded at: ${plan.signed_at ?? ""}`, 8) + measure(`School user: ${plan.signed_by ?? ""}`, 8) + measure(`Content SHA-256: ${plan.content_hash ?? ""}`, 7) + measure(signatureNote, 7)); y += 7;
  text("School electronic signature record", 12, "bold");
  if (plan.signature) {
    const signature = validateSignature(plan.signature);
    pdf.setDrawColor("#173e35"); pdf.setLineWidth(.38);
    // Same fixed aspect ratio and numeric strokes as the document preview.
    for (const stroke of signature.strokes) for (let i = 1; i < stroke.length; i++) {
      pdf.line(19+stroke[i-1][0]*.12, y+stroke[i-1][1]*.12, 19+stroke[i][0]*.12, y+stroke[i][1]*.12);
    }
    y += 40;
  }
  text(`${plan.signer_name ?? ""} | ${plan.signer_role ?? ""}`);
  text(`Recorded at: ${plan.signed_at ?? ""}`, 8);
  text(`School user: ${plan.signed_by ?? ""}`, 8);
  text(`Content SHA-256: ${plan.content_hash ?? ""}`, 7);
  text(signatureNote, 7);
  const total = pdf.getNumberOfPages();
  for (let index = 1; index <= total; index++) { pdf.setPage(index); pdf.setFont("Poppins", "normal"); pdf.setFontSize(7); pdf.setTextColor("#6c7d70"); pdf.text(`Join One Circle | ${index} / ${total}`, 19, 287); }
  return new Uint8Array(pdf.output("arraybuffer"));
}
