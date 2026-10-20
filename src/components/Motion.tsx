"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The landing page's moving parts, after the Get Talky reel: chats that type
 * and loop inside the feature cards, a tool call that writes itself, numbers
 * that count up, and bubbles that drift at their own speed as you scroll.
 *
 * Everything waits until it is on screen and stops when it leaves, so a page
 * of loops costs nothing while you are reading something else. Reduced motion
 * gets the finished state, still.
 */

function prefersStill() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True while the element is (mostly) on screen. */
function useOnScreen<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on] as const;
}

/* ------------------------------------------------------------------ */
/* Chat that types                                                     */
/* ------------------------------------------------------------------ */

export interface ChatLine {
  text: React.ReactNode;
  side: "left" | "right";
  tone: "cobalt" | "white" | "pale";
  tag?: string;
}

const TONE = {
  cobalt: "bg-cobalt text-white",
  white: "text-ink bg-white",
  pale: "bg-mid/60 text-navy",
} as const;

/**
 * Lines arrive one at a time, each announced by a typing bubble on its own
 * side, the oldest scrolling off the top; after the last it holds, clears and
 * starts again — the reel's card chats, which never stop.
 */
export function ChatLoop({
  lines,
  visible = 3,
  stepMs = 1500,
  typingMs = 650,
  holdMs = 2600,
  className,
}: {
  lines: ChatLine[];
  visible?: number;
  stepMs?: number;
  typingMs?: number;
  holdMs?: number;
  className?: string;
}) {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<ChatLine["side"] | null>(null);

  useEffect(() => {
    if (!on) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    if (prefersStill()) {
      at(0, () => setShown(lines.length));
      return () => timers.forEach(clearTimeout);
    }
    const run = (offset: number) => {
      at(offset, () => {
        setShown(0);
        setTyping(null);
      });
      let t = offset + 350;
      lines.forEach((line, i) => {
        at(t, () => setTyping(line.side));
        at(t + typingMs, () => {
          setTyping(null);
          setShown(i + 1);
        });
        t += stepMs;
      });
      at(t + holdMs, () => run(0));
    };
    run(0);
    return () => timers.forEach(clearTimeout);
  }, [on, lines, stepMs, typingMs, holdMs]);

  const first = Math.max(0, shown - visible + (typing ? 1 : 0));
  return (
    <div ref={ref} className={cn("flex min-h-[148px] flex-col justify-end gap-2", className)}>
      {lines.slice(first, shown).map((l, i) => (
        <div key={first + i} className={cn("bubble-in flex items-center gap-2", l.side === "right" && "flex-row-reverse")}>
          <p
            className={cn(
              "max-w-[85%] rounded-[14px] px-3 py-2 text-[12px] leading-snug shadow-[0_6px_14px_-10px_rgb(19_40_110/0.5)]",
              TONE[l.tone],
              l.side === "right" ? "rounded-br-[5px]" : "rounded-bl-[5px]",
            )}
          >
            {l.text}
          </p>
          {l.tag ? <span className="text-ink-3 text-[10px] font-medium">{l.tag}</span> : null}
        </div>
      ))}
      {typing ? (
        <div className={cn("bubble-in flex", typing === "right" && "justify-end")} aria-hidden>
          <span className="flex items-center gap-1 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_6px_14px_-10px_rgb(19_40_110/0.5)]">
            <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
            <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
            <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A tool call that writes itself                                      */
/* ------------------------------------------------------------------ */

const CODE: { t: string; c: string }[] = [
  { t: "update_lead_requirements", c: "text-[#ffb35c]" },
  { t: "\n{ configurations: [", c: "" },
  { t: '"3BHK"', c: "text-[#9fe2bf]" },
  { t: "],\n  budgetMaxInr: ", c: "" },
  { t: "15000000", c: "text-[#9fe2bf]" },
  { t: ",\n  preferredLocations: [", c: "" },
  { t: '"Sector 150"', c: "text-[#9fe2bf]" },
  { t: "] }", c: "" },
];
const CODE_LEN = CODE.reduce((n, s) => n + s.t.length, 0);
/** Offset at which each segment begins. */
const CODE_STARTS = CODE.map((_, i) => CODE.slice(0, i).reduce((n, s) => n + s.t.length, 0));

const FIELDS = [
  ["Configuration", "3BHK"],
  ["Budget", "Up to ₹1.5 Cr"],
  ["Location", "Sector 150"],
] as const;

/**
 * The reel's SQL box, as what Priya actually does: the call types itself out,
 * then each field it carries lands in the lead record with a flash.
 */
export function ToolCallDemo() {
  const [ref, on] = useOnScreen<HTMLDivElement>();
  const [chars, setChars] = useState(0);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (!on) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let iv: ReturnType<typeof setInterval> | undefined;
    if (prefersStill()) {
      timers.push(
        setTimeout(() => {
          setChars(CODE_LEN);
          setFilled(FIELDS.length);
        }, 0),
      );
      return () => timers.forEach(clearTimeout);
    }
    const run = () => {
      let n = 0;
      setChars(0);
      setFilled(0);
      iv = setInterval(() => {
        n = Math.min(CODE_LEN, n + 2);
        setChars(n);
        if (n < CODE_LEN) return;
        clearInterval(iv);
        FIELDS.forEach((_, i) => timers.push(setTimeout(() => setFilled(i + 1), 350 + i * 420)));
        timers.push(setTimeout(run, 350 + FIELDS.length * 420 + 2600));
      }, 38);
    };
    timers.push(setTimeout(run, 300));
    return () => {
      timers.forEach(clearTimeout);
      if (iv) clearInterval(iv);
    };
  }, [on]);

  // Cut the coloured segments off at the typed length: each segment starts
  // where the ones before it end.
  const typed = CODE.map((s, i) => {
    const before = CODE_STARTS[i];
    const take = Math.max(0, Math.min(s.t.length, chars - before));
    return take ? (
      <span key={i} className={s.c}>
        {s.t.slice(0, take)}
      </span>
    ) : null;
  });

  return (
    <div ref={ref}>
      <div className="min-h-[96px] rounded-[12px] bg-[#141414] p-3 font-mono text-[10.5px] leading-[1.6] whitespace-pre-wrap text-[#c9d7ff]">
        {typed}
        <span className="caret ml-px inline-block h-[1.1em] w-[6px] translate-y-[2px] bg-[#c9d7ff]/80" aria-hidden />
      </div>
      <dl className="mt-2 overflow-hidden rounded-[12px] bg-white text-[11px]">
        {FIELDS.map(([k, v], i) => (
          <div
            key={`${k}-${i < filled}`}
            className={cn("border-line-2 flex justify-between border-b px-3 py-1.5 last:border-b-0", i < filled && "field-land")}
          >
            <dt className="text-ink-3">{k}</dt>
            <dd className={cn("font-semibold transition-opacity", i < filled ? "text-ink" : "text-ink-3/40")}>{i < filled ? v : "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Numbers that count up                                               */
/* ------------------------------------------------------------------ */

/**
 * Counts up to `value` the first time it scrolls into view. The server renders
 * the real number, so without JavaScript — or before it — the figure is right.
 */
export function CountUp({ value, prefix = "", className }: { value: number; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersStill() || value === 0) return;
    // Only reset numbers still below the fold: one already on screen stays put.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.textContent = `${prefix}0`;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / 1200);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${prefix}${Math.round(value * eased)}`;
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, prefix]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Drift with the scroll                                               */
/* ------------------------------------------------------------------ */

/**
 * Moves its child up or down against the scroll by `speed` × its distance from
 * the middle of the screen, so neighbours at different speeds separate as the
 * page moves — the reel's floating bubbles.
 */
export function Parallax({ speed, className, children }: { speed: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersStill()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const offset = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-offset * speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);
  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
