"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { ChildPicker } from "@/components/child-picker";
import { normaliseChildSearch } from "@/lib/child-search";
import type { PilotData } from "@/lib/pilot-model";
import { documentPreparation } from "@/lib/pilot-ux";
import { PilotDialog } from "./pilot-dialog";
import { usePilotLanguage } from "./pilot-language";
import type { usePilot } from "./use-pilot";

// The same creation flow serves the child record and the school template library.
// A record-scoped invocation never asks the school to select that child again.
export function PlanCreateDialog({ data, childId = "", fixedChild = false, templateId = "", execute, busy, error, close, onCreated }: {
  data: PilotData; childId?: string; fixedChild?: boolean; templateId?: string;
  execute: ReturnType<typeof usePilot>["execute"]; busy: boolean; error: string;
  close: () => void; onCreated: (id: string, childId: string) => void;
}) {
  const { l } = usePilotLanguage(); const titleId = useId();
  const [selectedChild, setChild] = useState(childId);
  const [selectedTemplate, setTemplate] = useState(templateId);
  const [query, setQuery] = useState("");
  const pupil = data.pupils.find(p => p.child_id === selectedChild);
  const template = data.templates.find(t => t.id === selectedTemplate);
  const preparation = template && pupil ? documentPreparation(template.definition, pupil.profile, data.school_name) : null;
  const results = data.templates.filter(t => normaliseChildSearch(`${t.definition.title} ${t.definition.sections.map(s => s.title).join(" ")}`).includes(normaliseChildSearch(query)));
  const templateLink = pupil ? `/templates?child=${encodeURIComponent(pupil.child_id)}` : "/templates";
  return <PilotDialog titleId={titleId} close={close} busy={busy}>
    <div className="ux-document-dialog" data-no-translate>
      <div className="soft-card-heading"><h2 id={titleId}>{l("New child document", "Novo documento da criança", "Nuevo documento del menor")}</h2><button type="button" className="quiet-button" disabled={busy} onClick={close} aria-label={l("Close", "Fechar", "Cerrar")}><AppIcon name="close" size={17}/></button></div>
      <p>{l("Choose a school template. We create an individual draft, fill the available record information and open it for you to complete.", "Escolha um modelo da escola. Criamos um rascunho individual, preenchemos os dados disponíveis na ficha e abrimos o documento para você completar.", "Elija una plantilla escolar. Creamos un borrador individual, rellenamos los datos disponibles y lo abrimos para completarlo.")}</p>
      {fixedChild ? <div className="ux-document-child"><AppIcon name="children" size={20}/><div><strong>{pupil?.profile.preferred_name || l("Record unavailable", "Ficha indisponível", "Ficha no disponible")}</strong><small>{pupil?.profile.year_group || data.school_name}</small></div><span className="ux-privacy-label"><AppIcon name="lock" size={14}/>{l("School only", "Somente escola", "Solo escuela")}</span></div> : <ChildPicker value={selectedChild} required disabled={busy} onValueChange={setChild} options={data.pupils.map(p => ({ value: p.child_id, label: p.profile.preferred_name, description: p.profile.year_group }))}/>}
      {!data.pupils.length && <p className="pilot-info">{l("Add a child record before creating an individual document.", "Adicione a ficha de uma criança antes de criar um documento individual.", "Añada una ficha antes de crear un documento individual.")} <Link href="/children?new=1">{l("Add child", "Adicionar criança", "Añadir menor")}</Link></p>}
      {!data.templates.length ? <div className="ux-empty"><span className="ux-empty-icon"><AppIcon name="plans" size={24}/></span><h3>{l("Prepare the first school template", "Prepare o primeiro modelo da escola", "Prepare la primera plantilla escolar")}</h3><p>{l("Create a structure or customise a starting model. Save it, then choose “Save & create document” to return to this child.", "Crie uma estrutura ou personalize um modelo-base. Use “Salvar e criar documento” para aplicá-lo a esta criança.", "Cree una estructura o personalice un modelo base. Use “Guardar y crear documento” para aplicarlo a este menor.")}</p><Link className="button" href={templateLink}>{l("Open templates", "Abrir modelos", "Abrir plantillas")}</Link></div> : <>
        <label className="ux-search"><AppIcon name="search" size={17}/><span className="sr-only">{l("Search school templates", "Buscar modelos da escola", "Buscar plantillas escolares")}</span><input autoFocus type="search" disabled={busy} value={query} onChange={e => setQuery(e.target.value)} placeholder={l("Search a template by title or section…", "Busque um modelo por título ou seção…", "Busque una plantilla por título o sección…")}/></label>
        <div className="ux-document-models" role="group" aria-label={l("Choose a template", "Escolha um modelo", "Elija una plantilla")}>
          {results.map(t => <button type="button" key={t.id} disabled={busy} className="ux-document-model" aria-pressed={selectedTemplate === t.id} onClick={() => setTemplate(t.id)}><AppIcon name="plans" size={20}/><span><strong>{t.definition.title}</strong><small>{t.definition.sections.length} {t.definition.sections.length === 1 ? l("section", "seção", "sección") : l("sections", "seções", "secciones")} · {t.definition.sections.flatMap(s => s.fields).length} {t.definition.sections.flatMap(s => s.fields).length === 1 ? l("field", "campo", "campo") : l("fields", "campos", "campos")}</small></span><AppIcon name={selectedTemplate === t.id ? "check" : "plus"} size={17}/></button>)}
          {!results.length && <p role="status" className="pilot-hint">{l("No templates found. Try another title.", "Nenhum modelo encontrado. Tente outro título.", "No se encontraron plantillas. Pruebe otro título.")}</p>}
        </div>
        {template && <div className="ux-document-preparation" aria-live="polite"><strong>{template.definition.title}</strong><p>{preparation ? l(`Fields with automatic pre-fill: ${preparation.ready}. To complete: ${preparation.manual}.`, `Campos com preenchimento automático: ${preparation.ready}. Para completar: ${preparation.manual}.`, `Campos con precompletado automático: ${preparation.ready}. Por completar: ${preparation.manual}.`) : l("Choose a child to see what will be filled automatically.", "Escolha uma criança para conferir o preenchimento automático.", "Elija un menor para comprobar el precompletado.")}</p>{!!preparation?.missing && <p className="pilot-hint">{l(`Linked data not yet available: ${preparation.missing}. Complete it in the draft or update the record before creating it.`, `Dados vinculados ainda não disponíveis: ${preparation.missing}. Complete no rascunho ou atualize a ficha antes de criar.`, `Datos vinculados aún no disponibles: ${preparation.missing}. Complételos en el borrador o actualice la ficha antes de crearlo.`)}</p>}<details><summary>{l("See sections and pre-filled information", "Ver seções e dados preenchidos", "Ver secciones y datos rellenados")}</summary>{template.definition.sections.map(s => <section className="ux-preview-section" key={s.id}><h3>{s.title}</h3>{s.fields.map(f => { const item = preparation?.fields.find(x => x.id === f.id); return <div key={f.id}><strong>{f.label}{f.required ? " *" : ""}</strong><small>{item?.value || (f.source === "today" || f.source === "author" ? l("Filled at creation", "Preenchido ao criar", "Rellenado al crear") : f.source ? l("Not available in the record yet", "Ainda não disponível na ficha", "Aún no disponible en la ficha") : l("Complete in the document", "Completar no documento", "Completar en el documento"))}</small></div>; })}</section>)}</details></div>}
        {error && <p className="form-alert" role="alert">{error}</p>}
        <p className="ux-inline-note"><AppIcon name="lock" size={16}/>{l("This creates a private copy, not another template. Nothing is signed or shared automatically.", "Isso cria uma cópia individual, não outro modelo. Nada é assinado ou compartilhado automaticamente.", "Esto crea una copia individual, no otra plantilla. Nada se firma ni se comparte automáticamente.")}</p>
        <div className="pilot-toolbar"><button className="quiet-button" type="button" disabled={busy} onClick={close}>{l("Cancel", "Cancelar", "Cancelar")}</button><button className="button" type="button" disabled={busy || !pupil || !template} onClick={async () => { if (!pupil || !template || busy) return; const result = await execute({ operation: "plan-create", child_id: pupil.child_id, template_id: template.id }); if (result?.id) onCreated(result.id, pupil.child_id); }}><AppIcon name="edit" size={17}/>{busy ? l("Creating…", "Criando…", "Creando…") : l("Create & complete document", "Criar e preencher documento", "Crear y completar documento")}</button></div>
      </>}
    </div>
  </PilotDialog>;
}
