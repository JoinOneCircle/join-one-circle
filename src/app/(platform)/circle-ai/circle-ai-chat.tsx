"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ViewerRole } from "@/lib/platform-data";
import { useDemoState } from "@/lib/demo-store";
import { AppIcon } from "@/components/app-icon";

type Message = { role: "assistant" | "user"; text: string };

function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n").filter((line, index, all) => line.trim() || (index > 0 && all[index - 1].trim()));
  return <div className="message-content">{lines.map((line, index) => {
    const clean = line.replace(/^#{1,4}\s*/, "").replace(/^\*\*(.*?)\**:?$/, "$1");
    if (/^#{1,4}\s/.test(line)) return <strong className="message-heading" key={index}>{clean}</strong>;
    if (/^[-*•]\s+/.test(line)) return <span className="message-list-item" key={index}>{line.replace(/^[-*•]\s+/, "")}</span>;
    if (/^\d+[.)]\s+/.test(line)) return <span className="message-list-item message-list-item--numbered" key={index}>{line}</span>;
    return <p key={index}>{line}</p>;
  })}</div>;
}

const opening: Record<"en" | "pt" | "es", string> = {
  en: "Hello. I can explain the authorised record, prepare a letter or form draft, and help identify the next action. What is happening?",
  pt: "Olá. Posso explicar o registro autorizado, preparar uma carta ou formulário e ajudar a identificar a próxima ação. O que está acontecendo?",
  es: "Hola. Puedo explicar el registro autorizado, preparar una carta o formulario y ayudar a identificar la próxima acción. ¿Qué está pasando?",
};

function demoReply(locale: "en" | "pt" | "es", childName: string, recordCount: number) {
  if (locale === "pt") return `Para ${childName}, encontrei ${recordCount} ponto(s) no registro que podem ajudar a organizar o próximo passo.\n\nUma boa sequência seria:\n• adicionar uma observação curta em Necessidades ou Perfil;\n• criar uma ação com responsável e prazo;\n• guardar o documento relevante.\n\nQuer que eu ajude a transformar isso em uma lista de ações?`;
  if (locale === "es") return `Para ${childName}, encontré ${recordCount} punto(s) en el registro que pueden ayudar a organizar el siguiente paso.\n\nUna buena secuencia sería:\n• añadir una observación breve en Necesidades o Perfil;\n• crear una acción con responsable y fecha límite;\n• guardar el documento relevante.\n\n¿Quieres que te ayude a convertir esto en una lista de acciones?`;
  return `For ${childName}, I found ${recordCount} point(s) in the record that can help organise the next step.\n\nA helpful sequence could be:\n• add a short note in Needs or Passport;\n• create an action with an owner and due date;\n• save the relevant document.\n\nWould you like me to turn this into an action list?`;
}

