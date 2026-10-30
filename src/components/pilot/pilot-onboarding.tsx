"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { useRouter } from "next/navigation";
import { completeOrganisationOnboarding } from "@/app/onboarding/actions";
import { DEMO_WORKSPACE_COOKIE } from "@/lib/demo-workspace";
import { pilotSignupRole } from "@/lib/signup-role";
import { usePilotLanguage } from "./pilot-language";
import styles from "./pilot-onboarding.module.css";
import { VerificationContact } from "./verification-contact";

export function PilotOnboardingIntro({ initialRole, openSchoolPilot = false }: { initialRole?: string; openSchoolPilot?: boolean }) {
  const { l } = usePilotLanguage();
  const knownRole = pilotSignupRole(initialRole);
  return <div className="onboarding-copy" data-no-translate>
    <p className="eyebrow">{l("SCHOOL AND PARENTS", "ESCOLA E RESPONSÁVEIS", "ESCUELA Y RESPONSABLES")}</p>
    <h1>{l("A simpler start. The right access.", "Um começo simples. O acesso certo.", "Un comienzo sencillo. El acceso adecuado.")}</h1>
    <p>{l("The school creates the record and documents. Parents can read only the information selected by the school.", "A escola cria a ficha e os documentos. Os responsáveis leem apenas as informações selecionadas pela escola.", "La escuela crea la ficha y los documentos. Los responsables leen solo la información seleccionada por la escuela.")}</p>
    <ol><li className="active"><b><AppIcon name={knownRole ? "check" : "account"} size={17}/></b><span><strong>{knownRole ? l("Account created", "Conta criada", "Cuenta creada") : l("Complete your account", "Complete sua conta", "Complete su cuenta")}</strong><small>{l("Your own sign-in, no automatic access", "Seu login, sem acesso automático às fichas", "Su inicio de sesión, sin acceso automático a fichas")}</small></span></li>
      <li><b>2</b><span><strong>{l("Connect securely", "Conecte-se com segurança", "Conéctese con seguridad")}</strong><small>{openSchoolPilot ? l("School setup or a parent's invitation", "Cadastro da escola ou convite do responsável", "Registro escolar o invitación del responsable") : l("School verification or a personal invitation", "Verificação da escola ou convite individual", "Verificación escolar o invitación personal")}</small></span></li>
      <li><b>3</b><span><strong>{l("Open your workspace", "Abra seu painel", "Abra su panel")}</strong><small>{l("Only the records shared with you", "Somente as fichas autorizadas para você", "Solo las fichas autorizadas para usted")}</small></span></li></ol>
  </div>;
}

function SchoolSubmit({ demo, openSchoolPilot }: { demo: boolean; openSchoolPilot: boolean }) {
  const { pending } = useFormStatus(); const { l } = usePilotLanguage();
  return <button className="button" type="submit" disabled={pending}>{pending ? l("Setting up your school…", "Preparando sua escola…", "Preparando su escuela…") : demo ? l("Open local school preview", "Abrir prévia local da escola", "Abrir vista previa local") : openSchoolPilot ? l("Open school workspace", "Abrir painel da escola", "Abrir panel escolar") : l("Request school access", "Solicitar acesso da escola", "Solicitar acceso escolar")}<AppIcon name="chevron-right" size={18}/></button>;
}

