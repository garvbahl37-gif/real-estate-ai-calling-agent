import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { configurations, exteriorFor, possessionShort } from "@/lib/presentation";
import type { Project } from "@/lib/types";

const STATUS_LABEL: Record<Project["status"], string> = {
  ready_to_move: "Ready to move",
  under_construction: "Under construction",
  new_launch: "New launch",
};

/** A plot has nothing to photograph, so it gets its own subdivision drawn instead. */
export function PlotArt({ className }: { className?: string }) {
  return (
    <div className={cn("wash relative overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#8bb7f0" strokeWidth="1.2" strokeDasharray="3 3">
          {Array.from({ length: 5 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => (
              <rect key={`${r}-${c}`} x={14 + c * 30} y={12 + r * 26} width={24} height={20} rx={3} />
            )),
          )}
        </g>
        <rect x={74} y={64} width={24} height={20} rx={3} fill="#325ced" />
        <path d="M0 58h200M0 110h200" stroke="#fff" strokeWidth="5" />
      </svg>
    </div>
  );
}

/** `zoomIn`: the photo settles out of a zoom when the card is revealed (inside a <Reveal>). */
export function ProjectCard({ project: p, className, zoomIn }: { project: Project; className?: string; zoomIn?: boolean }) {
  const photo = exteriorFor(p);
  return (
    <Link
      href={`/projects/${p.id}`}
      className={cn(
        "group bg-canvas border-line-2 hover:border-pale hover:shadow-soft flex flex-col rounded-[22px] border p-2.5 transition-[box-shadow,border-color]",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[16px]">
        <div className={cn("absolute inset-0", zoomIn && "reveal-zoom")}>
          {photo ? (
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <PlotArt className="absolute inset-0" />
          )}
        </div>
        <span className="text-ink absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
          {STATUS_LABEL[p.status]}
        </span>
        <span className="bg-cobalt absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2 pt-3.5 pb-2">
        <p className="text-ink-3 text-[12px]">
          {p.locality}, {p.city}
        </p>
        <h3 className="text-ink group-hover:text-cobalt mt-1 text-[17px] leading-snug font-semibold tracking-[-0.01em] transition-colors">
          {p.name.replace("Aarambh ", "")}
        </h3>
        <p className="text-ink-2 mt-1.5 line-clamp-2 text-[13px] leading-relaxed">{p.tagline}</p>

        <div className="mt-auto pt-4">
          <p className="text-ink tnum text-[14px] font-semibold">{p.priceRangeLabel}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {configurations(p).map((c) => (
              <span key={c} className="bg-ice text-navy rounded-full px-2 py-0.5 text-[11px] font-medium">
                {c}
              </span>
            ))}
            <span className="text-ink-3 ml-auto text-[11px]">{possessionShort(p)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
