"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const values = (formData: FormData, key: string) => [...new Set(formData.getAll(key).map((item) => String(item).trim()).filter(Boolean))];
const toIsoDateTime = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

async function client() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect("/login?next=/calendar");
  return supabase!;
}

export async function createChildEvent(formData: FormData) {
  const childId = value(formData, "child_id");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const startsAt = value(formData, "starts_at");
  const endsAt = value(formData, "ends_at");
  const participantIds = values(formData, "participant_ids");
  if (!childId || !title || !startsAt) redirect("/calendar?error=Enter%20a%20child%2C%20title%20and%20start%20time.");
  const startTimestamp = toIsoDateTime(startsAt);
  const endTimestamp = endsAt ? toIsoDateTime(endsAt) : null;
  if (!startTimestamp || (endsAt && !endTimestamp)) redirect("/calendar?error=Enter%20a%20valid%20start%20and%20end%20time.");
  const supabase = await client();
  const { error } = await supabase.rpc("create_child_event", {
    p_child_id: childId,
    p_title: title,
    p_description: description,
    p_starts_at: startTimestamp,
    p_ends_at: endTimestamp,
    p_participant_ids: participantIds,
  });
  if (error) redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendar");
  redirect("/calendar?message=event-created");
}

export async function respondToChildEvent(formData: FormData) {
  const eventId = value(formData, "event_id");
  const response = value(formData, "response");
  if (!eventId || !["accepted", "declined"].includes(response)) redirect("/calendar?error=invalid-event-response");
  const supabase = await client();
  const { error } = await supabase.rpc("respond_to_child_event", { p_event_id: eventId, p_response: response });
  if (error) redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendar");
}

export async function cancelChildEvent(formData: FormData) {
  const eventId = value(formData, "event_id");
  if (!eventId) redirect("/calendar?error=invalid-event");
  const supabase = await client();
  const { error } = await supabase.rpc("cancel_child_event", { p_event_id: eventId });
  if (error) redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendar");
}
