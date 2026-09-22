export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
// Demo data is intentionally local-only. No environment flag may activate it
// on a production deployment that lacks the client's Supabase settings.
export const isLocalDemoMode = !isSupabaseConfigured && process.env.NODE_ENV !== "production";
