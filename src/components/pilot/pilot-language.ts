"use client";
import { useContext } from "react";
import { InterfaceLanguageContext } from "../interface-language-context";
export function usePilotLanguage() {
  const language = useContext(InterfaceLanguageContext);
  const l = (...text: readonly string[]) => text[language === "pt" ? 1 : language === "es" ? 2 : 0] ?? text[0] ?? "";
  return { language, l };
}
export const profileLabels = {
  preferred_name: ["Child name", "Nome da criança", "Nombre del menor"], date_of_birth: ["Date of birth", "Data de nascimento", "Fecha de nacimiento"], year_group: ["Year group", "Ano / turma", "Curso / grupo"], strengths: ["Strengths", "Pontos fortes", "Fortalezas"], needs: ["Needs", "Necessidades", "Necesidades"], communication: ["Communication", "Comunicação", "Comunicación"], interests: ["Interests", "Interesses", "Intereses"], child_views: ["Child views", "Opinião da criança", "Opinión del menor"], parent_views: ["Parent / carer views recorded by school", "Opinião dos responsáveis registrada pela escola", "Opinión de los responsables registrada por la escuela"], outcomes: ["Outcomes", "Objetivos", "Objetivos"], provision: ["Support and adjustments", "Apoios e adaptações", "Apoyos y adaptaciones"], progress: ["Progress", "Avanços", "Progresos"],
} as const;
