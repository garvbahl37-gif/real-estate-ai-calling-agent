import type { Metadata } from "next";
import { CallConsole } from "@/components/CallConsole";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Live call — Priya, Aarambh Realty",
  description: "Talk to the AI real-estate agent in Hindi, Hinglish or English and watch the lead record fill in.",
};

export default function CallPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/call" />
      <main className="flex-1 pb-16">
        <CallConsole />
      </main>
    </div>
  );
}
