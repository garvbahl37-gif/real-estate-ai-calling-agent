"use client";

import { useEffect, useState } from "react";
import { Grid3x3, MicOff, PhoneOff, Signal, Volume2, Wifi } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Mark, PriyaAvatar } from "@/components/ui";

/**
 * The hero: the buyer's phone, mid-call with Priya, and the conversation
 * surfacing over it one line at a time. The picture has to say that she phones
 * people — so it is a call screen, not a chat window.
 *
 * The lines are verbatim from a recorded end-to-end call, not written copy.
 */

const EXCHANGE = [
  { who: "priya", text: "Namaste! Main Priya bol rahi hoon Aarambh Realty se — do minute baat kar sakte hain?", at: 2 },
  { who: "caller", text: "Main investment ke liye dekh raha hoon, Noida mein", at: 9 },
  { who: "priya", text: "Achha! Kis area mein dekh rahe hain — Sector 150, Expressway side ya kahin aur?", at: 14 },
  { who: "caller", text: "3BHK chahiye, budget around 1.5 crore tak", at: 22 },
  {
    who: "priya",
    text: "Skyline Greens hai, Sector 150 mein. 3BHK 1.35 se 1.65 crore. Possession December 2027.",
    at: 28,
  },
] as const;

const STEP_MS = 2600;
const VISIBLE = 3;

function clock(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function HeroCall({ className }: { className?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for the splash and the phone's entrance, as the reference does.
    const intro = !document.documentElement.classList.contains("intro-seen");
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(
      () => {
        if (still) {
          // No motion: just show the whole exchange.
          setShown(EXCHANGE.length);
          return;
        }
        setShown(1);
        interval = setInterval(() => {
          // Hold on the full exchange for two beats, then ring again.
          setShown((n) => (n >= EXCHANGE.length + 2 ? 1 : n + 1));
        }, STEP_MS);
      },
      still ? 0 : intro ? 4300 : 1300,
    );
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, []);

  const count = Math.min(shown, EXCHANGE.length);
  const first = Math.max(0, count - VISIBLE);
  const lines = EXCHANGE.slice(first, count).map((l, i) => ({ ...l, index: first + i }));
  const seconds = EXCHANGE[count - 1]?.at ?? 0;

  return (
    <div className={cn("wash fade-in-up relative isolate overflow-hidden rounded-[24px]", className)} style={{ "--d": "0.2s" } as React.CSSProperties}>
      {/* Concentric call rings behind the handset */}
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
        {[640, 470, 320].map((s) => (
          <span key={s} className="border-cobalt/12 absolute rounded-full border" style={{ width: s, height: s }} />
        ))}
        <span className="bg-cobalt/35 absolute bottom-[8%] h-[120px] w-[300px] rounded-full blur-3xl" />
      </div>

      {/* Call bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 pr-4 pl-1.5 text-[12.5px] shadow-[0_8px_20px_-12px_rgb(19_40_110/0.5)] backdrop-blur">
        <PriyaAvatar size={28} />
        <span className="text-ink font-semibold">Priya · Aarambh Realty</span>
        <span className="bg-line h-3.5 w-px" aria-hidden />
        <span className="flex items-center gap-1.5">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
          <span className="text-ink-2 tnum font-mono text-[11.5px]">{clock(seconds)}</span>
        </span>
      </div>

      {/* The spinning "live" button from the reference's photo corner */}
      <div className="absolute top-4 right-4 z-10 hidden h-12 w-12 items-center justify-center sm:flex" aria-hidden>
        <span className="spin-slow border-cobalt/50 absolute inset-0 rounded-full border border-dashed" />
        <span className="bg-cobalt flex h-9 w-9 items-center justify-center rounded-full text-white">
          <Mark className="h-5 w-5" strokeWidth={2.2} />
        </span>
      </div>

      {/* Handset */}
      <div className="absolute inset-0 flex items-center justify-center pt-6">
        <div className="drift">
          <div className="phone-rise">
            <Handset seconds={seconds} />
          </div>
        </div>
      </div>

      {/* Transcript bubbles over the lower half */}
      <ol
        className="absolute inset-x-3 bottom-5 z-10 mx-auto flex max-w-[520px] flex-col gap-2.5 sm:inset-x-6 sm:bottom-7"
        aria-label="Excerpt from a recorded call"
      >
        {lines.map((l) => {
          const isPriya = l.who === "priya";
          return (
            <li key={l.index} className={cn("bubble-in flex items-end gap-2", isPriya ? "flex-row-reverse self-end" : "self-start")}>
              {isPriya ? (
                <PriyaAvatar size={30} className="ring-2 ring-white" />
              ) : (
                <Avatar name="Rahul Verma" size={30} className="ring-2 ring-white" />
              )}
              <p
                className={cn(
                  "max-w-[min(330px,74vw)] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-[1.45] shadow-[0_14px_28px_-16px_rgb(19_40_110/0.55)]",
                  isPriya ? "text-ink rounded-br-[6px] bg-white" : "bg-cobalt rounded-bl-[6px] text-white",
                )}
              >
                {l.text}
                <span className={cn("tnum ml-2 font-mono text-[9.5px]", isPriya ? "text-ink-3" : "text-white/70")}>{clock(l.at)}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Handset({ seconds }: { seconds: number }) {
  return (
    <div className="w-[248px] rounded-[44px] bg-[#16181d] p-[7px] shadow-[0_50px_80px_-40px_rgb(19_40_110/0.85)] sm:w-[262px]">
      <div className="relative h-[500px] overflow-hidden rounded-[37px] bg-gradient-to-b from-[#4a71f5] via-[#2a4fdc] to-[#13286e] px-5 text-center text-white sm:h-[530px]">
        <div className="absolute top-2.5 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#16181d]" />
        <div className="flex items-center justify-between pt-3 pl-3 text-[11px] font-semibold">
          <span>9:41</span>
          <span className="flex items-center gap-1 pr-1">
            <Signal className="h-3 w-3" aria-hidden />
            <Wifi className="h-3 w-3" aria-hidden />
          </span>
        </div>

        <p className="mt-12 text-[11px] text-white/70">Aarambh Realty</p>
        <div className="relative mx-auto mt-5 flex h-[92px] w-[92px] items-center justify-center">
          <span className="live-ring absolute inset-0 rounded-full" />
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white/15 ring-[10px] ring-white/8">
            <Mark className="h-11 w-11" strokeWidth={1.9} />
          </span>
        </div>
        <p className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Priya</p>
        <p className="tnum mt-1 font-mono text-[12px] text-white/75">{clock(seconds)}</p>

        <div className="mt-6 flex h-7 items-center justify-center gap-[3px]" aria-hidden>
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className="eq-bar w-[3px] rounded-full bg-white/80"
              style={{ height: 6 + ((i * 7) % 18), animationDelay: `${(i % 7) * 0.11}s` }}
            />
          ))}
        </div>

        <div className="absolute inset-x-6 bottom-8">
          <div className="grid grid-cols-3 gap-4">
            {[
              [MicOff, "mute"],
              [Grid3x3, "keypad"],
              [Volume2, "speaker"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof MicOff;
              return (
                <span key={label as string} className="flex flex-col items-center gap-1.5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-[10px] text-white/70">{label as string}</span>
                </span>
              );
            })}
          </div>
          <span className="bg-rose mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full">
            <PhoneOff className="h-6 w-6" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
