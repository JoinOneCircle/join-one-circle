"use client";

import { useEffect, useState } from "react";

type Language = "en" | "pt" | "es";

function languageFromDocument(): Language {
  const language = document.documentElement.lang.toLowerCase().split("-")[0];
  return language === "pt" || language === "es" ? language : "en";
}

function localeFor(language: Language) {
  return language === "pt" ? "pt-BR" : language === "es" ? "es-ES" : "en-GB";
}

export function formatLocalizedDate(value: Date | string, language: Language, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeFor(language), options).format(new Date(value));
}

export function LocalizedDate({
  value,
  dateStyle = "medium",
  timeStyle,
  dateTime,
}: {
  value: Date | string;
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
  dateTime?: string;
}) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const sync = () => setLanguage(languageFromDocument());
    sync();
    window.addEventListener("join-one-circle-language-change", sync);
    return () => window.removeEventListener("join-one-circle-language-change", sync);
  }, []);

  return <time dateTime={dateTime}>{formatLocalizedDate(value, language, { dateStyle, timeStyle })}</time>;
}
