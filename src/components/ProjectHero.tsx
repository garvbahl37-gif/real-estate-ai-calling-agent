import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, LayoutDashboard, PhoneCall } from "lucide-react";
import { cn } from "@/lib/cn";
import { PROJECTS } from "@/lib/projects";
import { INTERIORS, PHOTOS, compactRange, construction, exteriorFor, possessionShort, priyaLine } from "@/lib/presentation";
import type { Project, UnitOption } from "@/lib/types";
import { Mark, PriyaAvatar, Ring } from "@/components/ui";

/**
 * The catalogue hero, after the Nixtio real-estate shot: a buyer on her phone
 * at home, the project name huge over the room, a completion ring wired to
 * her phone by a dotted line, and the unit types floating over the sofa.
 *
 * The line is the point — what she is looking at on that phone is this
 * project, and the cards are what Priya would tell her on a call.
 *
 * Positions are percentages of a fixed 16:9 frame on large screens, so the
 * line lands on the handset whatever the width. Below that the cards drop out
 * of the photo into a scroller.
 */

/** Where the handset sits in buyer-at-home.jpg, as a share of the frame. */
const PHONE = { x: 53.6, y: 67 };
const RING = { x: 80, y: 30 };

export function ProjectHero({ project: p, backHref = "/projects", backLabel = "All projects" }: { project: Project; backHref?: string; backLabel?: string }) {
  const progress = construction(p);
  const i = PROJECTS.findIndex((x) => x.id === p.id);
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  const units = p.units.filter((u) => u.available).slice(0, 4);
  const photo = exteriorFor(p);
  const homes = p.propertyType === "apartment" || p.propertyType === "villa";
  const [first, ...restWords] = p.name.split(" ");

  const cards = (
    <>
      {units.map((u, n) => (
        <UnitCard
          key={`${u.configuration}-${n}`}
          unit={u}
          tone={n === 0 ? "cobalt" : n === 2 ? "pale" : "white"}
          photos={n === 1 && photo ? (homes ? [photo, INTERIORS[1]] : [photo]) : undefined}
          className={OFFSETS[n]}
        />
      ))}
      <PriyaCard line={priyaLine(p)} className={OFFSETS[4]} />
    </>
  );

  return (
    <section className="bg-canvas rounded-card overflow-hidden p-2.5 sm:p-3">
      <div className="relative isolate min-h-[560px] overflow-hidden rounded-[22px] bg-[#c9c3bb] xl:aspect-[16/9] xl:min-h-0">
        <Image
          src={PHOTOS.buyerAtHome.src}
          alt={PHOTOS.buyerAtHome.alt}
          fill
          priority
          sizes="(min-width: 1440px) 1400px, 100vw"
          className="object-cover object-[57%_50%]"
        />
        {/* Carry the white title over a white wall, in the palette's own navy. */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(19_40_110/0.8)_0%,rgb(19_40_110/0.42)_32%,rgb(19_40_110/0)_54%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(19_40_110/0.35)_0%,transparent_22%,transparent_70%,rgb(13_27_77/0.55)_100%)]" />

        {/* Top bar */}
        <div className="absolute inset-x-4 top-4 z-10 flex items-center gap-4 text-white sm:inset-x-7 sm:top-6">
          <Link href={backHref} className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-colors group-hover:bg-white/30">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden text-[15px] font-semibold sm:inline">{backLabel}</span>
          </Link>
          <nav className="mx-auto hidden items-center gap-7 text-[13px] font-medium md:flex" aria-label="Project">
            <a href="#inventory" className="flex items-center gap-1.5 opacity-90 hover:opacity-100">
              <Building2 className="h-4 w-4" aria-hidden /> Inventory
            </a>
            <Link href="/leads" className="flex items-center gap-1.5 opacity-90 hover:opacity-100">
              <LayoutDashboard className="h-4 w-4" aria-hidden /> Leads
            </Link>
          </nav>
          <Link href={`/projects/${next.id}`} className="group ml-auto flex items-center gap-3 md:ml-0">
            <span className="hidden max-w-[16ch] truncate text-[15px] font-semibold sm:inline">{next.name.replace("Aarambh ", "")}</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-colors group-hover:bg-white/30">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>

        {/* Title block */}
        <div className="absolute top-[88px] left-5 z-10 max-w-[780px] text-white sm:left-8 xl:top-[14%] xl:left-[4%]">
          <h1 className="text-[38px] leading-[0.98] font-medium tracking-[-0.045em] sm:text-[64px] xl:text-[76px] 2xl:text-[88px]">
            {first}
            <br />
            {restWords.join(" ")}
          </h1>
          <p className="mt-6 max-w-[34ch] text-[15px] leading-[1.55] text-white/92 sm:text-[17px]">
            {p.locality}, {p.city} · {p.microMarket} ·{" "}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <span className="bg-cobalt inline-flex h-6 w-6 items-center justify-center rounded-full">
                <Mark className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              {p.developer}
            </span>
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-white/70">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {p.reraId} · placeholder, not a real registration
          </p>
        </div>

        {/* Completion ring, wired to her phone */}
        <svg
          className="pointer-events-none absolute inset-0 z-[5] hidden h-full w-full xl:block"
          viewBox="0 0 1600 900"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={`M ${RING.x * 16} ${RING.y * 9 + 112} C ${RING.x * 16 - 10} ${PHONE.y * 9 - 40}, ${PHONE.x * 16 + 170} ${PHONE.y * 9 - 6}, ${PHONE.x * 16 + 30} ${PHONE.y * 9}`}
            fill="none"
            stroke="#111318"
            strokeWidth="1.6"
            strokeDasharray="5 5"
          />
        </svg>
        <span
          className="pointer-events-none absolute z-[6] hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#111318] xl:flex"
          style={{ left: `${PHONE.x + 1.9}%`, top: `${PHONE.y}%` }}
          aria-hidden
        >
          <span className="bg-cobalt h-2.5 w-2.5 rounded-full ring-2 ring-white" />
        </span>

        <div className="absolute right-4 bottom-4 z-10 xl:hidden">
          <HeroRing pct={progress.pct} label={progress.label} size={116} />
        </div>
        <div
          className="absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center xl:flex"
          style={{ left: `${RING.x}%`, top: `${RING.y}%` }}
        >
          <HeroRing pct={progress.pct} label={progress.label} size={220} />
          <span className="mt-3 rounded-full bg-white/85 px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-[#111318] backdrop-blur">
            {progress.label === "Construction" ? `Construction ${progress.pct}% · ` : ""}
            {possessionShort(p).replace("Possession", "possession")}
          </span>
        </div>

        {/* Floating cards over the room */}
        <div className="absolute inset-x-[2.5%] bottom-[76px] z-10 hidden items-end gap-3 xl:flex">{cards}</div>

        {/* Bottom bar */}
        <div className="absolute inset-x-0 bottom-0 z-[8] hidden h-[96px] items-center gap-4 bg-[#0d1b4d]/25 px-8 text-white backdrop-blur-xl xl:flex">
          <span className="flex items-center gap-3">
            <span className="text-cobalt flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <Mark className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <span className="text-[17px] font-semibold">Aarambh</span>
          </span>
          <Link href="/call" className="ml-auto flex items-center gap-3">
            <span className="text-[17px] font-semibold">Ask Priya</span>
            <PriyaAvatar size={44} className="ring-2 ring-white/70" />
          </Link>
        </div>
      </div>

      {/* Small screens: the cards leave the photo */}
      <div className="thin-scroll -mx-0.5 flex snap-x items-start gap-2.5 overflow-x-auto px-0.5 pt-3 pb-1 xl:hidden">{cards}</div>
    </section>
  );
}

