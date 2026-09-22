"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notification_id") ?? "").trim();
  if (!notificationId) return;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) return;
  await supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", data.user.id).is("read_at", null);
  revalidatePath("/dashboard");
}
