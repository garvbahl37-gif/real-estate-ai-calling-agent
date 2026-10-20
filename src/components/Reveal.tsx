"use client";

import { useEffect, useRef } from "react";

/**
 * Fades its children up out of a blur the first time they scroll into view,
 * and starts any `.seq` children playing in order. The visual rules live in
 * globals.css under [data-reveal]; this only flips the attribute.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  from = "up",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** `words` keeps the element still and fills its <Words> in one at a time. */
  from?: "up" | "right" | "rise" | "words";
  as?: "div" | "section" | "li" | "ul" | "h2" | "p";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.setAttribute("data-in", "");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-reveal={from === "up" ? "" : from}
      className={className}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Splits a line into the spans a `from="words"` reveal fills in. */
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span className="rt-word" style={{ "--w": start + i } as React.CSSProperties}>
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}