/* Staggered heights, as the reference scatters its cards. */
const OFFSETS = ["xl:mb-2", "xl:mb-12", "xl:-mb-6", "xl:mb-6", "xl:mb-16"];

function HeroRing({ pct, label, size }: { pct: number; label: string; size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="absolute inset-[11%] rounded-full bg-[#111318]/45 backdrop-blur-md" />
      <Ring value={pct} size={size} stroke={size * 0.085} track="rgb(255 255 255 / 0.9)" color="var(--color-cobalt)" className="absolute inset-0">
        <span className="tnum leading-none font-semibold tracking-[-0.03em] text-white" style={{ fontSize: size * 0.22 }}>
          {pct}%
        </span>
        <span className="mt-1 text-white/80" style={{ fontSize: Math.max(11, size * 0.072) }}>
          {label}
        </span>
      </Ring>
    </div>
  );
}

function UnitCard({
  unit: u,
  tone,
  photos,
  className,
}: {
  unit: UnitOption;
  tone: "cobalt" | "white" | "pale";
  photos?: { src: string; alt: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[230px] shrink-0 snap-start xl:w-[210px] 2xl:w-[230px] overflow-hidden rounded-[20px] shadow-[0_24px_40px_-24px_rgb(13_27_77/0.6)]",
        tone === "cobalt" && "bg-cobalt text-white",
        tone === "white" && "text-ink bg-white",
        tone === "pale" && "bg-pale text-navy",
        className,
      )}
    >
      {photos ? (
        <div className="grid grid-cols-2 gap-1.5 p-1.5 pb-0">
          {photos.map((ph, i) => (
            <div
              key={ph.src}
              className={cn("relative h-[112px] overflow-hidden xl:h-[96px] 2xl:h-[112px]", i === 0 ? "rounded-[14px] rounded-br-[4px]" : "rounded-[14px] rounded-bl-[4px]", photos.length === 1 && "col-span-2")}
            >
              <Image src={ph.src} alt={ph.alt} fill sizes="120px" className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="px-5 pt-4 pb-5">
        <p className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{u.configuration}</p>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 text-[12px]">
          <div>
            <p className={tone === "cobalt" ? "text-white/70" : "opacity-60"}>Carpet</p>
            <p className="tnum mt-0.5 font-medium">{u.carpetAreaSqft.toLocaleString("en-IN")} ft²</p>
          </div>
          <div className="min-w-0">
            <p className={tone === "cobalt" ? "text-white/70" : "opacity-60"}>Price</p>
            <p className="tnum mt-0.5 truncate font-semibold">{compactRange(u.priceMinInr, u.priceMaxInr)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriyaCard({ line, className }: { line: string; className?: string }) {
  return (
    <div className={cn("text-ink w-[250px] shrink-0 snap-start rounded-[20px] bg-white px-5 pt-4 pb-5 shadow-[0_24px_40px_-24px_rgb(13_27_77/0.6)]", className)}>
      <div className="flex items-center gap-2.5">
        <PriyaAvatar size={30} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Priya</p>
          <p className="text-ink-3 flex items-center gap-1 text-[10.5px]">
            <PhoneCall className="h-3 w-3" aria-hidden /> on the call
          </p>
        </div>
        <span className="ml-auto flex h-5 items-center gap-[2px]" aria-hidden>
          {[6, 12, 8, 14, 7, 10].map((h, i) => (
            <span key={i} className="eq-bar bg-cobalt w-[2.5px] rounded-full" style={{ height: h, animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      </div>
      <p className="mt-3 text-[17px] leading-snug font-medium tracking-[-0.01em]">&ldquo;{line}&rdquo;</p>
    </div>
  );
}
