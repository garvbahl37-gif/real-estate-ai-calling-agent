"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui";

export interface HowStep {
  title: string;
  body: string;
  /** Background of the stage while this step is on it. */
  stage: string;
  visual: React.ReactNode;
}

/**
 * The reel's "How it works": the section pins to the viewport and scrolling
 * moves it through the steps — title blurs in on the left, the visual on the
 * right slides across, and its parts play in order. One step per ~85vh of
 * scroll.
 *
 * Desktop only; the page renders the steps as plain cards below `lg`, where a
 * pinned section would fight the phone's own scrolling.
 */
export function HowItWorks({ steps, className }: { steps: HowStep[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = travel > 0 ? Math.min(0.9999, Math.max(0, -rect.top / travel)) : 0;
      setActive(Math.floor(progress * steps.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [steps.length]);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (travel * (i + 0.5)) / steps.length, behavior: "smooth" });
  };

  const state = (i: number) => (i === active ? "active" : i < active ? "past" : "next");

  return (
    <div ref={ref} className={cn("relative", className)} style={{ height: `${steps.length * 85 + 15}vh` }}>
      <div className="bg-canvas rounded-card sticky top-3 grid h-[calc(100dvh-24px)] max-h-[900px] grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-6 overflow-hidden p-4">
        {/* Left: the step's words, and where you are */}
        <div className="flex flex-col px-6 py-8 xl:px-10">
          <div>
            <Chip>How it works</Chip>
          </div>
          <p className="text-ink-3 mt-5 text-[14px]">How a phone call becomes a scored lead</p>

          <div className="relative mt-auto mb-auto h-[220px]">
            {steps.map((s, i) => (
              <div key={s.title} className="how-title" data-state={state(i)} aria-hidden={i !== active}>
                <span className="text-cobalt font-mono text-[13px] font-semibold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-ink mt-3 text-[40px] leading-[1.06] font-medium tracking-[-0.035em] xl:text-[48px]">{s.title}</h3>
                <p className="text-ink-2 mt-4 max-w-[38ch] text-[15px] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.title}>
                <button
                  onClick={() => goTo(i)}
                  aria-current={i === active ? "step" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-full py-1.5 text-left text-[13px] transition-colors",
                    i === active ? "text-ink font-semibold" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  <span className={cn("h-[3px] rounded-full transition-all duration-500", i === active ? "bg-cobalt w-10" : "bg-pale w-5")} />
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Right: the stage */}
        <div className="relative overflow-hidden rounded-[24px]">
          {steps.map((s, i) => (
            <div key={s.title} className={cn("how-step overflow-hidden rounded-[24px]", s.stage)} data-state={state(i)} aria-hidden={i !== active}>
              {s.visual}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
