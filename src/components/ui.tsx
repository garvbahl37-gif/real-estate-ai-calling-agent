import { cn } from "@/lib/cn";

/**
 * The shared pieces of the Get Talky-style system. Server-safe: no hooks, so
 * pages can use them without becoming client components.
 */

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

/** A house that is also a speech bubble, with a face. Priya's mark. */
export function Mark({ className, strokeWidth = 1.9 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.6 10.4 12 4.3l7.4 6.1v7.4a2.3 2.3 0 0 1-2.3 2.3h-6.5l-3.9 3v-3h-.1a2.3 2.3 0 0 1-2-2.3v-7.4Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="12.6" r="1.15" fill="currentColor" />
      <circle cx="14.4" cy="12.6" r="1.15" fill="currentColor" />
      <path d="M9.4 15.6c1.4 1.3 3.8 1.3 5.2 0" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-cobalt inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <Mark className="h-[1.6em] w-[1.6em] shrink-0" />
      <span className="text-[1em] leading-none tracking-[-0.02em]">
        <span className="font-medium">Aarambh</span> <span className="font-bold">Realty</span>
      </span>
    </span>
  );
}

/** Priya's avatar wherever she speaks. She is an agent, so she gets the mark, not a face. */
export function PriyaAvatar({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("bg-cobalt inline-flex shrink-0 items-center justify-center rounded-full text-white", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Mark className="h-[62%] w-[62%]" strokeWidth={2.2} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  as: Tag = "section",
  className,
  children,
  ...rest
}: {
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("bg-canvas rounded-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** The pale inner panel, as in the CRM reference: white cards sit on it. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("bg-frost rounded-panel", className)}>{children}</div>;
}

/** Section label: a small pale pill with the brand mark, as Get Talky uses above every heading. */
export function Chip({
  children,
  icon,
  className,
  tone = "ice",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  tone?: "ice" | "white" | "glass";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] leading-none font-medium",
        tone === "ice" && "bg-ice text-ink",
        tone === "white" && "text-ink bg-white",
        tone === "glass" && "glass",
        className,
      )}
    >
      <span className={cn("inline-flex", tone === "glass" ? "text-white" : "text-cobalt")}>
        {icon ?? <Mark className="h-3.5 w-3.5" strokeWidth={2.2} />}
      </span>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "soft" | "outline" | "white" | "danger" | "ghost";

/** Class string rather than a component, so a <Link>, <a> and <button> can all share it. */
export function btn(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
    size === "sm" && "min-h-9 px-4 text-[13px]",
    size === "md" && "min-h-11 px-5 text-[14px]",
    size === "lg" && "min-h-12 px-6 text-[15px]",
    variant === "primary" && "bg-cobalt hover:bg-cobalt-deep shadow-cta text-white",
    variant === "soft" && "bg-pale text-ink hover:bg-[#bdd8fd]",
    variant === "outline" && "border-line text-ink hover:border-cobalt hover:text-cobalt border bg-white",
    variant === "white" && "text-cobalt bg-white hover:bg-ice",
    variant === "danger" && "bg-rose text-white hover:bg-[#d23b40]",
    variant === "ghost" && "text-ink-2 hover:text-ink hover:bg-ice",
  );
}

/* ------------------------------------------------------------------ */
/* Data bits                                                           */
/* ------------------------------------------------------------------ */

const AVATAR_TONES = [
  "bg-pale text-navy",
  "bg-cobalt text-white",
  "bg-mid text-navy",
  "bg-ice text-cobalt",
  "bg-navy text-white",
];

/** Initials, tinted by name so the same lead keeps the same colour across pages. */
export function Avatar({ name, size = 40, className }: { name?: string; size?: number; className?: string }) {
  const clean = (name ?? "").trim();
  const initials = clean
    ? clean
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join("")
    : "?";
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        AVATAR_TONES[h % AVATAR_TONES.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Horizontal progress — the CRM reference's bar under every row. */
export function Meter({ value, max, className, tone = "cobalt" }: { value: number; max: number; className?: string; tone?: "cobalt" | "white" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-[5px] w-full overflow-hidden rounded-full", tone === "white" ? "bg-white/30" : "bg-pale", className)}
      role="presentation"
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "white" ? "bg-white" : "bg-cobalt")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * The completion ring from the catalogue reference: a thick coloured arc over
 * a thin full track. `children` sits in the middle.
 */
export function Ring({
  value,
  size = 120,
  stroke = 12,
  track = "rgb(255 255 255 / 0.55)",
  color = "var(--color-cobalt)",
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke * 0.32} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export type Band = "hot" | "warm" | "cold";

export function BandPill({ band, score, className }: { band: Band; score?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold capitalize",
        band === "hot" && "bg-cobalt text-white",
        band === "warm" && "bg-pale text-navy",
        band === "cold" && "bg-line-2 text-ink-3",
        className,
      )}
    >
      {score != null ? <span className="tnum">{score}</span> : null}
      {band}
    </span>
  );
}

/** Empty state used across the CRM pages. */
export function EmptyNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-pale text-ink-3 rounded-panel border border-dashed px-5 py-8 text-center text-[13px] leading-relaxed", className)}>
      {children}
    </div>
  );
}
