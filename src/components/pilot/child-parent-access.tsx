"use client";
import { useState } from "react";
import type { PilotData } from "@/lib/pilot-model";
import { usePilotLanguage } from "./pilot-language";
import { SharingEditor } from "./sharing-editor";
import type { usePilot } from "./use-pilot";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { StatusBadge } from "./pilot-ui";
export type ChildAccessProps = { data: PilotData; childId: string; execute: ReturnType<typeof usePilot>["execute"]; busy: boolean; demo: boolean };
export function ChildParentAccess(props: ChildAccessProps & { onEditingChange?: (editing: boolean) => void }) {
  const { l } = usePilotLanguage(); const [editor, setEditor] = useState<string | null>(null);
  const parents = props.data.recipients.filter((r) => r.child_id === props.childId && r.recipient_role === "parent");
  const edit = (id: string | null) => { setEditor(id); if (!id) props.onEditingChange?.(false); };
  if (editor) return <SharingEditor key={editor} {...props} recipient={parents.find((p) => p.id === editor)} onDirtyChange={props.onEditingChange} close={() => edit(null)} />;
  return <section className="soft-card"><div className="soft-card-heading"><h2>{l("Parents and their access", "Responsáveis e seus acessos", "Responsables y sus accesos")}</h2><button className="button button--small" type="button" onClick={() => edit("new")}><AppIcon name="plus" size={16}/>{l("Add parent", "Adicionar responsável", "Añadir responsable")}</button></div><p className="pilot-hint">{l("Each person has their own contact and sharing choices for this child. Adding a second parent does not copy the first parent's access.", "Cada pessoa tem seu contato e seleção de conteúdo para esta criança. Adicionar outro responsável não copia o acesso do primeiro.", "Cada persona tiene su contacto y selección para este menor. Añadir otro responsable no copia el acceso del primero.")}</p>
    {!parents.length && <p className="pilot-info">{l("Private to the school. No parent has been invited for this child.", "Privado para a escola. Nenhum responsável foi convidado para esta criança.", "Privado para la escuela. No se ha invitado a ningún responsable para este menor.")}</p>}
    <div className="pilot-list">{parents.map((p) => <article key={p.id}><div><h3>{p.contact_name || p.display_name}</h3><StatusBadge status={props.demo && !["revoked", "expired"].includes(p.status) ? "simulation" : p.status}/><p className="pilot-hint">{p.relationship}{p.relationship && " · "}{p.recipient_label || ""}</p><small>{l("Record fields", "Campos da ficha", "Campos de la ficha")}: {p.profile_fields.length} · {l("Documents", "Documentos", "Documentos")}: {p.plan_ids.length}</small></div>{p.status !== "revoked" && <button className="quiet-button" type="button" onClick={() => edit(p.id)}><AppIcon name={p.status === "expired" || p.status === "pending" ? "refresh" : "edit"} size={16}/>{p.status === "expired" || p.status === "pending" ? l("Review and renew link", "Revisar e renovar link", "Revisar y renovar enlace") : l("Configure access", "Configurar acesso", "Configurar acceso")}</button>}{["active", "draft", "pending"].includes(p.status) && <Link className="quiet-button" href={`/parent?recipient=${p.id}`}><AppIcon name="eye" size={16}/>{props.demo ? l("Simulate this view", "Simular esta visão", "Simular esta vista") : l("Preview selected content", "Ver conteúdo selecionado", "Ver contenido seleccionado")}</Link>}</article>)}</div>
  </section>;
}
