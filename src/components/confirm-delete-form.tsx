"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/app-icon";

type DeleteAction = (formData: FormData) => void | Promise<void>;

type ConfirmDeleteFormProps = {
  action: DeleteAction;
  values: Record<string, string>;
  itemName: string;
  itemType: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerIcon?: AppIconName;
  triggerAriaLabel?: string;
};

/**
 * Keeps destructive actions out of browser-native confirm dialogs. The action
 * remains a server action, while the user gets a named, keyboard-accessible
 * confirmation before anything is removed.
 */
export function ConfirmDeleteForm({
  action,
  values,
  itemName,
  itemType,
  triggerLabel = "Delete",
  triggerClassName = "danger-button",
  triggerIcon,
  triggerAriaLabel,
}: ConfirmDeleteFormProps) {
  const [open, setOpen] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <>
    <button className={triggerClassName} type="button" onClick={() => setOpen(true)} aria-label={triggerAriaLabel}>{triggerIcon ? <AppIcon name={triggerIcon} size={18} /> : triggerLabel}</button>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-copy">
        <div className="confirm-dialog-icon"><AppIcon name="delete" size={22} /></div>
        <h2 id="confirm-delete-title">Delete this {itemType}?</h2>
        <p id="confirm-delete-copy"><strong>{itemName}</strong> will be removed. This cannot be undone.</p>
        <form action={action}>
          {Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <div className="confirm-dialog-actions">
            <button ref={cancelButton} className="quiet-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="danger-confirm" type="submit">Delete {itemType}</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
