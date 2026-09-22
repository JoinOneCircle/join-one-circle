import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Document storage is not configured." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) return NextResponse.redirect(new URL("/login?next=/documents", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  const { documentId } = await params;
  const { data: document } = await supabase!.from("child_documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found or not authorised." }, { status: 404 });
  const mode = new URL(request.url).searchParams.get("mode");
  const { data, error } = await supabase!.storage.from("child-documents").createSignedUrl(document.storage_path, 60, { download: mode === "download" });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Document download is unavailable." }, { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
