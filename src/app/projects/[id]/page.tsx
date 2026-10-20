import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Check, MapPin, PhoneCall, Sparkles, Wallet } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectHero } from "@/components/ProjectHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Chip, Panel, PriyaAvatar, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { PROJECTS, formatInr, getProject } from "@/lib/projects";
import { compactRange, configurations } from "@/lib/presentation";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return { title: "Project not found" };
  return { title: `${p.name} — Aarambh Realty`, description: p.tagline };
}

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) notFound();

  const siblings = PROJECTS.filter((x) => x.id !== p.id && x.city === p.city).slice(0, 4);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/projects" />

      <ProjectHero project={p} />

      {/* Headline numbers */}
      <Card className="px-5 py-8 sm:px-8">
        <p className="text-ink-2 max-w-[70ch] text-[16px] leading-relaxed">{p.tagline}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: "Price band", v: p.priceRangeLabel },
            { k: "Booking amount", v: formatInr(p.bookingAmountInr) },
            { k: "Property type", v: p.propertyType },
            { k: "Configurations", v: configurations(p).join(" · ") },
          ].map((s, i) => (
            <div key={s.k} className={cn("rounded-[20px] px-5 py-5", i === 0 ? "bg-cobalt text-white" : "wash-soft")}>
              <dt className={cn("text-[12px] font-medium", i === 0 ? "text-white/75" : "text-ink-3")}>{s.k}</dt>
              <dd className={cn("mt-2 text-[20px] leading-tight font-medium tracking-[-0.02em] capitalize", i === 0 ? "text-white" : "text-ink")}>
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* Left column. min-w-0 is load-bearing: a grid child defaults to
            min-width:auto, so the inventory table's min-w-[420px] would push
            the column past a 390px viewport and the overflow-x-auto wrapper
            inside it could never shrink to scroll. */}
        <Card className="min-w-0 px-5 py-8 sm:px-8">
          <section id="inventory" className="scroll-mt-6">
            <h2 className="text-ink text-[20px] font-semibold tracking-[-0.015em]">Inventory</h2>
            <Panel className="mt-4 overflow-x-auto p-2">
              <table className="w-full min-w-[420px] border-separate border-spacing-y-1.5 text-left">
                <thead>
                  <tr>
                    {["Type", "Saleable", "Carpet", "Price"].map((h) => (
                      <th key={h} className="text-ink-3 px-4 pb-1 text-[12px] font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.units.map((u, i) => (
                    <tr key={`${u.configuration}-${i}`} className="bg-white">
                      <td className="text-ink rounded-l-[12px] px-4 py-3 text-[14px] font-semibold">
                        {u.configuration}
                        {!u.available ? (
                          <span className="bg-rose-wash text-rose ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold">
                            sold out
                          </span>
                        ) : null}
                      </td>
                      <td className="text-ink-2 tnum px-4 py-3 text-[13px]">{u.saleableAreaSqft.toLocaleString("en-IN")} ft²</td>
                      <td className="text-ink-2 tnum px-4 py-3 text-[13px]">{u.carpetAreaSqft.toLocaleString("en-IN")} ft²</td>
                      <td className="text-ink tnum rounded-r-[12px] px-4 py-3 text-[13px] font-semibold">
                        {compactRange(u.priceMinInr, u.priceMaxInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>

          <section className="mt-10">
            <h2 className="text-ink flex items-center gap-2 text-[20px] font-semibold tracking-[-0.015em]">
              <CalendarClock className="text-cobalt h-5 w-5" aria-hidden /> Possession
            </h2>
            <p className="text-ink-2 mt-3 text-[14.5px] leading-relaxed">{p.possession}</p>
          </section>

          <section className="mt-10">
            <h2 className="text-ink flex items-center gap-2 text-[20px] font-semibold tracking-[-0.015em]">
              <Sparkles className="text-cobalt h-5 w-5" aria-hidden /> Why buyers pick it
            </h2>
            <ul className="mt-4 space-y-2.5">
              {p.usps.map((u) => (
                <li key={u} className="text-ink-2 flex items-start gap-3 text-[14px] leading-relaxed">
                  <span className="bg-cobalt mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {u}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-ink flex items-center gap-2 text-[20px] font-semibold tracking-[-0.015em]">
              <Wallet className="text-cobalt h-5 w-5" aria-hidden /> Payment plans
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {p.paymentPlans.map((pl) => (
                <li key={pl} className="wash-soft text-ink-2 rounded-[16px] px-4 py-3 text-[13.5px] leading-relaxed">
                  {pl}
                </li>
              ))}
            </ul>
          </section>
        </Card>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="p-2.5 sm:p-3">
            <div className="wash rounded-[22px] p-5">
              <Chip tone="white">How she pitches it out loud</Chip>
              <div className="mt-5 flex items-start gap-2.5">
                <PriyaAvatar size={32} className="mt-1" />
                <p className="text-ink rounded-[18px] rounded-tl-[6px] bg-white px-4 py-3 text-[15px] leading-[1.7]">
                  &ldquo;{p.pitchHinglish}&rdquo;
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-5 py-7 sm:px-7">
            <h2 className="text-ink text-[18px] font-semibold tracking-[-0.015em]">Location advantages</h2>
            <ul className="mt-4 space-y-1.5">
              {p.locationAdvantages.map((l) => (
                <li key={l.label} className="bg-frost flex items-center gap-3 rounded-[14px] px-3.5 py-2.5">
                  <MapPin className="text-cobalt h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-ink-2 min-w-0 flex-1 text-[13.5px]">{l.label}</span>
                  <span className="text-navy shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-semibold">
                    {l.distance}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="px-5 py-7 sm:px-7">
            <h2 className="text-ink text-[18px] font-semibold tracking-[-0.015em]">Amenities</h2>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.amenities.map((a) => (
                <span key={a} className="bg-ice text-navy rounded-full px-3 py-1.5 text-[12px] font-medium">
                  {a}
                </span>
              ))}
            </div>
          </Card>

          <Link href="/call" className={cn(btn("primary", "lg"), "w-full")}>
            <PhoneCall className="h-4 w-4" aria-hidden />
            Ask Priya about this
          </Link>
        </div>
      </div>

      {siblings.length ? (
        <Card className="px-5 py-8 sm:px-8 sm:py-10">
          <Chip>Also in {p.city}</Chip>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {siblings.map((s) => (
              <ProjectCard key={s.id} project={s} />
            ))}
          </div>
        </Card>
      ) : null}

      <SiteFooter />
    </div>
  );
}
