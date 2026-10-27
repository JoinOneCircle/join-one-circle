"use client";
import { useRef, useState, type PointerEvent } from "react";
import { validateSignature, type SchoolSignature } from "@/lib/pilot-signature";
import { usePilotLanguage } from "./pilot-language";

export function SignatureDrawing({ signature }: { signature: SchoolSignature }) {
  const { l } = usePilotLanguage();
  return <svg className="ux-signature-drawing" viewBox="0 0 1000 300" role="img" aria-label={l("School signature", "Assinatura da escola", "Firma de la escuela")}><g fill="none" stroke="#173e35" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">{signature.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(p => p.join(",")).join(" ")}/>)}</g></svg>;
}
export function SignaturePad({ value, onChange, disabled }: { value: SchoolSignature | null; onChange: (value: SchoolSignature | null) => void; disabled: boolean }) {
  const { l } = usePilotLanguage();
  const active = useRef<{ pointer: number; points: [number, number][] } | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [limit, setLimit] = useState(false);
  const point = (e: PointerEvent<SVGSVGElement>): [number, number] => { const r = e.currentTarget.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1000, (e.clientX-r.left)/r.width*1000))), Math.round(Math.max(0, Math.min(300, (e.clientY-r.top)/r.height*300)))]; };
  const finish = (e: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const current = active.current; if (!current || current.pointer !== e.pointerId) return;
    active.current = null; setPoints([]);
    if (!cancelled && current.points.length > 1) onChange({ version: 1, strokes: [...(value?.strokes ?? []), current.points] });
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  let valid = false; try { validateSignature(value); valid = true; } catch { /* empty/short stroke */ }
  return <div className="ux-signature-pad"><strong>{l("Draw your signature", "Desenhe sua assinatura", "Dibuje su firma")}</strong><p id="signature-instructions">{l("Use your mouse, finger or pen inside the box. This drawing will appear on this document and its PDF only.", "Use o mouse, o dedo ou uma caneta na área abaixo. O desenho aparecerá apenas neste documento e no PDF dele.", "Use el ratón, el dedo o un lápiz dentro del recuadro. El dibujo aparecerá solo en este documento y su PDF.")}</p><svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label={l("Signature drawing area", "Área para desenhar a assinatura", "Área para dibujar la firma")} aria-describedby="signature-instructions" onPointerDown={e => {
    if (disabled || active.current || e.button !== 0) return;
    if ((value?.strokes.length ?? 0) >= 64 || (value?.strokes.flat().length ?? 0) >= 3990) { setLimit(true); return; }
    e.currentTarget.setPointerCapture(e.pointerId); active.current = { pointer: e.pointerId, points: [point(e)] }; setPoints(active.current.points);
  }} onPointerMove={e => { const current = active.current; if (!current || disabled || current.pointer !== e.pointerId) return; const next = point(e); const last = current.points.at(-1)!; if (Math.hypot(last[0]-next[0], last[1]-next[1]) < 2) return; if (current.points.length + (value?.strokes.flat().length ?? 0) >= 4000) { setLimit(true); return; } current.points.push(next); setPoints([...current.points]); }} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
    <line x1="30" y1="250" x2="970" y2="250" stroke="#cbdace" strokeDasharray="8 8"/>
    <g fill="none" stroke="#173e35" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">{[...(value?.strokes ?? []), points].map((stroke, i) => <polyline key={i} points={stroke.map(p => p.join(",")).join(" ")}/>)}</g>
  </svg><div className="pilot-toolbar"><small role="status">{limit ? l("Drawing limit reached. Undo or clear to try again.", "Limite do desenho atingido. Desfaça ou limpe para tentar novamente.", "Límite de dibujo alcanzado. Deshaga o borre para intentarlo de nuevo.") : valid ? l("Signature ready", "Assinatura pronta", "Firma lista") : l("Draw before confirming", "Desenhe antes de confirmar", "Dibuje antes de confirmar")}</small><button type="button" className="quiet-button" disabled={disabled || !value?.strokes.length} onClick={() => { const strokes = value!.strokes.slice(0,-1); onChange(strokes.length ? { version: 1, strokes } : null); setLimit(false); }}>{l("Undo stroke", "Desfazer traço", "Deshacer trazo")}</button><button type="button" className="quiet-button" disabled={disabled || !value} onClick={() => { onChange(null); setLimit(false); }}>{l("Clear", "Limpar", "Borrar")}</button></div></div>;
}
