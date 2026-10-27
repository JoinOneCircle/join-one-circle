"use client";
import { useEffect, useState } from "react";
import { PilotDialog } from "./pilot-dialog";
import { usePilotLanguage } from "./pilot-language";

export type NavigationRequest = { message: string; proceed: () => void };
export function NavigationPrompt() {
  const { l } = usePilotLanguage();
  const [request, setRequest] = useState<NavigationRequest | null>(null);
  useEffect(() => {
    const ask = (event: Event) => setRequest((event as CustomEvent<NavigationRequest>).detail);
    window.addEventListener("joc-confirm-navigation", ask);
    return () => window.removeEventListener("joc-confirm-navigation", ask);
  }, []);
  if (!request) return null;
  return <PilotDialog titleId="navigation-unsaved-title" close={() => setRequest(null)}>
    <h2 id="navigation-unsaved-title">{l("Keep your changes?", "Manter suas alterações?", "¿Conservar sus cambios?")}</h2>
    <p>{request.message}</p>
    <p>{l("Keep editing to save the draft. Leaving discards only changes you have not saved.", "Continue editando para salvar. Sair descarta somente as alterações ainda não salvas.", "Siga editando para guardar. Salir descarta solo los cambios sin guardar.")}</p>
    <div className="pilot-toolbar"><button type="button" autoFocus className="button" onClick={() => setRequest(null)}>{l("Keep editing", "Continuar editando", "Seguir editando")}</button><button type="button" className="quiet-button" onClick={() => { const run = request.proceed; setRequest(null); run(); }}>{l("Discard & leave", "Descartar e sair", "Descartar y salir")}</button></div>
  </PilotDialog>;
}
