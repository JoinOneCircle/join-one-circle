"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

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
  if (!childId || !title || !startsAt) redirect("/calendar?error=Enter%20a%20child%2C%20title%20and%20start%20time.");
  const supabase = await client();
  const { error } = await supabase.rpc("create_child_event", {
    p_child_id: childId,
    p_title: title,
    p_description: description,
    p_starts_at: new Date(startsAt).toISOString(),
    p_ends_at: endsAt ? new Date(endsAt).toISOString() : null,
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
