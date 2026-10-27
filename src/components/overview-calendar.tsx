"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppIcon } from "./app-icon";
import { monthCells, schoolDateKey, type DashboardReminder } from "@/lib/dashboard-calendar";
import { usePilotLanguage } from "./pilot/pilot-language";

export function OverviewCalendar({ reminders, today, showUpcoming = false, embedded = false, onDaySelect }: { reminders: DashboardReminder[]; today: string; showUpcoming?: boolean; embedded?: boolean; onDaySelect?: (date: string) => void }) {
  const { l } = usePilotLanguage();
  const [month, setMonth] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);
  const [locale, setLocale] = useState("en-GB");
  useEffect(() => {
    const sync = () => setLocale(document.documentElement.lang === "pt" ? "pt-BR" : document.documentElement.lang === "es" ? "es-ES" : "en-GB");
    sync(); window.addEventListener("join-one-circle-language-change", sync);
    return () => window.removeEventListener("join-one-circle-language-change", sync);
  }, []);
  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(month.year, month.month + delta, 1));
    const date = next.toISOString().slice(0, 10);
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelected(date);
  };
  const showingUpcoming = showUpcoming && selected === today;
  const selectedItems = showingUpcoming ? reminders.filter((item) => schoolDateKey(item.at) >= today).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 3) : reminders.filter((item) => schoolDateKey(item.at) === selected);
  const weekdayNames = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + index))));
  const longDate = (date: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return <>
    <section className="soft-card overview-calendar" aria-labelledby="overview-calendar-title">
      <div className="soft-card-heading"><h2 id="overview-calendar-title">{l("Calendar", "Calendário", "Calendario")}</h2>{!embedded && <Link href="/calendar" aria-label={l("Open calendar", "Abrir calendário", "Abrir calendario")}><AppIcon name="chevron-right" size={18} /></Link>}</div>
      <div className="calendar-month-bar"><strong data-no-translate>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(month.year, month.month, 1)))}</strong><div><button type="button" aria-label={l("Previous month", "Mês anterior", "Mes anterior")} onClick={() => moveMonth(-1)}><AppIcon name="chevron-left" size={16} /></button><button type="button" aria-label={l("Next month", "Próximo mês", "Mes siguiente")} onClick={() => moveMonth(1)}><AppIcon name="chevron-right" size={16} /></button></div></div>
      <div className="overview-month-grid" role="group" aria-label={l("Choose a day", "Escolha um dia", "Elija un día")}>
        {weekdayNames.map((day, index) => <span className="calendar-weekday" key={index} data-no-translate>{day}</span>)}
        {monthCells(month.year, month.month).map((date, index) => date ? <button key={date} type="button" data-selected={selected === date || undefined} data-today={today === date || undefined} data-has-events={reminders.some((item) => schoolDateKey(item.at) === date) || undefined} aria-pressed={selected === date} aria-label={longDate(date)} data-no-translate onClick={() => { setSelected(date); onDaySelect?.(date); }}>{Number(date.slice(-2))}</button> : <span key={`empty-${index}`} />)}
      </div>
      <p className="calendar-legend"><i aria-hidden="true" />{l("Scheduled events and deadlines", "Eventos e prazos agendados", "Eventos y plazos programados")}</p>
      {!embedded && <Link className="soft-text-link" href="/calendar">{l("Manage calendar", "Gerenciar calendário", "Gestionar calendario")}<AppIcon name="chevron-right" size={15} /></Link>}
    </section>
    <section className="soft-card overview-reminders" aria-labelledby="overview-reminders-title">
      <div className="soft-card-heading"><h2 id="overview-reminders-title">{showingUpcoming ? l("Upcoming reminders", "Próximos lembretes", "Próximos recordatorios") : l("Reminders", "Lembretes", "Recordatorios")}</h2><button className="soft-text-link" type="button" onClick={() => { setSelected(today); setMonth({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }); }}>{l("Today", "Hoje", "Hoy")}</button></div>
      {showingUpcoming ? <p className="soft-card-caption">{l("Stay one step ahead.", "Antecipe os próximos passos.", "Anticipe los próximos pasos.")}</p> : <p className="soft-card-caption" data-no-translate>{longDate(selected)}</p>}
      {selectedItems.length ? <div className="overview-reminder-list">{selectedItems.map((item) => <Link href={item.href} key={item.id}><span className="reminder-date" data-no-translate><b>{Number(schoolDateKey(item.at).slice(-2))}</b><small>{new Intl.DateTimeFormat(locale, {month:"short",timeZone:"Europe/London"}).format(new Date(item.at))}</small></span><span><strong data-no-translate>{item.title === "Plan review" ? l("Plan review", "Revisão do plano", "Revisión del plan") : item.title}</strong><small data-no-translate>{item.childName}{item.kind === "event" ? ` · ${new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(item.at))}` : ""}</small></span><AppIcon name="arrow" size={16} /></Link>)}</div> : <p className="soft-empty">{showingUpcoming ? l("No upcoming reminders.", "Nenhum lembrete próximo.", "No hay próximos recordatorios.") : l("Nothing scheduled for this day.", "Nada agendado para este dia.", "No hay nada programado para este día.")}</p>}
    </section>
  </>;
}
