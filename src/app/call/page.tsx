import type { Metadata } from "next";
import { CallConsole } from "@/components/CallConsole";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Live call — Priya, Aarambh Realty",
  description: "Talk to the AI real-estate agent in Hindi, Hinglish or English and watch the lead record fill in.",
};

export default function CallPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/call" />
      <main className="flex-1">
        <CallConsole />
      </main>
    </div>
  );
}
