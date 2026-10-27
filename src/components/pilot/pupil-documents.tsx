"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { replacePilotQuery } from "@/lib/pilot-url";
import { AppIcon } from "@/components/app-icon";
import { normaliseChildSearch } from "@/lib/child-search";
import { planVersion } from "@/lib/pilot-ux";
import type { ChildAccessProps } from "./child-parent-access";
import { PlanCreateDialog } from "./plan-create-dialog";
import { PlanEditor } from "./plan-editor";
import { usePilotLanguage } from "./pilot-language";
import { EmptyState, StatusBadge, useDateLabel } from "./pilot-ui";

export function PupilDocuments({ data, childId, execute, busy, demo, error, initialPlan = "", initialCreate = false, onEditingChange, openParents }: ChildAccessProps & {
  error: string; initialPlan?: string; initialCreate?: boolean; onEditingChange: (editing: boolean) => void; openParents: () => void;
}) {
  const { l } = usePilotLanguage(); const date = useDateLabel();
  const [editor, setEditor] = useState(initialPlan); const [creating, setCreating] = useState(initialCreate);
  const [templateId, setTemplate] = useState(""); const [search, setSearch] = useState("");
  useEffect(() => { replacePilotQuery({ child: childId, tab: "documents", plan: editor || null, newDocument: creating ? "1" : null }); }, [childId, editor, creating]);
  const pupil = data.pupils.find(p => p.child_id === childId);
  if (!pupil) return null;
  const plans = data.plans.filter(p => p.child_id === childId).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  const selected = plans.find(p => p.id === editor);
  const results = plans.filter(p => normaliseChildSearch(p.title).includes(normaliseChildSearch(search)));
  const create = (template = "") => { setTemplate(template); setCreating(true); };
  if (selected) return <PlanEditor key={selected.id} plan={selected} execute={execute} busy={busy} demo={demo} childName={pupil.profile.preferred_name} version={planVersion(selected, data.plans)} openPlan={setEditor} close={() => setEditor("")} onDirtyChange={onEditingChange} openParentAccess={openParents}/>;
  return <div className="ux-child-documents">
    <div className="ux-record-actions"><div><strong>{l("This child's documents", "Documentos desta criança", "Documentos de este menor")}</strong><p>{l("Use a school template, complete the individual document, then review and sign. The template remains reusable.", "Use um modelo da escola, complete o documento individual e depois revise e assine. O modelo continua disponível para outras crianças.", "Use una plantilla escolar, complete el documento individual y después revise y firme. La plantilla sigue disponible para otros menores.")}</p></div><button className="button" disabled={busy} onClick={() => create()}><AppIcon name="plus" size={17}/>{l("New document", "Novo documento", "Nuevo documento")}</button></div>
    {!!plans.length && <label className="ux-search"><AppIcon name="search" size={17}/><span className="sr-only">{l("Search this child's documents", "Buscar documentos desta criança", "Buscar documentos de este menor")}</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={l("Find a document by title…", "Encontre um documento pelo título…", "Busque un documento por título…")}/></label>}
    <section className="soft-card ux-record-list" aria-label={l("Created documents", "Documentos criados", "Documentos creados")}>
      {results.map(p => { const fields = p.template_snapshot.sections.flatMap(s => s.fields); const completed = fields.filter(f => p.answers[f.id]?.trim()).length; return <button key={p.id} className="ux-record-row" onClick={() => setEditor(p.id)}><span className="ux-template-icon"><AppIcon name={p.status === "draft" ? "edit" : "lock"} size={20}/></span><span className="ux-grow"><strong>{p.title}</strong><small>{l("Version", "Versão", "Versión")} {planVersion(p, data.plans)} · {date(p.updated_at)}{p.status === "draft" ? ` · ${completed}/${fields.length} ${l("fields completed", "campos preenchidos", "campos completados")}` : ""}</small></span><StatusBadge status={p.status}/><span className="ux-row-meta">{p.status === "draft" ? l("Continue filling", "Continuar preenchendo", "Seguir completando") : l("Read document", "Ler documento", "Leer documento")}</span><AppIcon name="chevron-right" size={17}/></button>; })}
      {!results.length && <EmptyState icon="documents" title={plans.length ? l("No matching documents", "Nenhum documento encontrado", "No se encontraron documentos") : l("Create the first document", "Crie o primeiro documento", "Cree el primer documento")} action={!plans.length && <button className="quiet-button" onClick={() => create()}><AppIcon name="plans" size={17}/>{l("Choose a template", "Escolher modelo", "Elegir plantilla")}</button>}>{plans.length ? l("Try another title.", "Tente outro título.", "Pruebe otro título.") : l("The child's details are already in the record. Choose a template to reuse them and fill only what is missing.", "Os dados da criança já estão na ficha. Escolha um modelo para reaproveitá-los e preencher só o que falta.", "Los datos ya están en la ficha. Elija una plantilla para reutilizarlos y completar solo lo que falta.")}</EmptyState>}
    </section>
    <details className="soft-card ux-child-model-library" open={!plans.length}><summary><AppIcon name="plans" size={19}/><strong>{l("Available school templates", "Modelos disponíveis da escola", "Plantillas escolares disponibles")}</strong><span>{data.templates.length}</span><AppIcon name="chevron-right" size={17}/></summary><p className="pilot-hint">{l("Each use creates a separate document for this child. It does not change the template or other documents.", "Cada uso cria um documento separado para esta criança. Não altera o modelo nem outros documentos.", "Cada uso crea un documento separado para este menor. No cambia la plantilla ni otros documentos.")}</p><div className="ux-child-model-grid">{data.templates.map(t => <button className="ux-document-model" key={t.id} disabled={busy} onClick={() => create(t.id)}><AppIcon name="plans" size={19}/><span><strong>{t.definition.title}</strong><small>{l("Create for", "Criar para", "Crear para")} {pupil.profile.preferred_name}</small></span><AppIcon name="plus" size={17}/></button>)}</div>{!data.templates.length && <p className="pilot-hint">{l("Your school has no saved templates yet. Create one or customise a starting model.", "A escola ainda não tem modelos salvos. Crie um ou personalize um modelo-base.", "La escuela aún no tiene plantillas guardadas. Cree una o personalice un modelo base.")}</p>}<Link className="quiet-button" href={`/templates?child=${encodeURIComponent(childId)}`}><AppIcon name="edit" size={16}/>{l("Manage school templates", "Gerenciar modelos da escola", "Gestionar plantillas escolares")}</Link></details>
    {creating && <PlanCreateDialog data={data} childId={childId} fixedChild templateId={templateId} execute={execute} busy={busy} error={error} close={() => setCreating(false)} onCreated={id => { setCreating(false); setEditor(id); }}/>}
  </div>;
}
