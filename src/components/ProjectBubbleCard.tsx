import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, IndianRupee, KeyRound } from "lucide-react";
import { formatInr } from "@/lib/projects";
import { INTERIORS, compactRange, exteriorFor, possessionDate } from "@/lib/presentation";
import type { Project } from "@/lib/types";

/**
 * What `get_project_details` returned, shown to the buyer inside Priya's turn —
 * the tool call made visible. Stats tiles and photos in a message bubble, after
 * the chat reference, in cobalt instead of its black and green.
 */
export function ProjectBubbleCard({ project: p }: { project: Project }) {
  const exterior = exteriorFor(p);
  // Homes get an exterior and two rooms; an office gets its building; a plot gets nothing to look at.
  const homes = p.propertyType === "apartment" || p.propertyType === "villa";
  const photos = exterior ? (homes ? [exterior, ...INTERIORS.slice(0, 2)] : [exterior]) : [];
  const possession = p.status === "ready_to_move" ? "Ready" : (possessionDate(p) ?? "On request");

  return (
    <div className="bg-cobalt mt-1.5 w-full max-w-[460px] rounded-[18px] rounded-tl-[6px] p-2 text-white">
      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{p.name}</p>
          <p className="truncate text-[11px] text-white/70">
            {p.locality}, {p.city}
          </p>
        </div>
        <Link
          href={`/projects/${p.id}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
          aria-label={`Open the fact sheet for ${p.name}`}
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { icon: IndianRupee, k: "Price band", v: compactRange(p.priceMinInr, p.priceMaxInr) },
          { icon: CalendarClock, k: "Possession", v: possession },
          { icon: KeyRound, k: "Booking", v: formatInr(p.bookingAmountInr) },
        ].map(({ icon: Icon, k, v }) => (
          <div key={k} className="text-ink rounded-[12px] bg-white px-2.5 py-2.5">
            <span className="bg-ice text-cobalt flex h-6 w-6 items-center justify-center rounded-full">
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <p className="text-ink-3 mt-2.5 text-[10.5px]">{k}</p>
            <p className="tnum mt-0.5 truncate text-[13px] font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {photos.length ? (
        <>
          <p className="px-2 pt-2.5 pb-1.5 text-[11.5px] text-white/85">Representative photos:</p>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((ph) => (
              <div key={ph.src} className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-white/10">
                <Image src={ph.src} alt={ph.alt} fill sizes="150px" className="object-cover" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
