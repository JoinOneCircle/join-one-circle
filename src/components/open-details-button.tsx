"use client";

export function OpenDetailsButton({ targetId, children }: { targetId: string; children: React.ReactNode }) {
  const open = () => {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLDetailsElement)) return;
    target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.querySelector("input")?.focus();
  };
  return <button className="button button--small" type="button" onClick={open}>{children}</button>;
}
