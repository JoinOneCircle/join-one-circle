"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const sharedTables = ["children", "child_record_items", "child_documents", "child_actions", "child_circle_memberships", "institutional_workspace_items"] as const;

/** Refreshes an open authorised workspace when another circle member changes
 * a shared record. RLS still decides which events and data the browser gets. */
export function CircleLiveSync() {
  const router = useRouter();
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const refresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        router.refresh();
        refreshTimer.current = null;
      }, 250);
    };
    const channel = supabase.channel("authorised-circle-updates");
    sharedTables.forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh));
    channel.subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
