"use client";
import { readTable } from "@/lib/pilot-table";
import type { TemplateField } from "@/lib/pilot-model";
import { usePilotLanguage } from "./pilot-language";
import { AppIcon } from "@/components/app-icon";
export function PlanTable({ field, answer, onChange, disabled }: { field: TemplateField; answer: string; onChange?: (answer: string) => void; disabled?: boolean }) {
  const { l } = usePilotLanguage(); const rows = readTable(answer); const columns = field.columns ?? [];
  if (!onChange) return rows.length ? <div className="ux-table-answers">{rows.map((row, i) => <dl key={i}>{columns.map(c => <div key={c.id}><dt>{c.label}</dt><dd>{row[c.id] || "—"}</dd></div>)}</dl>)}</div> : <p>—</p>;
  const write = (next: typeof rows) => onChange(JSON.stringify(next));
  return <div className="ux-plan-table"><p className="pilot-hint">{l("Add one row per objective or support. Record how success will be checked, not just the activity.", "Adicione uma linha por objetivo ou apoio. Registre como o resultado será avaliado, não apenas a atividade.", "Añada una fila por objetivo o apoyo. Registre cómo se evaluará el resultado, no solo la actividad.")}</p>{rows.map((row, i) => <fieldset className="ux-table-row" key={i}><legend>{l("Item", "Item", "Elemento")} {i+1}</legend><div className="pilot-form-grid">{columns.map((c, ci) => <label className="field" key={c.id}><span>{c.label}{ci === 0 ? " *" : ""}</span><textarea rows={2} disabled={disabled} maxLength={2000} value={row[c.id] ?? ""} placeholder={c.label} onChange={e => write(rows.map((r, ri) => ri === i ? { ...r, [c.id]: e.target.value } : r))}/></label>)}</div><button className="quiet-button" type="button" disabled={disabled} onClick={() => write(rows.filter((_, ri) => ri !== i))}><AppIcon name="close" size={15}/>{l("Remove item", "Remover item", "Eliminar elemento")}</button></fieldset>)}<button className="quiet-button" type="button" disabled={disabled || rows.length >= 20} onClick={() => write([...rows, Object.fromEntries(columns.map(c => [c.id, ""]))])}><AppIcon name="plus" size={16}/>{l("Add item", "Adicionar item", "Añadir elemento")}</button><small>{rows.length}/20</small></div>;
}
