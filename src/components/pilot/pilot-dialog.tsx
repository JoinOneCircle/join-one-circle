"use client";
import { useEffect, useRef } from "react";
export function PilotDialog({ children, titleId, close, busy = false }: { children: React.ReactNode; titleId: string; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="pilot-modal pilot-native-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>{children}</dialog>;
}
