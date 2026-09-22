"use client";

import { ChangeEvent, useState } from "react";
import { AppIcon } from "@/components/app-icon";

type RecordUpdateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  childId: string;
  recordArea: string;
  canManage: boolean;
};

export function RecordUpdateForm({ action, childId, recordArea, canManage }: RecordUpdateFormProps) {
  const [fileName, setFileName] = useState("");
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => setFileName(event.target.files?.[0]?.name ?? "");

  return <form className="record-update-form record-update-form--inline" action={action} encType="multipart/form-data">
    <input type="hidden" name="child_id" value={childId} />
    <input type="hidden" name="record_area" value={recordArea} />
    <label className="field">Update title<input name="title" maxLength={200} required /></label>
    <label className="field record-update-notes">Details<textarea name="summary" rows={4} maxLength={5000} placeholder="What changed, what was observed, and what should happen next?" /></label>
    <div className="record-file-picker">
      <input id="record-update-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={chooseFile} />
      <label htmlFor="record-update-file"><AppIcon name="upload" size={17} />Attach a file</label>
      <span data-no-translate title={fileName}>{fileName || "Optional: PDF, image or DOCX (up to 25 MB)"}</span>
    </div>
    {canManage ? <label className="field record-file-access">File access<select name="access_scope" defaultValue="family"><option value="family">Family only</option><option value="family_school">Family & school</option><option value="active_circle">Active circle</option></select></label> : <><input type="hidden" name="access_scope" value="family" /><p className="field-hint">Any attached file is sent to the family record for review.</p></>}
    <div className="record-update-actions"><button className="button button--small" type="submit">Save update</button></div>
  </form>;
}
