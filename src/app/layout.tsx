import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { LanguagePreference } from "@/components/language-preference";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

const interfaceFont = localFont({
  src: [
    { path: "../fonts/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/Poppins-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../fonts/Poppins-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-interface",
  display: "swap",
  fallback: ["Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Join One Circle | One child. One connected circle.",
    template: "%s | Join One Circle",
  },
  description: "A secure SEND platform connecting families, schools, professionals and Local Authorities around one authorised child record.",
  icons: { icon: "/logo-icon.png", apple: "/logo-icon.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieLanguage = (await cookies()).get("joc_language")?.value;
  let language = cookieLanguage === "pt" || cookieLanguage === "es" ? cookieLanguage : "en";

  // The account setting becomes the default on a new device. A browser choice
  // still wins through its cookie/localStorage, so switching languages remains
  // immediate and predictable.
  if (language === "en" && cookieLanguage !== "en" && isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase!.auth.getUser();
    if (authData.user) {
      const { data: profile } = await supabase!.from("profiles").select("preferred_language").eq("id", authData.user.id).maybeSingle();
      if (profile?.preferred_language === "pt" || profile?.preferred_language === "es") language = profile.preferred_language;
    }
  }

  return <html lang={language} data-language={language} data-scroll-behavior="smooth"><body className={interfaceFont.variable}><LanguagePreference />{children}</body></html>;
}
