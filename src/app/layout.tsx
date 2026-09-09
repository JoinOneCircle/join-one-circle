import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Join One Circle",
  description: "One child. One record. One connected circle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
