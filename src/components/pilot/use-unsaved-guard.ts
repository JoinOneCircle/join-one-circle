"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { NavigationRequest } from "./navigation-prompt";
export function useUnsavedGuard(dirty: boolean, message: string) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    let leavingPage = false;
    const unload = (event: BeforeUnloadEvent) => { if (!leavingPage) { event.preventDefault(); event.returnValue = ""; } };
    const currentUrl = window.location.href;
    const currentState = window.history.state;
    let approvedTraversal = false;
    const ask = (proceed: () => void) => window.dispatchEvent(new CustomEvent<NavigationRequest>("joc-confirm-navigation", { detail: { message, proceed } }));
    const sameRecord = (url: string) => { const next = new URL(url, currentUrl), current = new URL(currentUrl); return next.pathname === current.pathname && next.search === current.search; };
    // Chrome/Edge can cancel Back/Forward before Next receives popstate.
    // Retain a capture-phase fallback for browsers without Navigation API,
    // and for traversals the browser marks as non-cancellable.
    const navigation = (window as unknown as { navigation?: EventTarget & { traverseTo: (key: string) => { finished: Promise<unknown> } } }).navigation;
    const beforeTraversal = (event: Event) => {
      const nav = event as Event & { navigationType?: string; destination?: { url: string; key: string; sameDocument: boolean } };
      if (nav.navigationType !== "traverse" || !nav.destination?.sameDocument || !event.cancelable || sameRecord(nav.destination.url)) return;
      if (approvedTraversal) return;
      event.preventDefault();
      const key = nav.destination.key;
      ask(() => { approvedTraversal = true; navigation?.traverseTo(key).finished.catch(() => { approvedTraversal = false; }); });
    };
    const traverse = (event: PopStateEvent) => {
      if (approvedTraversal) { approvedTraversal = false; return; }
      if (sameRecord(window.location.href)) return;
      event.stopImmediatePropagation();
      // Restore the current entry without a route render or a second prompt.
      window.history.pushState(currentState, "", currentUrl);
      ask(() => { approvedTraversal = true; window.history.back(); });
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]"); if (!link || link.getAttribute("target") === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.getAttribute("href")!, location.href);
      if (!["http:", "https:"].includes(target.protocol)) return;
      if (target.pathname === location.pathname && target.search === location.search && target.hash) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      ask(() => { if (target.origin === location.origin) router.push(`${target.pathname}${target.search}${target.hash}`); else { leavingPage = true; window.location.assign(target.href); } });
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    navigation?.addEventListener("navigate", beforeTraversal);
    window.addEventListener("popstate", traverse, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); navigation?.removeEventListener("navigate", beforeTraversal); window.removeEventListener("popstate", traverse, true); };
  }, [dirty, message, router]);
  return (proceed: () => void) => {
    if (!dirty) proceed();
    else window.dispatchEvent(new CustomEvent<NavigationRequest>("joc-confirm-navigation", { detail: { message, proceed } }));
  };
}
