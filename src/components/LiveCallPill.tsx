"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, PhoneCall } from "lucide-react";
import { cn } from "@/lib/cn";
import { PriyaAvatar } from "@/components/ui";

function clock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * The CRM reference's "Live 15:25" pill. With a call in progress it reads
 * "Priya is on a call", counts up from when the call started and opens its
 * live transcript; otherwise it offers to start one.
 */
export function LiveCallPill({ live, className }: { live: { id: string; startedAt: string } | null; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!live) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [live]);

  if (!live) {
    return (
      <Link
        href="/call"
        className={cn("group flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 transition-shadow hover:shadow-soft", className)}
      >
        <span className="bg-ice text-cobalt flex h-9 w-9 items-center justify-center rounded-full">
          <PhoneCall className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-[13.5px] font-semibold">Priya is free</span>
          <span className="text-ink-3 block text-[12px]">Start a call and watch it land here</span>
        </span>
        <ArrowUpRight className="text-ink-3 group-hover:text-cobalt h-4 w-4 transition-colors" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={`/leads/${live.id}`}
      className={cn("group flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 transition-shadow hover:shadow-soft", className)}
    >
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="eq-bar bg-cobalt h-3.5 w-[3px] rounded-full" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink flex items-center gap-2 text-[13.5px] font-semibold">
          <span className="live-dot bg-cobalt h-1.5 w-1.5 rounded-full" aria-hidden />
          Priya is on a call
        </span>
        <span className="text-ink-3 block text-[12px]">Open the live transcript</span>
      </span>
      <span className="text-ink-2 tnum font-mono text-[12.5px]">{now == null ? "--:--" : clock(now - Date.parse(live.startedAt))}</span>
      <PriyaAvatar size={30} className="live-ring" />
    </Link>
  );
}
