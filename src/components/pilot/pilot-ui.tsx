"use client";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { usePilotLanguage } from "./pilot-language";
export function PreviewNote() {
  const { l } = usePilotLanguage();
  return <details className="ux-preview" data-no-translate><summary><AppIcon name="info" size={15}/>{l("Local preview · fictitious data", "Prévia local · dados fictícios", "Vista previa local · datos ficticios")}</summary><p>{l("Saved in this browser only. No email, real access or valid signature. Do not enter personal data.", "Salvo apenas neste navegador. Não envia e-mail, não concede acesso real nem assinatura válida. Não use dados pessoais.", "Guardado solo en este navegador. No envía correos ni concede acceso real ni firmas válidas. No use datos personales.")}</p></details>;
}
export function EmptyState({ icon, title, children, action }: { icon: AppIconName; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="ux-empty"><span className="ux-empty-icon"><AppIcon name={icon} size={26}/></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function StatusBadge({ status }: { status: string }) {
  const { l } = usePilotLanguage();
  const text = status === "draft" ? l("Draft", "Rascunho", "Borrador") : status === "signed" ? l("Signed", "Assinado", "Firmado") : status === "published" ? l("Published", "Publicado", "Publicado") : status === "active" ? l("Access active", "Acesso ativo", "Acceso activo") : status === "pending" ? l("Awaiting acceptance", "Aguardando aceite", "Pendiente de aceptación") : status === "expired" ? l("Link expired", "Link expirado", "Enlace caducado") : status === "revoked" ? l("Revoked", "Revogado", "Revocado") : l("Local simulation", "Simulação local", "Simulación local");
  return <span className="ux-status" data-status={status}>{status === "signed" || status === "published" ? <AppIcon name="lock" size={12}/> : <i/>}{text}</span>;
}
export function SchoolVerificationNotice({ reload }: { reload?: () => void }) {
  const { l } = usePilotLanguage();
  return <section className="soft-card" data-no-translate><EmptyState icon="lock" title={l("School verification required", "Escola precisa de verificação", "La escuela requiere verificación")} action={reload && <button className="quiet-button" onClick={reload}><AppIcon name="refresh" size={16}/>{l("Check again", "Verificar novamente", "Comprobar de nuevo")}</button>}>{l("Your account is signed in, but the school is not currently verified for this workspace. The platform administrator must check the institution and authorised contact. No child records can be opened or created until access is approved.", "Sua conta está conectada, mas a escola ainda não está verificada para este painel. O administrador da plataforma precisa conferir a instituição e seu contato autorizado. Nenhuma ficha pode ser aberta ou criada antes da aprovação do acesso.", "Su cuenta está conectada, pero la escuela aún no está verificada para este espacio. El administrador debe comprobar la institución y su contacto autorizado. No se pueden abrir ni crear fichas antes de aprobar el acceso.")}</EmptyState></section>;
}
export function useDateLabel() { const { language } = usePilotLanguage(); return (value: string, time = false) => new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : language === "es" ? "es-ES" : "en-GB", { day: "2-digit", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}), timeZone: "Europe/London" }).format(new Date(value)); }
