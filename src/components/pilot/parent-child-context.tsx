"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const ParentChildContext = createContext({ enabled: false, childId: "", selectChild: (id: string) => { void id; } });
// A navigation preference only, never a permission or a cached child record.
// Selection survives parent sidebar navigation, but not signing out.
export function ParentChildProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [childId, selectChild] = useState("");
  const value = useMemo(() => ({ enabled, childId, selectChild }), [enabled, childId]);
  return <ParentChildContext.Provider value={value}>{children}</ParentChildContext.Provider>;
}
export const useParentChildSelection = () => useContext(ParentChildContext);
