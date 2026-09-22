"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icon";

type UploadAction = (formData: FormData) => void | Promise<void>;
type ChildOption = { id: string; preferred_name: string };

export function DocumentUploadForm({ childOptions, action }: { childOptions: ChildOption[]; action: UploadAction }) {
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => setFileName(event.target.files?.[0]?.name ?? "");

  return <form className="upload-zone document-upload-form" action={action}>
    <span aria-hidden="true"><AppIcon name="documents" size={22} /></span>
    <div><h2>Add a document safely</h2><p>Choose a file, then check who can access it before saving.</p></div>
    <label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{childOptions.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>
    <label className="field">Document title<input name="title" required maxLength={200} /></label>
    <label className="field">Access<select name="access_scope" defaultValue="family"><option value="family">Family only</option><option value="family_school">Family & school</option><option value="active_circle">Active circle</option></select></label>
    <label className="field">Document type<select name="category" defaultValue="other"><option value="assessment">Assessment or report</option><option value="plan">Plan</option><option value="letter">Letter</option><option value="evidence">Evidence</option><option value="other">Other</option></select></label>
    <div className="file-picker"><input id="document-file" ref={fileInput} name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={chooseFile} /><label htmlFor="document-file" className="file-picker-button"><AppIcon name="upload" size={17} />Choose file</label><span title={fileName}>{fileName || "PDF, JPG, PNG or DOCX (up to 25 MB)"}</span></div>
    <button className="button button--small" type="submit" disabled={!childOptions.length}>Save document</button>
  </form>;
}
