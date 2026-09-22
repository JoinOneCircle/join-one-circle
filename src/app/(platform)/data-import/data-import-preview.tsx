"use client";

import { ChangeEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { importSchoolPupils } from "./actions";

type ImportedRow = { line: number; name: string; dob: string; support: string; valid: boolean; reason?: string };
type ParsedCsv = { rows: ImportedRow[]; overLimit: boolean };

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
function validIsoDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}
function mapRows(text: string): ParsedCsv {
  const csv = parseCsv(text); if (csv.length < 2) return { rows: [], overLimit: false };
  const headers = csv[0].map(normaliseHeader);
  const nameIndex = headers.findIndex((header) => ["name", "pupilname", "childname", "preferredname"].includes(header));
  const dobIndex = headers.findIndex((header) => ["dob", "dateofbirth", "birthdate"].includes(header));
  const supportIndex = headers.findIndex((header) => ["support", "sendstatus", "need", "stage"].includes(header));
  const sourceRows = csv.slice(1);
  return {
    overLimit: sourceRows.length > 100,
    rows: sourceRows.slice(0, 100).map((values, index) => {
      const rawName = nameIndex >= 0 ? values[nameIndex] ?? "" : "";
      const name = rawName.trim();
      const dob = dobIndex >= 0 ? (values[dobIndex] ?? "").trim() : "";
      const support = supportIndex >= 0 ? (values[supportIndex] ?? "").trim() : "";
      const valid = Boolean(name) && name.length <= 120 && support.length <= 2000 && validIsoDate(dob);
      const reason = nameIndex < 0 ? "A name column was not found" : !name ? "Add a pupil name" : name.length > 120 ? "Name is longer than 120 characters" : !validIsoDate(dob) ? "Use date of birth as YYYY-MM-DD" : support.length > 2000 ? "Support information is too long" : undefined;
      return { line: index + 2, name, dob, support, valid, reason };
    }),
  };
}

export function DataImportPreview() {
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [overLimit, setOverLimit] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows]);
  const allRowsReady = rows.length > 0 && validRows.length === rows.length && !overLimit;

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setConfirmed(false);
    if (!/\.csv$/i.test(file.name) || file.size > 1_000_000) { setRows([]); setMessage("Choose a CSV file smaller than 1 MB."); return; }
    try {
      const parsed = mapRows(await file.text());
      setRows(parsed.rows); setOverLimit(parsed.overLimit); setFileName(file.name);
      setMessage(parsed.overLimit ? "This file has more than 100 rows. Split it into smaller lists before importing." : parsed.rows.length ? "Review every row before importing." : "We could not find rows under the headings.");
    } catch { setRows([]); setMessage("This file could not be read. Try saving it as a CSV first."); }
  };

  const submitImport = () => {
    if (!allRowsReady || !confirmed || isPending) return;
    startTransition(async () => {
      const result = await importSchoolPupils(fileName, validRows.map(({ name, dob, support }) => ({ name, dob, support })));
      if (result.error) { setMessage(result.error); return; }
      setMessage(`${result.created ?? 0} pupil record${result.created === 1 ? " was" : "s were"} added securely. ${result.skipped ?? 0} duplicate${result.skipped === 1 ? " was" : "s were"} skipped and ${result.rejected ?? 0} row${result.rejected === 1 ? " was" : "s were"} rejected.`);
      setRows([]); setFileName(""); setConfirmed(false); setOverLimit(false);
    });
  };

  return <>
    <section className="panel import-steps" aria-label="Import steps"><div><b>1</b><span><strong>Choose a CSV</strong><small>Use headings such as Name, Date of birth and Support.</small></span></div><div><b>2</b><span><strong>Review it</strong><small>Correct every row marked before continuing.</small></span></div><div><b>3</b><span><strong>Confirm import</strong><small>Only validated rows are sent to the secure record.</small></span></div></section>
    <section className="panel import-dropzone"><div><p className="eyebrow">STEP 1</p><h2>Choose a pupil CSV</h2><p>The original spreadsheet stays on this device. Only reviewed pupil records are sent when you confirm.</p></div><label className="button button--small" htmlFor="pupil-csv">Choose CSV<input id="pupil-csv" className="visually-hidden" type="file" accept=".csv,text/csv" onChange={chooseFile} /></label></section>
    {message && <p className="workspace-status" role="status">{message}</p>}
    {rows.length > 0 && <section className="panel import-review"><div className="panel-title"><div><p className="eyebrow">STEP 2</p><h2>Review {fileName}</h2><p>{validRows.length} of {rows.length} rows are ready. Dates must use YYYY-MM-DD; an empty date is allowed.</p></div></div><div className="import-table"><div className="import-row import-row--head"><span>Line</span><span>Name</span><span>Date of birth</span><span>Support</span><span>Check</span></div>{rows.map((row) => <div className="import-row" key={row.line} data-valid={row.valid}><span>{row.line}</span><strong>{row.name || "—"}</strong><span>{row.dob || "—"}</span><span>{row.support || "—"}</span><small>{row.valid ? "Ready" : row.reason}</small></div>)}</div></section>}
    {rows.length > 0 && <section className="panel import-review import-confirm"><div><p className="eyebrow">STEP 3</p><h2>Confirm secure import</h2><p>This will create {validRows.length} pupil record{validRows.length === 1 ? "" : "s"} in this verified school workspace. Existing matching names and dates of birth will be skipped.</p><label className="check-option"><input type="checkbox" checked={confirmed} disabled={!allRowsReady || isPending} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have reviewed these records and I am authorised to add them.</span></label></div><div className="import-confirm-actions"><button type="button" className="button" disabled={!allRowsReady || !confirmed || isPending} onClick={submitImport}>{isPending ? "Importing securely…" : "Import reviewed pupils"}</button><Link className="quiet-button" href="/children">View pupil records</Link></div></section>}
  </>;
}
