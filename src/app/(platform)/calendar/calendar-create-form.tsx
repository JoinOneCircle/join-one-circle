"use client";

import { useMemo, useState } from "react";
import { createChildEvent } from "./actions";

export type EventParticipantCandidate = {
  userId: string;
  displayName: string;
  role: string;
  isAccessAdmin: boolean;
};

type ChildOption = { id: string; preferred_name: string };
const roleLabels: Record<string, string> = { parent: "Parent", family: "Family", senco: "SENCO", school_staff: "School staff", professional: "Professional", local_authority: "Local Authority" };

export function CalendarCreateForm({ childOptions, candidatesByChild }: { childOptions: ChildOption[]; candidatesByChild: Record<string, EventParticipantCandidate[]> }) {
  const [childId, setChildId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const candidates = useMemo(() => (childId ? candidatesByChild[childId] ?? [] : []), [childId, candidatesByChild]);

  const changeChild = (nextChildId: string) => {
    setChildId(nextChildId);
    setSelectedIds([]);
  };
  const toggleParticipant = (userId: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId));
  };

  return <form action={createChildEvent} className="form-row">
    <label className="field">Child
      <select name="child_id" required value={childId} onChange={(event) => changeChild(event.target.value)}>
        <option value="" disabled>Choose a child</option>
        {childOptions.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}
      </select>
    </label>
    <label className="field">Title<input name="title" maxLength={200} required placeholder="e.g. Annual review" /></label>
    <label className="field">Starts<input name="starts_at" type="datetime-local" required /></label>
    <label className="field">Ends <span>(optional)</span><input name="ends_at" type="datetime-local" /></label>
    <label className="field calendar-description">Details<textarea name="description" maxLength={2000} rows={3} placeholder="What should participants know?" /></label>
    <fieldset className="calendar-participants">
      <legend>Invite authorised participants</legend>
      <p className="field-hint">Only people with current access to this child can be selected. Circle administrators are included automatically.</p>
      {!childId && <p className="field-hint">Choose a child to see their authorised circle.</p>}
      {childId && !candidates.length && <p className="field-hint">There are no additional authorised people to invite.</p>}
      {candidates.filter((candidate) => !candidate.isAccessAdmin).map((candidate) => <label className="permission-chip" data-selected={selectedIds.includes(candidate.userId)} key={candidate.userId}>
        <input type="checkbox" name="participant_ids" value={candidate.userId} checked={selectedIds.includes(candidate.userId)} onChange={(event) => toggleParticipant(candidate.userId, event.target.checked)} />
        <span>{candidate.displayName} <small>({roleLabels[candidate.role] ?? candidate.role.replaceAll("_", " ")})</small></span>
      </label>)}
      {childId && candidates.some((candidate) => candidate.isAccessAdmin) && <p className="field-hint">Circle administrators will also receive this event.</p>}
    </fieldset>
    <button className="button button--small" type="submit">Create event</button>
  </form>;
}
