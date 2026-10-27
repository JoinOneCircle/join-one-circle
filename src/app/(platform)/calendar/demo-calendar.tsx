"use client";
import { ChildPicker } from "@/components/child-picker";
import { useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { OverviewCalendar } from "@/components/overview-calendar";
import { useDemoState } from "@/lib/demo-store";
import { schoolDateKey, type DashboardReminder } from "@/lib/dashboard-calendar";

export function DemoCalendar() {
  const state = useDemoState();
  const [events, setEvents] = useState<DashboardReminder[]>([]);
  return <>
    <header className="workspace-header"><div><h1>Calendar</h1><p>Appointments, reviews and next steps in one place.</p></div></header>
    <p className="overview-demo-note">Local calendar preview. Events are not sent or saved to a school account.</p>
    <div className="demo-calendar-layout"><div className="overview-agenda"><OverviewCalendar reminders={events} today={schoolDateKey(new Date())} /></div>
      <section className="soft-card"><div className="soft-card-heading"><h2>Schedule an event</h2></div><form className="demo-calendar-form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const childId = String(data.get("child_id"));
        const child = state.children.find((item) => item.id === childId);
        const at = new Date(String(data.get("starts_at")));
        if (!child || Number.isNaN(at.getTime())) return;
        setEvents((current) => [...current, { id: crypto.randomUUID(), title: String(data.get("title")).trim(), childName: child.preferred_name, at: at.toISOString(), href: `/children/${childId}`, kind: "event" }]);
        form.reset();
      }}>
        <ChildPicker className="field" name="child_id" required defaultValue={((state.children.map((child) => ({ value: child.id, label: child.preferred_name })) ?? []))[0]?.value ?? ""} options={(state.children.map((child) => ({ value: child.id, label: child.preferred_name })) ?? [])} />
        <label className="field">Event title<input name="title" required maxLength={200} /></label>
        <label className="field">Date and time<input type="datetime-local" name="starts_at" required /></label>
        <button className="button button--small" type="submit"><AppIcon name="calendar" size={17} />Add preview event</button>
      </form></section>
    </div>
  </>;
}