export function CircleAiChat({ childId, childName, viewerRole, demo = false }: { childId: string; childName: string; viewerRole: ViewerRole; demo?: boolean }) {
  const demoState = useDemoState();
  const [locale, setLocale] = useState<"en" | "pt" | "es">("en");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: opening.en }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(() => demo ? true : null);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedDemoChildId, setSelectedDemoChildId] = useState(childId);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedDemoChild = demoState.children.find((child) => child.id === selectedDemoChildId) ?? demoState.children[0];
  const activeChildId = demo && selectedDemoChild ? selectedDemoChild.id : childId;
  const activeChildName = demo && selectedDemoChild ? selectedDemoChild.preferred_name : childName;

  useEffect(() => {
    const saved = localStorage.getItem("join-one-circle-language");
    const next = saved === "pt" || saved === "es" ? saved : "en";
    const timer = window.setTimeout(() => { setLocale(next); setMessages([{ role: "assistant", text: opening[next] }]); }, 0);
    const syncLanguage = (event: Event) => {
      const selected = (event as CustomEvent<"en" | "pt" | "es">).detail;
      setLocale(selected);
      setMessages((current) => current.length === 1 ? [{ role: "assistant", text: opening[selected] }] : current);
    };
    window.addEventListener("join-one-circle-language-change", syncLanguage);
    if (!demo) fetch("/api/circle-ai", { cache: "no-store" }).then((response) => response.json()).then((data) => setConfigured(Boolean(data.configured))).catch(() => setConfigured(false));
    return () => { window.clearTimeout(timer); window.removeEventListener("join-one-circle-language-change", syncLanguage); };
  }, [demo]);

  useEffect(() => {
    if (!demo) return;
    const saved = localStorage.getItem("join-one-circle-ai-child");
    if (saved && demoState.children.some((child) => child.id === saved) && saved !== selectedDemoChildId) {
      const timer = window.setTimeout(() => setSelectedDemoChildId(saved), 0);
      return () => window.clearTimeout(timer);
    }
  }, [demo, demoState.children, selectedDemoChildId]);

  useEffect(() => {
    if (!demo || !selectedDemoChildId) return;
    localStorage.setItem("join-one-circle-ai-child", selectedDemoChildId);
    const timer = window.setTimeout(() => {
      setMessages([{ role: "assistant", text: opening[locale] }]);
      setInput("");
      setConversationId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demo, selectedDemoChildId, locale]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    const nextMessages = [...messages, { role: "user" as const, text: question }];
    setMessages(nextMessages); setInput(""); setError(""); setLoading(true);
    if (demo) {
      const recordCount = demoState.records.filter((item) => item.child_id === activeChildId).length;
      window.setTimeout(() => {
        setMessages((current) => [...current, { role: "assistant", text: demoReply(locale, activeChildName, recordCount) }]);
        setLoading(false);
      }, 350);
      return;
    }
    try {
      const response = await fetch("/api/circle-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: activeChildId, locale, viewerRole, conversationId, messages: nextMessages.slice(1).map((item) => ({ role: item.role, content: item.text })) }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "request-failed");
      setMessages((current) => [...current, { role: "assistant", text: data.reply }]);
      setConversationId(data.conversationId ?? conversationId);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "request-failed";
      setError(code === "not-configured" ? "Circle AI is unavailable right now. Please try again later." : "Circle AI could not answer this time. Your message is still here; please try again.");
    } finally { setLoading(false); }
  };

  const suggestions = locale === "pt" ? ["Explique o documento mais recente", "Prepare uma carta usando o registro", "Qual é a próxima ação?"] : locale === "es" ? ["Explica el documento más reciente", "Prepara una carta usando el registro", "¿Cuál es la próxima acción?"] : ["Explain the latest document", "Prepare a letter using the record", "What is the next action?"];
  return <div className="ai-workspace">
    <div className="ai-context"><p><span className="status-dot" /> Authorised context</p><strong>{activeChildName} · child record</strong><small>Only information available to your account can be used. Identifiers are removed before AI processing.</small></div>
    {configured === false && <div className="ai-setup-notice" role="status"><strong>Circle AI is unavailable right now.</strong><span>Please try again later.</span></div>}
    <div className="ai-chat" id="conversation-history" ref={listRef}>{messages.map((message,index) => <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "AI" : locale === "pt" ? "Você" : locale === "es" ? "Tú" : "You"}</span><MessageContent text={message.text} /></div>)}{loading && <div className="chat-message"><span>AI</span><div className="ai-thinking" aria-label="Circle AI is thinking"><i/><i/><i/></div></div>}</div>
    {messages.length === 1 && <div className="ai-suggestions">{suggestions.map((suggestion) => <button type="button" onClick={() => setInput(suggestion)} key={suggestion}>{suggestion}</button>)}</div>}
    {error && <div className="form-alert ai-error" role="alert">{error}</div>}
    <form className="ai-composer" onSubmit={send}>{demo && <label className="field ai-demo-child">Child<select value={selectedDemoChild?.id ?? ""} onChange={(event) => setSelectedDemoChildId(event.target.value)}>{demoState.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>}<label className="sr-only" htmlFor="circle-ai-message">Message Circle AI</label><textarea id="circle-ai-message" value={input} onChange={(event) => setInput(event.target.value)} placeholder={locale === "pt" ? "Conte o que está acontecendo…" : locale === "es" ? "Cuéntanos qué está pasando…" : "Tell us what is happening…"} /><button type="submit" disabled={loading || configured === false || (demo && !selectedDemoChild)} aria-label="Send message"><AppIcon name="send" size={20} /></button></form>
    <small className="ai-disclaimer">This is guidance, not legal advice. AI can make mistakes. Check important information. Nothing is sent automatically.</small>
  </div>;
}
