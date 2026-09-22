"use client";

import { useState } from "react";
import { AppIcon } from "@/components/app-icon";

type Attachment = { id: string; title: string };

export function RecordItemActions({ title, summary, area, updatedAt, attachment }: { title: string; summary: string; area: string; updatedAt: string; attachment?: Attachment }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const content = [`${area}: ${title}`, summary, `Updated: ${new Date(updatedAt).toISOString()}`].filter(Boolean).join("\n\n");

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(content);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy-failed");
      }
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "record-update"}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return <div className="record-item-actions">
    <button type="button" onClick={copy} title="Copy update"><AppIcon name="reports" size={15} />{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}</button>
    <button type="button" onClick={download} title="Download update"><AppIcon name="download" size={15} />Download</button>
    {attachment && <a href={`/api/documents/${attachment.id}/download?mode=download`} title={`Download ${attachment.title}`}><AppIcon name="documents" size={15} />Download attachment</a>}
  </div>;
}
