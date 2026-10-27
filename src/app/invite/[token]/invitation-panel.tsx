"use client";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { usePilotLanguage } from "@/components/pilot/pilot-language";
import { acceptInvitation, switchInvitationAccount } from "./actions";

export function InvitationPanel({ token, email, failed }: { token: string; email: string; failed: boolean }) {
  const { l } = usePilotLanguage();
  const next = `/invite/${encodeURIComponent(token)}`;
  return <div data-no-translate>
    <p className="eyebrow">{l("PRIVATE SCHOOL INVITATION", "CONVITE PRIVADO DA ESCOLA", "INVITACIÓN ESCOLAR PRIVADA")}</p>
    <h2>{l("Read what the school shared with you", "Veja o que a escola compartilhou com você", "Vea lo que la escuela compartió con usted")}</h2>
    <p>{l("This invitation belongs to one email address. Sign in with the email that received the link. Parents have read-only access.", "Este convite pertence a um endereço de e-mail. Entre com o e-mail que recebeu o link. Os responsáveis têm acesso somente de leitura.", "Esta invitación pertenece a un correo. Entre con el correo que recibió el enlace. Los responsables tienen acceso de solo lectura.")}</p>
    <div className="invite-access-summary"><AppIcon name="lock" size={21}/><div><strong>{l("Private and individual", "Privado e individual", "Privado e individual")}</strong><span>{l("Only the fields, signed documents and events selected by the school appear after acceptance.", "Após o aceite, aparecem somente os campos, documentos assinados e eventos selecionados pela escola.", "Tras aceptar, solo aparecen los campos, documentos firmados y eventos seleccionados por la escuela.")}</span></div></div>
    {failed && <p role="alert" className="form-message form-message--error">{l("This invitation could not be accepted. Check the signed-in email. If it matches, the link may have expired or been used; ask the school for help.", "Não foi possível aceitar este convite. Confira o e-mail conectado. Se estiver correto, o link pode ter expirado ou já ter sido usado; peça ajuda à escola.", "No se pudo aceptar la invitación. Compruebe el correo conectado. Si es correcto, el enlace puede haber caducado o haberse usado; consulte a la escuela.")}</p>}
    {email ? <><p className="pilot-info">{l("Signed in as", "Conectado como", "Conectado como")}: <strong>{email}</strong></p><form action={acceptInvitation}><input name="token" type="hidden" value={token}/><button className="button auth-submit">{l("Accept invitation and open shared information", "Aceitar convite e ver informações", "Aceptar invitación y ver información")}<AppIcon name="chevron-right" size={18}/></button></form><form action={switchInvitationAccount}><input name="token" type="hidden" value={token}/><button className="quiet-button" type="submit">{l("Use another email", "Entrar com outro e-mail", "Entrar con otro correo")}</button></form></> : <Link className="button auth-submit" href={`/login?next=${encodeURIComponent(next)}`}>{l("Sign in to accept", "Entrar para aceitar", "Entrar para aceptar")}<AppIcon name="chevron-right" size={18}/></Link>}
    <p className="auth-footnote">{l("Do not forward the link. If it was sent to you by mistake, close this page. If already accepted, open your dashboard using the same email.", "Não encaminhe o link. Se recebeu por engano, feche esta página. Se já aceitou, abra seu painel com o mesmo e-mail.", "No reenvíe el enlace. Si lo recibió por error, cierre esta página. Si ya aceptó, abra su panel con el mismo correo.")}</p><Link className="quiet-button" href="/dashboard">{l("Open my dashboard", "Abrir meu painel", "Abrir mi panel")}</Link>
  </div>;
}
