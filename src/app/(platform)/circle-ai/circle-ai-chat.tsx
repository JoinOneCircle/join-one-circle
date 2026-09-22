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

export function CircleAiChat({ childId, childName, childOptions, viewerRole, demo = false }: { childId: string; childName: string; childOptions: { id: string; preferred_name: string }[]; viewerRole: ViewerRole; demo?: boolean }) {
  const demoState = useDemoState();
  const [locale, setLocale] = useState<"en" | "pt" | "es">("en");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: opening.en }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(() => demo ? true : null);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedLiveChildId, setSelectedLiveChildId] = useState(childId);
  const [selectedDemoChildId, setSelectedDemoChildId] = useState(childId);
  // Restore the browser choice once. Previously this effect kept reading an
  // older saved value while the next effect wrote the current one, so the
  // selected child could alternate forever between two records.
  const [demoChildPreferenceRestored, setDemoChildPreferenceRestored] = useState(!demo);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedDemoChild = demoState.children.find((child) => child.id === selectedDemoChildId) ?? demoState.children[0];
  const selectedLiveChild = childOptions.find((child) => child.id === selectedLiveChildId) ?? childOptions.find((child) => child.id === childId);
  const activeChildId = demo && selectedDemoChild ? selectedDemoChild.id : selectedLiveChild?.id ?? childId;
  const activeChildName = demo && selectedDemoChild ? selectedDemoChild.preferred_name : selectedLiveChild?.preferred_name ?? childName;

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
    if (!demo) {
      let cancelled = false;
      const liveTimer = window.setTimeout(() => {
        setConversationId(null);
        setMessages([{ role: "assistant", text: opening[next] }]);
        fetch(`/api/circle-ai?childId=${encodeURIComponent(activeChildId)}`, { cache: "no-store" })
          .then(async (response) => ({ response, data: await response.json() }))
          .then(({ response, data }) => {
            if (!response.ok) throw new Error(data.error || "history-unavailable");
            if (cancelled) return;
            setConfigured(Boolean(data.configured));
            const latest = Array.isArray(data.conversations) ? data.conversations[0] : null;
            const savedMessages = Array.isArray(latest?.ai_messages)
              ? latest.ai_messages
                .filter((message: { role?: unknown; content?: unknown }) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
                .sort((a: { created_at?: string }, b: { created_at?: string }) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
                .map((message: { role: "user" | "assistant"; content: string }) => ({ role: message.role, text: message.content }))
              : [];
            if (latest?.id && savedMessages.length) {
              setConversationId(latest.id);
              setMessages([{ role: "assistant", text: opening[next] }, ...savedMessages]);
            }
          })
          .catch(() => { if (!cancelled) setConfigured(false); });
      }, 0);
      return () => { cancelled = true; window.clearTimeout(timer); window.clearTimeout(liveTimer); window.removeEventListener("join-one-circle-language-change", syncLanguage); };
    }
    return () => { window.clearTimeout(timer); window.removeEventListener("join-one-circle-language-change", syncLanguage); };
  }, [demo, activeChildId]);

  useEffect(() => {
    if (demo) return;
    const url = new URL(window.location.href);
    url.searchParams.set("child", activeChildId);
    window.history.replaceState(null, "", url);
  }, [activeChildId, demo]);

  useEffect(() => {
    if (!demo || demoChildPreferenceRestored) return;
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("join-one-circle-ai-child");
      if (saved && demoState.children.some((child) => child.id === saved)) {
        setSelectedDemoChildId((current) => current === saved ? current : saved);
      }
      setDemoChildPreferenceRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demo, demoChildPreferenceRestored, demoState.children]);

  useEffect(() => {
    if (!demo || !demoChildPreferenceRestored || !selectedDemoChildId) return;
    localStorage.setItem("join-one-circle-ai-child", selectedDemoChildId);
    const timer = window.setTimeout(() => {
      setMessages([{ role: "assistant", text: opening[locale] }]);
      setInput("");
      setConversationId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demo, demoChildPreferenceRestored, selectedDemoChildId, locale]);

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
    <div className="ai-context"><p><span className="status-dot" /> Authorised context</p><strong><span data-no-translate>{activeChildName}</span> · child record</strong><small>Only information available to your account can be used. Identifiers are removed before AI processing.</small></div>
    {configured === false && <div className="ai-setup-notice" role="status"><strong>Circle AI is unavailable right now.</strong><span>Please try again later.</span></div>}
    <div className="ai-chat" id="conversation-history" ref={listRef}>{messages.map((message,index) => <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "AI" : locale === "pt" ? "Você" : locale === "es" ? "Tú" : "You"}</span><MessageContent text={message.text} /></div>)}{loading && <div className="chat-message"><span>AI</span><div className="ai-thinking" aria-label="Circle AI is thinking"><i/><i/><i/></div></div>}</div>
    {messages.length === 1 && <div className="ai-suggestions">{suggestions.map((suggestion) => <button type="button" onClick={() => setInput(suggestion)} key={suggestion}>{suggestion}</button>)}</div>}
    {error && <div className="form-alert ai-error" role="alert">{error}</div>}
    <form className="ai-composer" onSubmit={send}>{demo ? <label className="field ai-child-select">Child<select value={selectedDemoChild?.id ?? ""} onChange={(event) => setSelectedDemoChildId(event.target.value)} disabled={loading}>{demoState.children.map((child) => <option data-no-translate key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label> : childOptions.length > 1 && <label className="field ai-child-select">Child<select value={activeChildId} onChange={(event) => setSelectedLiveChildId(event.target.value)} disabled={loading}>{childOptions.map((child) => <option data-no-translate key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>}<label className="sr-only" htmlFor="circle-ai-message">Message Circle AI</label><textarea id="circle-ai-message" value={input} onChange={(event) => setInput(event.target.value)} placeholder={locale === "pt" ? "Conte o que está acontecendo…" : locale === "es" ? "Cuéntanos qué está pasando…" : "Tell us what is happening…"} /><button type="submit" disabled={loading || configured === false || (demo && !selectedDemoChild)} aria-label="Send message"><AppIcon name="send" size={20} /></button></form>
    <small className="ai-disclaimer">This is guidance, not legal advice. AI can make mistakes. Check important information. Nothing is sent automatically.</small>
  </div>;
}
