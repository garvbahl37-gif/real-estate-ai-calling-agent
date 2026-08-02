import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Tiro_Devanagari_Hindi } from "next/font/google";
import "./globals.css";

// Tiro Devanagari Hindi carries both scripts with a calligraphic Devanagari —
// it is what makes the Hindi on this page look set rather than merely rendered.
const tiro = Tiro_Devanagari_Hindi({
  weight: "400",
  subsets: ["latin", "devanagari"],
  variable: "--font-tiro",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Priya — AI calling agent for real estate",
  description:
    "A live AI voice agent that qualifies property buyers over the phone in Hindi, Hinglish and English, captures their requirements, and writes the lead into a CRM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${tiro.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
