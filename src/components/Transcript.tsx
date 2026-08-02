"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { TranscriptTurn } from "@/lib/types";

/** Devanagari codepoint range — used to switch the type treatment per turn. */
const DEVANAGARI = /[ऀ-ॿ]/;

function scriptOf(text: string): "devanagari" | "latin" | "mixed" {
  const hasDev = DEVANAGARI.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasDev && hasLatin) return "mixed";
  if (hasDev) return "devanagari";
  return "latin";
}

function langLabel(turn: TranscriptTurn): string | null {
  const s = scriptOf(turn.text);
  if (s === "mixed") return "Hinglish";
  if (s === "devanagari") return "Hindi";
  if (turn.languageCode?.startsWith("hi")) return "Hindi (romanised)";
  return null;
}

function stamp(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function Transcript({
  turns,
  thinking,
  emptyHint,
  className,
}: {
  turns: TranscriptTurn[];
  thinking?: boolean;
  emptyHint?: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the conversation, but stop fighting the user if they scroll back.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, thinking]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div ref={scroller} onScroll={onScroll} className={cn("thin-scroll overflow-y-auto", className)}>
      {turns.length === 0 && !thinking ? (
        <p className="text-ink-3 px-1 py-8 text-[13px] leading-relaxed">{emptyHint}</p>
      ) : null}

      <div className="space-y-5 pb-4">
        {turns.map((turn) => {
          const isAgent = turn.role === "agent";
          const script = scriptOf(turn.text);
          const lang = langLabel(turn);
          return (
            <div key={turn.id} className="rise-in">
              <div className="mb-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono text-[10px] font-semibold tracking-[0.12em] uppercase",
                    isAgent ? "text-aqua" : "text-magenta",
                  )}
                >
                  {isAgent ? "Priya" : "Caller"}
                </span>
                <span className="text-ink-3 tnum font-mono text-[10px]">{stamp(turn.at)}</span>
                {lang ? (
                  <span className="border-rule text-ink-3 rounded-full border px-1.5 py-px font-mono text-[9px] tracking-wide">
                    {lang}
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  "border-l-2 pl-3 text-[15px] leading-[1.65]",
                  isAgent ? "border-aqua/30 text-ink" : "border-magenta/30 text-ink-2",
                  // Devanagari needs more line height and looks far better set
                  // in Tiro than in the UI grotesque.
                  script !== "latin" && "font-display text-[16.5px] leading-[1.85]",
                  turn.partial && "opacity-70",
                )}
              >
                {turn.text}
                {turn.partial ? <span className="bg-ink/40 ml-0.5 inline-block h-[1em] w-[2px] align-middle" /> : null}
              </p>
            </div>
          );
        })}

        {thinking ? (
          <div className="flex items-center gap-1.5 pl-3">
            <span className="bg-aqua thinking-dot h-1.5 w-1.5 rounded-full" />
            <span className="bg-aqua thinking-dot h-1.5 w-1.5 rounded-full" />
            <span className="bg-aqua thinking-dot h-1.5 w-1.5 rounded-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
