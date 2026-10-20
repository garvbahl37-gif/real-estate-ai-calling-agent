import type { Metadata } from "next";
import { Caveat, JetBrains_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta is the closest open match to the Get Talky grotesk. It has no
// Devanagari, so Noto Sans Devanagari sits behind it in the stack and Hindi
// turns render in a sans with the same weight rather than a fallback serif.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-devanagari",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

// Only for the one hand-written aside on the hero.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Priya — AI calling agent for real estate",
  description:
    "A live AI voice agent that qualifies property buyers over the phone in Hindi, Hinglish and English, captures their requirements, and writes the lead into a CRM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: IntroSplash adds `intro-seen` to <html> outside React.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${devanagari.variable} ${mono.variable} ${caveat.variable} h-full antialiased`}
    >
      <head>
        {/* Scroll reveals start hidden and wait for JS; without it, just show everything. */}
        <noscript>
          <style>{`[data-reveal],[data-reveal] .seq,.word-in,.fade-in-up,.phone-rise{opacity:1!important;transform:none!important;filter:none!important}.intro-splash{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
