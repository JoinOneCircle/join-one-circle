"use client";
import type { PupilProfile, PupilField } from "@/lib/pilot-model";
import { profileLabels, usePilotLanguage } from "./pilot-language";
export const profileGroups: { id: string; title: readonly string[]; fields: PupilField[] }[] = [
  { id: "identity", title: ["Identity", "Identificação", "Identificación"], fields: ["preferred_name", "date_of_birth", "year_group"] },
  { id: "understanding", title: ["Understanding the child", "Conhecendo a criança", "Conocer al menor"], fields: ["strengths", "interests", "needs", "communication"] },
  { id: "views", title: ["Views and participation", "Opiniões e participação", "Opiniones y participación"], fields: ["child_views", "parent_views"] },
  { id: "support", title: ["Support and progress", "Apoios e acompanhamento", "Apoyos y seguimiento"], fields: ["outcomes", "provision", "progress"] },
];
export const profileExamples: Record<PupilField, readonly string[]> = {
  preferred_name: ["Name used by the school", "Nome pelo qual a escola identifica a criança", "Nombre con el que la escuela identifica al menor"],
  date_of_birth: ["Optional", "Opcional", "Opcional"], year_group: ["e.g. Year 3 · Class B", "Ex.: Year 3 · Turma B", "Ej.: Year 3 · Grupo B"],
  strengths: ["What does the child enjoy and do well?", "O que a criança faz bem? Em quais atividades se envolve?", "¿Qué se le da bien? ¿En qué actividades participa?"],
  interests: ["Activities, subjects or routines that engage the child", "Atividades, assuntos ou rotinas que despertam interesse", "Actividades, temas o rutinas que le interesan"],
  needs: ["When is support needed? Describe the situation and its impact.", "Em quais situações precisa de apoio? Descreva a situação e seu impacto.", "¿En qué situaciones necesita apoyo? Describa la situación y su impacto."],
  communication: ["How does the child communicate? What makes understanding easier?", "Como se comunica? O que facilita a compreensão e a expressão?", "¿Cómo se comunica? ¿Qué facilita comprender y expresarse?"],
  child_views: ["What matters to the child, in their own words where possible", "O que é importante para a criança, com as palavras dela quando possível", "Qué es importante para el menor, con sus palabras cuando sea posible"],
  parent_views: ["Contributions shared with and recorded by the school", "Contribuições recebidas dos responsáveis e registradas pela escola", "Aportaciones recibidas de los responsables y registradas por la escuela"],
  outcomes: ["What change should the school work towards and review?", "Qual resultado a escola quer alcançar e acompanhar?", "¿Qué resultado quiere alcanzar y revisar la escuela?"],
  provision: ["What support is offered, by whom and how often?", "Qual apoio será oferecido, por quem e com que frequência?", "¿Qué apoyo se ofrece, por quién y con qué frecuencia?"],
  progress: ["What has changed? Include observations and relevant dates.", "O que mudou? Inclua observações e datas relevantes.", "¿Qué ha cambiado? Incluya observaciones y fechas relevantes."],
};
export function ProfileFields({ profile, setProfile, fields, disabled = false }: { profile: PupilProfile; setProfile: (profile: PupilProfile) => void; fields: PupilField[]; disabled?: boolean }) {
  const { l } = usePilotLanguage();
  return <div className="pilot-form-grid">{fields.map((field) => <label className={`field ${["preferred_name", "date_of_birth", "year_group"].includes(field) ? "" : "pilot-wide"}`} key={field}><span>{l(...profileLabels[field])}{field === "preferred_name" && <span className="ux-required"> *</span>}</span>{["preferred_name", "date_of_birth", "year_group"].includes(field) ? <input disabled={disabled} type={field === "date_of_birth" ? "date" : "text"} max={field === "date_of_birth" ? new Date().toISOString().slice(0, 10) : undefined} required={field === "preferred_name"} maxLength={field === "preferred_name" ? 120 : 10000} placeholder={l(...profileExamples[field])} value={profile[field]} onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}/> : <textarea disabled={disabled} rows={3} maxLength={10000} placeholder={l(...profileExamples[field])} value={profile[field]} onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}/>}</label>)}</div>;
}
