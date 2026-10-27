"use client";
import { useCallback, useEffect, useState } from "react";
import { changePilotDemo, initialPilotDemo, type PilotCommand } from "@/lib/pilot-demo";
import type { PilotData } from "@/lib/pilot-model";
import { usePilotLanguage } from "./pilot-language";

const storageKey = "joc-school-pilot-v1";
const updateEvent = "joc-school-pilot-change";
export function readPilotDemo(): PilotData {
  try { const raw = localStorage.getItem(storageKey); if (raw) { const p = JSON.parse(raw); if (["pupils", "templates", "plans", "recipients", "events"].every((k) => Array.isArray(p[k]))) return p; } } catch { /* safe synthetic seed */ }
  return initialPilotDemo();
}
export function usePilot(demo: boolean) {
  const { l } = usePilotLanguage();
  const [data, setData] = useState<PilotData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (demo) { setData(readPilotDemo()); return; }
    try {
      const r = await fetch("/api/pilot", { cache: "no-store" }); const value = await r.json();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) setData(null);
        throw new Error(r.status === 401 ? "Sign in again" : r.status === 403 ? "School access unavailable" : "School data refresh failed");
      }
      setData(value); setError("");
    } catch (error) { setError(error instanceof Error && /sign in|school access/i.test(error.message) ? error.message : "School data refresh failed"); }
  }, [demo]);
  useEffect(() => {
    const refresh = () => { void load(); };
    refresh(); const timer = window.setInterval(refresh, 15000); window.addEventListener(updateEvent, refresh); window.addEventListener("storage", refresh); window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener(updateEvent, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);
  const execute = async (command: PilotCommand) => {
    if (busy) return null;
    setBusy(true); setError("");
    try {
      let result: { id?: string; invitationUrl?: string };
      if (demo) {
        // Re-read immediately before every mutation to catch another tab's edit.
        const changed = await changePilotDemo(readPilotDemo(), command);
        localStorage.setItem(storageKey, JSON.stringify(changed.data)); setData(changed.data); window.dispatchEvent(new Event(updateEvent)); result = changed;
      } else {
        const r = await fetch("/api/pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
        result = await r.json(); if (!r.ok) throw new Error((result as { error?: string }).error ?? "Could not save"); await load();
      }
      return result;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save"); return null; }
    finally { setBusy(false); }
  };
  const displayError = !error ? "" : /refresh failed/i.test(error) ? l("The screen could not refresh. Keep this form open; unsaved edits have been preserved. Try refreshing again before continuing.", "Não foi possível atualizar a tela. Mantenha este formulário aberto; as edições não salvas foram preservadas. Tente atualizar novamente antes de continuar.", "No se pudo actualizar la pantalla. Mantenga abierto este formulario; los cambios sin guardar se han conservado. Intente actualizar de nuevo antes de continuar.") : /changed|reload/i.test(error) ? l("Another person changed this record. Reload before saving again; your edits have not overwritten theirs.", "Outra pessoa alterou esta ficha. Recarregue antes de salvar novamente; suas edições não sobrescreveram as dela.", "Otra persona cambió esta ficha. Recargue antes de guardar; sus cambios no sobrescribieron los de esa persona.") : /setup required|migrations/i.test(error) ? l("School setup is required. Apply migrations 0022–0027 and verify the school before using real records.", "É necessário configurar o piloto. Aplique as migrations 0022–0027 e verifique a escola antes de usar dados reais.", "Es necesario configurar el piloto. Aplique las migraciones 0022–0027 y verifique la escuela antes de usar datos reales.") : /sign in/i.test(error) ? l("Your session has ended. Sign in again.", "Sua sessão terminou. Entre novamente.", "Su sesión ha terminado. Inicie sesión de nuevo.") : l("Could not complete this action. Check required information, your connection and school access. Your changes were not confirmed.", "Não foi possível concluir esta ação. Confira os dados obrigatórios, a conexão e seu acesso à escola. Suas alterações não foram confirmadas.", "No se pudo completar la acción. Compruebe los datos obligatorios, la conexión y el acceso escolar. Sus cambios no se confirmaron.");
  return { data, busy, error: displayError, execute, reload: load };
}
