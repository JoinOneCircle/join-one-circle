"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon, type AppIconName } from "./app-icon";

export function PlatformNavLink({ href, icon, label, mobile = false, onClick }: { href: string; icon: AppIconName; label: string; mobile?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return <Link href={href} data-active={active || undefined} aria-current={active ? "page" : undefined} onClick={onClick}>{mobile ? <AppIcon name={icon} /> : <span className="nav-icon"><AppIcon name={icon} /></span>}<span>{label}</span></Link>;
}
