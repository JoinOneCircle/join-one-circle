import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PilotFeedbackForm } from "@/components/pilot/pilot-feedback-form";
export const metadata: Metadata = { title: "Pilot feedback", robots: { index: false, follow: false } };
export default async function FeedbackPage() {
  const db = await createSupabaseServerClient();
  const auth = db ? await db.auth.getUser() : null;
  const intendedRole = auth?.data.user?.user_metadata?.intended_role;
  return <PilotFeedbackForm signedIn={Boolean(auth?.data.user)} initialRole={intendedRole === "school" ? "school" : intendedRole === "family" ? "parent" : ""}/>;
}
