"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DEMO_SCRIPT, LANGUAGE_LABEL } from "@/lib/demo-script";

/**
 * A teleprompter for recording the demo video.
 *
 * Docked to the bottom of the viewport rather than beside the transcript,
 * deliberately: in a screen recording it must not cover the two things the
 * viewer needs to see — the transcript filling in and the lead record
 * populating. It reads like a lower third, which is also what it is.
 *
 * Driven by keyboard so the presenter never has to find a button mid-sentence.
 */
export function Teleprompter({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const beat = DEMO_SCRIPT[i];
  const next = DEMO_SCRIPT[i + 1];

  const go = useCallback((delta: number) => {
    setI((prev) => Math.min(DEMO_SCRIPT.length - 1, Math.max(0, prev + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never steal keys while the presenter is using the type-instead-of-speak box.
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const isAction = beat.language === "silence";

  return (
    <div className="border-ink bg-paper/97 fixed inset-x-0 bottom-0 z-50 border-t-2 backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-5 py-4 sm:px-8">
        {/* progress */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex flex-1 gap-1" role="presentation">
            {DEMO_SCRIPT.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  idx < i ? "bg-aqua" : idx === i ? "bg-magenta" : "bg-rule",
                )}
              />
            ))}
          </div>
          <span className="text-ink-3 tnum shrink-0 font-mono text-[10px]">
            {i + 1} / {DEMO_SCRIPT.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Close the teleprompter"
            className="text-ink-3 hover:text-ink shrink-0 font-mono text-[10px] tracking-[0.1em] uppercase"
          >
            Esc ✕
          </button>
        </div>

        <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="flex items-baseline gap-2.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.12em] uppercase",
                  isAction ? "bg-amber-wash text-amber" : "bg-aqua text-paper",
                )}
              >
                {LANGUAGE_LABEL[beat.language]}
              </span>
              <span className="text-ink-3 text-[11.5px]">{beat.proves}</span>
            </div>

            {beat.say ? (
              <p
                className={cn(
                  "text-ink mt-2 leading-[1.4]",
                  isAction
                    ? "text-ink-2 text-[19px] italic sm:text-[22px]"
                    : "font-display text-[26px] sm:text-[34px]",
                )}
              >
                {beat.say}
              </p>
            ) : null}

            {beat.roman ? <p className="text-ink-3 mt-1.5 text-[13.5px]">{beat.roman}</p> : null}

            {beat.watch ? (
              <p className="text-ink-2 border-magenta/40 mt-2.5 border-l-2 pl-3 text-[12.5px] leading-relaxed">
                {beat.watch}
              </p>
            ) : null}
          </div>

          <div className="lg:border-rule flex flex-col justify-between gap-3 lg:border-l lg:pl-8">
            {next ? (
              <div>
                <span className="eyebrow">Next</span>
                <p className="text-ink-3 mt-1 line-clamp-2 text-[13px] leading-snug">
                  {next.say || next.watch}
                </p>
              </div>
            ) : (
              <div>
                <span className="eyebrow">Last step</span>
                <p className="text-ink-3 mt-1 text-[13px]">Stop the recording after the summary renders.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => go(-1)}
                disabled={i === 0}
                className="border-rule text-ink-2 hover:border-ink min-h-11 rounded-sm border px-4 font-mono text-[11px] font-semibold tracking-wide uppercase transition-colors disabled:opacity-30"
              >
                ← Back
              </button>
              <button
                onClick={() => go(1)}
                disabled={i === DEMO_SCRIPT.length - 1}
                className="bg-ink text-paper hover:bg-aqua min-h-11 flex-1 rounded-sm px-4 font-mono text-[11px] font-semibold tracking-wide uppercase transition-colors disabled:opacity-30"
              >
                Next →
              </button>
            </div>
            <p className="text-ink-3 hidden text-[10.5px] lg:block">
              Space or → advances · ← goes back · Esc closes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
