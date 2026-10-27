"use client";
import { createContext, useEffect, useState } from "react";
type Language = "en" | "pt" | "es";
export const InterfaceLanguageContext = createContext<Language>("en");
export function InterfaceLanguageProvider({ initialLanguage, children }: { initialLanguage: string; children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage === "pt" || initialLanguage === "es" ? initialLanguage : "en");
  useEffect(() => {
    const sync = () => { const value = document.documentElement.lang.split("-")[0]; setLanguage(value === "pt" || value === "es" ? value : "en"); };
    sync(); window.addEventListener("join-one-circle-language-change", sync);
    return () => window.removeEventListener("join-one-circle-language-change", sync);
  }, []);
  return <InterfaceLanguageContext.Provider value={language}>{children}</InterfaceLanguageContext.Provider>;
}
