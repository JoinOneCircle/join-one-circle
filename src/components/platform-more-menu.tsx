"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AppIcon } from "./app-icon";
import { PlatformNavLink } from "./platform-nav-link";
import type { PlatformNavItem } from "@/lib/platform-navigation";

export function PlatformMoreMenu({ items }: { items: PlatformNavItem[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const active = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return <details className="rail-more" ref={menu} onKeyDown={(event) => {
    if (event.key === "Escape" && menu.current) {
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label="More tools" title="More tools" data-active={active || undefined}>
      <AppIcon name="more" /><span className="nav-label">More tools</span>
    </summary>
    <nav className="rail-more-panel" aria-label="More tools"><p>More tools</p>
      {items.map((item) => <PlatformNavLink key={item.href} {...item} onClick={() => { if (menu.current) menu.current.open = false; }} />)}
    </nav>
  </details>;
}
