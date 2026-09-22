"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppIcon, type AppIconName } from "./app-icon";
import { PlatformNavLink } from "./platform-nav-link";

type NavItem = { icon: AppIconName; label: string; href: string };

export function MobileNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const isOpen = openedOnPath === pathname;
  const hasActiveMore = pathname === "/account" || items.slice(4).some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const moreButton = useRef<HTMLButtonElement>(null);

  return <nav className="mobile-bottom-nav" aria-label="Main navigation" onKeyDown={(event) => {
    if (event.key === "Escape" && isOpen) { setOpenedOnPath(null); moreButton.current?.focus(); }
  }}>
    {items.slice(0, 4).map((item) => <PlatformNavLink key={item.href} {...item} mobile />)}
    <div className="mobile-more-nav">
      <button ref={moreButton} type="button" className="mobile-more-toggle" data-active={hasActiveMore || undefined} aria-expanded={isOpen} aria-controls="mobile-more-links" onClick={() => setOpenedOnPath(isOpen ? null : pathname)}>
        <AppIcon name="more" /><span>More</span>
      </button>
      {isOpen && <button className="mobile-more-backdrop" type="button" tabIndex={-1} aria-label="Close menu" onClick={() => { setOpenedOnPath(null); moreButton.current?.focus(); }} />}
      <div className="mobile-more-links" id="mobile-more-links" role="group" aria-label="More" hidden={!isOpen}>
        {items.slice(4).map((item) => <PlatformNavLink key={item.href} {...item} mobile onClick={() => setOpenedOnPath(null)} />)}
        <PlatformNavLink href="/account" icon="account" label="Account" mobile onClick={() => setOpenedOnPath(null)} />
      </div>
    </div>
  </nav>;
}
