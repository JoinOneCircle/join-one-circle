"use client";

import { useEffect, useState } from "react";
import { translateUi } from "@/lib/ui-translations";

export type SupportedLanguage = "en" | "pt" | "es";

const storageKey = "join-one-circle-language";
const eventName = "join-one-circle-language-change";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function supportedLanguage(value?: string | null): SupportedLanguage {
  const language = value?.toLowerCase().split("-")[0];
  return language === "pt" || language === "es" ? language : "en";
}

function savedCookieLanguage(): SupportedLanguage | null {
  const match = document.cookie.match(/(?:^|;\s*)joc_language=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return value === "en" || value === "pt" || value === "es" ? value : null;
}

function initialLanguage(): SupportedLanguage {
  return supportedLanguage(localStorage.getItem(storageKey) || savedCookieLanguage() || document.documentElement.dataset.language || navigator.language);
}

function saveLanguage(language: SupportedLanguage) {
  localStorage.setItem(storageKey, language);
  document.cookie = `joc_language=${language}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = language;
  window.dispatchEvent(new CustomEvent(eventName, { detail: language }));
}

function translateString(source: string, language: SupportedLanguage) {
  return translateUi(language, source);
}

function translateDocument(language: SupportedLanguage) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName) && !parent.closest("[data-no-translate]")) {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
      const source = originalText.get(node) ?? "";
      const trimmed = source.trim();
      if (trimmed) node.nodeValue = source.replace(trimmed, translateString(trimmed, language));
    }
    node = walker.nextNode() as Text | null;
  }
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    let saved = originalAttributes.get(element);
    if (!saved) { saved = new Map(); originalAttributes.set(element, saved); }
    for (const name of ["placeholder", "aria-label", "title"]) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name) ?? "";
      if (!saved.has(name)) saved.set(name, current);
      else {
        const stored = saved.get(name) ?? "";
        const expected = translateString(stored, language);
        if (current !== stored && current !== expected) saved.set(name, current);
      }
      const translated = translateString(saved.get(name) ?? "", language);
      if (current !== translated) element.setAttribute(name, translated);
    }
  });
}

export function LanguagePreference() {
  useEffect(() => {
    const language = initialLanguage();
    saveLanguage(language);
    translateDocument(language);
    const sync = (event: Event) => translateDocument((event as CustomEvent<SupportedLanguage>).detail);
    const observer = new MutationObserver(() => translateDocument(supportedLanguage(localStorage.getItem(storageKey))));
    window.addEventListener(eventName, sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    return () => { window.removeEventListener(eventName, sync); observer.disconnect(); };
  }, []);
  return null;
}

export function LanguageSelect({ ariaLabel = "Language" }: { ariaLabel?: string }) {
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  useEffect(() => {
    const initial = initialLanguage();
    saveLanguage(initial);
    const timer = window.setTimeout(() => setLanguage(initial), 0);
    const sync = (event: Event) => setLanguage((event as CustomEvent<SupportedLanguage>).detail);
    window.addEventListener(eventName, sync);
    return () => { window.clearTimeout(timer); window.removeEventListener(eventName, sync); };
  }, []);

  const changeLanguage = (next: SupportedLanguage) => {
    setLanguage(next);
    saveLanguage(next);
    // Keep the preference with the signed-in account as well as this browser.
    // A guest/local demo receives a harmless 401 and still keeps its local choice.
    void fetch("/api/preferences/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: next }),
      keepalive: true,
    }).catch(() => undefined);
  };

  return <select aria-label={ariaLabel} value={language} onChange={(event) => changeLanguage(supportedLanguage(event.target.value))}>
    <option value="en">English</option>
    <option value="pt">Português</option>
    <option value="es">Español</option>
  </select>;
}
