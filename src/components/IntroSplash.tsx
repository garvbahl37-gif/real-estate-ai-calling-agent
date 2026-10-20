"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Avatar, Mark } from "@/components/ui";

/**
 * The opening of the Get Talky reel, rebuilt: a voice meter pulses, becomes the
 * mark, buyers' questions pop in around it, the wordmark wipes in, and the
 * card clears to reveal the page.
 *
 * All of it is CSS on fixed delays, so it plays and clears even before (or
 * without) hydration. It plays on every fresh load of the page — it is the
 * opening of the piece — but not again on client-side navigation back to /,
 * because <html> keeps the class set here when it finishes. A click skips it.
 */


const ASKS = [
  { text: "Possession kab tak hai?", name: "Rohit S", tone: "bg-ice text-navy", pos: "left-[12%] top-[20%]", i: 0 },
  { text: "Is it RERA registered?", name: "Anita K", tone: "bg-cobalt text-white", pos: "right-[10%] top-[14%]", i: 1, flip: true },
  { text: "3BHK chahiye", name: "Mohan P", tone: "bg-cobalt text-white", pos: "left-[16%] bottom-[22%]", i: 2 },
  { text: "Saturday site visit?", name: "Neha V", tone: "bg-pale text-navy", pos: "right-[16%] bottom-[16%]", i: 3, flip: true },
];

export function IntroSplash() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set when it finishes, not when it starts, so React's dev double-mount
    // cannot cancel the first showing.
    const t = setTimeout(() => document.documentElement.classList.add("intro-seen"), 3300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      className="intro-splash bg-backdrop fixed inset-0 z-[100] p-2 sm:p-3 lg:p-4"
      onClick={() => ref.current?.classList.add("is-skipped")}
      aria-hidden
    >
      <div className="bg-canvas rounded-card relative h-full w-full overflow-hidden">
        {/* 1 · the voice meter */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: "splash-bars 1.05s ease-in forwards" }}
        >
          <div className="text-cobalt flex h-6 items-center gap-[3px]">
            {[10, 18, 13, 6].map((h, i) => (
              <span
                key={i}
                className="eq-bar w-[4px] rounded-full bg-current"
                style={{ height: h, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>

        {/* 2 · mark, then 4 · wordmark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="text-cobalt flex items-center gap-3"
            style={{ animation: "fade-away 0.45s ease-in 2.55s forwards" }}
          >
            <span
              className="inline-flex opacity-0"
              style={{ animation: "splash-mark 0.6s cubic-bezier(0.2,0.8,0.2,1) 0.85s forwards" }}
            >
              <Mark className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1.7} />
            </span>
            <span
              className="text-[34px] leading-none tracking-[-0.03em] opacity-0 sm:text-[46px]"
              style={{ animation: "wipe-in 0.7s cubic-bezier(0.6,0,0.2,1) 1.55s forwards" }}
            >
              <span className="font-medium">Aarambh</span> <span className="font-bold">Realty</span>
            </span>
          </div>
        </div>

        {/* 3 · the questions buyers ask */}
        {ASKS.map((a) => (
          <div key={a.text} className={cn("absolute", a.pos)} style={{ animation: "fade-away 0.4s ease-in 2.45s forwards" }}>
            <div
              className={cn("flex items-center gap-2 opacity-0", a.flip && "flex-row-reverse")}
              style={{ animation: `pop-in 0.45s cubic-bezier(0.2,0.8,0.2,1) ${1.2 + a.i * 0.13}s forwards` }}
            >
              <Avatar name={a.name} size={34} className="ring-4 ring-white" />
              <span className={cn("rounded-full px-3.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap", a.tone)}>
                {a.text}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
