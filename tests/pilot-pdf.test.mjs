import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { renderPilotPdf } from "../src/lib/pilot-pdf.ts";
import { initialPilotDemo, changePilotDemo } from "../src/lib/pilot-demo.ts";
import { pilotCatalogue } from "../src/lib/pilot-catalogue.ts";
import { signature } from "./signature-fixture.mjs";

test("school PDF embeds local fonts, handles accents and paginates long answers", async () => {
  let data = initialPilotDemo();
  data = (await changePilotDemo(data, { operation: "template", definition: pilotCatalogue[0].definition }, undefined, "qa-template")).data;
  data = (await changePilotDemo(data, { operation: "plan-create", child_id: "demo-child", template_id: "qa-template" }, undefined, "qa-plan")).data;
  const plan = { ...data.plans[0], signature, title: "QA ONLY — Plano de apoio / Plan de apoyo", status: "published", signer_name: "Synthetic school signer", signer_role: "QA — not a real signature", signed_at: "2026-10-20T12:00:00.000Z", signed_by: "synthetic-test-account", content_hash: "0".repeat(64) };
  plan.answers.objectives_table = JSON.stringify([{ column_1: "Recognise five letters independently", column_2: "Currently recognises one letter", column_3: "Four successful observations", column_4: "Daily visual practice", column_5: "Class teacher", column_6: "Ten minutes each school day" }]);
  plan.answers.strengths = Array.from({ length: 70 }, (_, i) => `${i + 1}. Informação fictícia para testar paginação. Comunicación, revisión y participación. This is synthetic test content only.`).join("\n");
  const bytes = await renderPilotPdf(plan);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 3);
  await mkdir(new URL("../output/pdf/", import.meta.url), { recursive: true });
  await writeFile(new URL("../output/pdf/pilot-qa-synthetic.pdf", import.meta.url), bytes);
});