export function PilotOnboarding({ demo, initialRole, error, openSchoolPilot = false }: { demo: boolean; initialRole?: string; error?: string; openSchoolPilot?: boolean }) {
  const { l } = usePilotLanguage();
  const [role, setRole] = useState(pilotSignupRole(initialRole));
  const [choosing, setChoosing] = useState(!pilotSignupRole(initialRole));
  const [schoolName, setSchoolName] = useState("");
  const router = useRouter();
  const choose = (value: "school" | "family") => { setRole(value); setChoosing(false); };
  return <section className={`onboarding-card ${styles.card}`} data-no-translate>
    <p className={styles.kicker}>{l("ACCOUNT SETUP", "CONFIGURAÇÃO DA CONTA", "CONFIGURACIÓN DE CUENTA")}</p>
    <h2>{choosing ? l("How will you use Join One Circle?", "Como você vai usar a Join One Circle?", "¿Cómo usará Join One Circle?") : role === "school" ? l("Tell us about your school", "Conte sobre sua escola", "Cuéntenos sobre su escuela") : l("Your invitation is the next step", "O próximo passo é o seu convite", "El siguiente paso es su invitación")}</h2>
    {error && !choosing && role === "school" && <p className="form-alert" role="alert">{l("Setup could not be completed. Check your school name and try again. If the problem continues, contact the platform administrator.", "Não foi possível concluir. Confira o nome da escola e tente novamente. Se continuar, fale com o administrador da plataforma.", "No se pudo completar. Revise el nombre escolar e inténtelo de nuevo. Si continúa, contacte con el administrador.")}</p>}
    {choosing ? <><p className={styles.description}>{l("Choose the option that matches your responsibilities.", "Escolha a opção que corresponde à sua função.", "Elija la opción que corresponde a su función.")}</p><div className="role-choice-grid" aria-label={l("Account type", "Tipo de conta", "Tipo de cuenta")}>
      <button className="role-choice" type="button" onClick={() => choose("school")}><span><AppIcon name="provision" size={24}/></span><strong>{l("School", "Escola", "Escuela")}</strong><small>{l("Create records, prepare documents and manage sharing.", "Cadastre fichas, prepare documentos e gerencie o compartilhamento.", "Cree fichas, prepare documentos y gestione el acceso.")}</small></button>
      <button className="role-choice" type="button" onClick={() => choose("family")}><span><AppIcon name="children" size={24}/></span><strong>{l("Parent / carer", "Responsável", "Responsable")}</strong><small>{l("Read information shared through a school invitation.", "Leia as informações compartilhadas pelo convite da escola.", "Lea la información compartida mediante una invitación escolar.")}</small></button>
    </div></> : <div className={styles.selection}><span><AppIcon name={role === "school" ? "provision" : "children"} size={20}/>{role === "school" ? l("School account", "Conta da escola", "Cuenta escolar") : l("Parent / carer account", "Conta de responsável", "Cuenta de responsable")}</span><button type="button" onClick={() => setChoosing(true)}>{l("Change account type", "Alterar perfil", "Cambiar perfil")}</button></div>}
    {!choosing && role === "school" && <form className="auth-form" action={completeOrganisationOnboarding}>
      <input type="hidden" name="role" value="school"/>
      <label className="field">{l("School name", "Nome da escola", "Nombre de la escuela")}<input required name="organisation_name" maxLength={160} autoComplete="organization" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder={l("e.g. Greenfield Primary School", "Ex.: Escola Greenfield", "Ej.: Escuela Greenfield")}/></label>
      <div className={styles.notice}><AppIcon name={openSchoolPilot ? "check" : "lock"} size={21}/><div><strong>{openSchoolPilot ? l("Ready to test", "Pronto para testar", "Listo para probar") : l("What happens next?", "O que acontece depois?", "¿Qué ocurre después?")}</strong><p>{openSchoolPilot ? l("Schools can start the pilot without manual approval. Your workspace is separate from other schools. Use fictional data while testing; parents still need an individual invitation.", "As escolas podem começar o piloto sem aprovação manual. Seu espaço é separado das outras escolas. Use dados fictícios nos testes; responsáveis continuam precisando de um convite individual.", "Las escuelas pueden empezar el piloto sin aprobación manual. Su espacio está separado de otras escuelas. Use datos ficticios en las pruebas; los responsables siguen necesitando una invitación individual.") : l("We will check the school and its authorised contact before opening the workspace. No child records are shared automatically.", "Vamos conferir a escola e o contato autorizado antes de abrir o painel. Nenhuma ficha de criança é compartilhada automaticamente.", "Comprobaremos la escuela y el contacto autorizado antes de abrir el panel. Ninguna ficha se comparte automáticamente.")}</p></div></div>
      <VerificationContact showDeadline={!openSchoolPilot}/>
      <SchoolSubmit demo={demo} openSchoolPilot={openSchoolPilot}/>
    </form>}
    {!choosing && role === "family" && <div className={styles.parentSteps}><p>{l("No need to enter your child's details again. The school connects your account to the correct record through your invitation.", "Você não precisa cadastrar os dados da criança novamente. A escola conecta sua conta à ficha certa pelo convite.", "No necesita registrar de nuevo los datos del menor. La escuela conecta su cuenta con la ficha correcta mediante la invitación.")}</p>
      <ol>{[l("Find the personal invitation link shared by your school.", "Abra o link individual de convite compartilhado pela escola.", "Abra el enlace personal de invitación compartido por la escuela."), l("Use this account only if its email matches the invited email.", "Use esta conta apenas se o e-mail for o mesmo que a escola convidou.", "Use esta cuenta solo si su correo coincide con el invitado."), l("Accept the invitation to read what the school selected for you.", "Aceite o convite para ler o que a escola selecionou para você.", "Acepte la invitación para leer lo seleccionado por la escuela.")].map(step => <li key={step}>{step}</li>)}</ol>
      <div className={styles.notice}><AppIcon name="mail" size={21}/><p>{l("No invitation yet? Ask the school to share your link. Your account is ready, but no child information is available until access is granted.", "Ainda não recebeu? Peça seu link à escola. Sua conta está pronta, mas nenhuma informação da criança aparece antes da autorização.", "¿Aún no la recibió? Pida su enlace a la escuela. Su cuenta está lista, pero no hay información del menor hasta la autorización.")}</p></div>
      <Link className="button" href="/parent">{l("Check shared information", "Verificar informações compartilhadas", "Consultar información compartida")}<AppIcon name="chevron-right" size={18}/></Link>
      {demo && <button type="button" className="quiet-button" onClick={() => { document.cookie = `${DEMO_WORKSPACE_COOKIE}=family; path=/; samesite=lax`; router.push("/dashboard"); router.refresh(); }}>{l("Preview parent reading view", "Simular painel de leitura dos pais", "Simular vista de lectura de padres")}</button>}
    </div>}
  </section>;
}
