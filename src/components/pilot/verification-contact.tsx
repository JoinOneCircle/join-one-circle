"use client";
import { AppIcon } from "@/components/app-icon";
import { JOC_SUPPORT_EMAIL, SCHOOL_VERIFICATION_BUSINESS_DAYS } from "@/lib/support-contact";
import { usePilotLanguage } from "./pilot-language";
import styles from "./verification-contact.module.css";

export function VerificationContact({ showDeadline = true }: { showDeadline?: boolean }) {
  const { l } = usePilotLanguage();
  return <div className={styles.contact} data-no-translate>
    {showDeadline && <p><AppIcon name="audit" size={17}/><span>{l(`Verification: up to ${SCHOOL_VERIFICATION_BUSINESS_DAYS} working days after submitting your school details.`, `Verificação: até ${SCHOOL_VERIFICATION_BUSINESS_DAYS} dias úteis após o envio dos dados da escola.`, `Verificación: hasta ${SCHOOL_VERIFICATION_BUSINESS_DAYS} días laborables tras enviar los datos de la escuela.`)}</span></p>}
    <p>{showDeadline ? l("Need help or has the deadline passed? Contact Join One Circle.", "Precisa de ajuda ou o prazo passou? Fale com a Join One Circle.", "¿Necesita ayuda o ha pasado el plazo? Contacte con Join One Circle.") : l("Need help? Contact Join One Circle.", "Precisa de ajuda? Fale com a Join One Circle.", "¿Necesita ayuda? Contacte con Join One Circle.")}</p>
    <a className="quiet-button" href={`mailto:${JOC_SUPPORT_EMAIL}`}><AppIcon name="mail" size={17}/>{JOC_SUPPORT_EMAIL}</a>
  </div>;
}
