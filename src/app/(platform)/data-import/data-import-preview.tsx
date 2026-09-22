"use client";

import { ChangeEvent, useMemo, useState } from "react";

type ImportedRow = { line: number; name: string; dob: string; support: string; valid: boolean; reason?: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseHeader(value: string) { return value.trim().toLowerCase().replace(/[^a-z]/g, ""); }
function mapRows(text: string): ImportedRow[] {
  const csv = parseCsv(text); if (csv.length < 2) return [];
  const headers = csv[0].map(normaliseHeader);
  const nameIndex = headers.findIndex((header) => ["name", "pupilname", "childname", "preferredname"].includes(header));
  const dobIndex = headers.findIndex((header) => ["dob", "dateofbirth", "birthdate"].includes(header));
  const supportIndex = headers.findIndex((header) => ["support", "sendstatus", "need", "stage"].includes(header));
  return csv.slice(1, 101).map((values, index) => {
    const name = nameIndex >= 0 ? values[nameIndex] ?? "" : "";
    const dob = dobIndex >= 0 ? values[dobIndex] ?? "" : "";
    const support = supportIndex >= 0 ? values[supportIndex] ?? "" : "";
    const valid = Boolean(name) && name.length <= 120;
    return { line: index + 2, name, dob, support, valid, reason: valid ? undefined : nameIndex < 0 ? "A name column was not found" : "Add a pupil name" };
  });
}

export function DataImportPreview() {
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows]);
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/\.csv$/i.test(file.name) || file.size > 1_000_000) { setMessage("Choose a CSV file smaller than 1 MB."); return; }
    try { const parsed = mapRows(await file.text()); setRows(parsed); setFileName(file.name); setMessage(parsed.length ? "Review the rows below before continuing." : "We could not find rows under the headings."); }
    catch { setMessage("This file could not be read. Try saving it as a CSV first."); }
  };
  const continuePreview = () => setMessage(`${validRows.length} valid row${validRows.length === 1 ? " is" : "s are"} ready for import.`);
  return <>
    <section className="panel import-steps"><div><b>1</b><span><strong>Choose a CSV</strong><small>Use headings such as Name, Date of birth and Support.</small></span></div><div><b>2</b><span><strong>Review it</strong><small>Fix anything marked before you continue.</small></span></div><div><b>3</b><span><strong>Confirm import</strong><small>Review the information one final time.</small></span></div></section>
    <section className="panel import-dropzone"><div><p className="eyebrow">STEP 1</p><h2>Choose a pupil CSV</h2><p>Start by checking the information before importing it.</p></div><label className="button button--small" htmlFor="pupil-csv">Choose CSV<input id="pupil-csv" className="visually-hidden" type="file" accept=".csv,text/csv" onChange={chooseFile} /></label></section>
    {message && <p className="workspace-status" role="status">{message}</p>}
    {rows.length > 0 && <section className="panel import-review"><div className="panel-title"><div><p className="eyebrow">STEP 2</p><h2>Check {fileName}</h2><p>{validRows.length} of {rows.length} rows are ready to review.</p></div><button type="button" className="button button--small" onClick={continuePreview}>Continue to review</button></div><div className="import-table"><div className="import-row import-row--head"><span>Line</span><span>Name</span><span>Date of birth</span><span>Support</span><span>Check</span></div>{rows.map((row) => <div className="import-row" key={row.line} data-valid={row.valid}><span>{row.line}</span><strong>{row.name || "—"}</strong><span>{row.dob || "—"}</span><span>{row.support || "—"}</span><small>{row.valid ? "Ready" : row.reason}</small></div>)}</div></section>}
  </>;
}
