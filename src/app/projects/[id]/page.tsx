import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PROJECTS, formatInr, getProject } from "@/lib/projects";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return { title: "Project not found" };
  return { title: `${p.name} — Aarambh Realty`, description: p.tagline };
}

const STATUS_LABEL = {
  ready_to_move: "Ready to move",
  under_construction: "Under construction",
  new_launch: "New launch",
} as const;

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) notFound();

  const siblings = PROJECTS.filter((x) => x.id !== p.id && x.city === p.city).slice(0, 3);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/projects" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-24 sm:px-8">
        <div className="shiro mt-10">
          <Link href="/projects" className="eyebrow hover:text-ink transition-colors">
            ← All projects
          </Link>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="eyebrow">{STATUS_LABEL[p.status]}</span>
            <span className="text-ink-3 font-mono text-[10.5px]">{p.reraId}</span>
          </div>

          <h1 className="font-display text-ink mt-2 text-[34px] leading-[1.1] sm:text-[46px]">{p.name}</h1>
          <p className="text-ink-2 mt-2 text-[15px]">
            {p.locality}, {p.city} · {p.microMarket}
          </p>
          <p className="text-ink-2 mt-4 max-w-[62ch] text-[16px] leading-relaxed">{p.tagline}</p>
        </div>

        {/* Headline numbers */}
        <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {[
            { k: "Price band", v: p.priceRangeLabel },
            { k: "Booking amount", v: formatInr(p.bookingAmountInr) },
            { k: "Property type", v: p.propertyType },
            { k: "Configurations", v: Array.from(new Set(p.units.filter((u) => u.available).map((u) => u.configuration))).join(" · ") },
          ].map((s) => (
            <div key={s.k} className="shiro shiro-soft">
              <dt className="eyebrow">{s.k}</dt>
              <dd className="font-display text-ink mt-1.5 text-[19px] leading-tight capitalize">{s.v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* Left column */}
          <div>
            <section className="shiro">
              <span className="eyebrow">Inventory</span>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left">
                  <thead>
                    <tr className="border-rule border-b">
                      {["Type", "Saleable", "Carpet", "Price"].map((h) => (
                        <th key={h} className="text-ink-3 pb-2 font-mono text-[9.5px] font-normal tracking-[0.08em] uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.units.map((u, i) => (
                      <tr key={`${u.configuration}-${i}`} className="border-rule-2 border-b last:border-b-0">
                        <td className="text-ink py-2.5 text-[13.5px] font-semibold">
                          {u.configuration}
                          {!u.available ? <span className="text-magenta ml-1.5 text-[10px]">sold out</span> : null}
                        </td>
                        <td className="text-ink-2 tnum py-2.5 font-mono text-[12px]">{u.saleableAreaSqft} ft²</td>
                        <td className="text-ink-2 tnum py-2.5 font-mono text-[12px]">{u.carpetAreaSqft} ft²</td>
                        <td className="text-ink tnum py-2.5 font-mono text-[12px]">
                          {formatInr(u.priceMinInr)}
                          {u.priceMaxInr !== u.priceMinInr ? `–${formatInr(u.priceMaxInr)}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="shiro shiro-soft mt-12">
              <span className="eyebrow">Possession</span>
              <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">{p.possession}</p>
            </section>

            <section className="shiro shiro-soft mt-12">
              <span className="eyebrow">Why buyers pick it</span>
              <ul className="mt-3 space-y-2">
                {p.usps.map((u) => (
                  <li key={u} className="text-ink-2 border-aqua/30 border-l-2 pl-3 text-[14px] leading-relaxed">
                    {u}
                  </li>
                ))}
              </ul>
            </section>

            <section className="shiro shiro-soft mt-12">
              <span className="eyebrow">Payment plans</span>
              <ul className="text-ink-2 mt-3 space-y-2 text-[14px] leading-relaxed">
                {p.paymentPlans.map((pl) => (
                  <li key={pl} className="border-rule-2 border-b pb-2 last:border-b-0">
                    {pl}
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-paper-2 mt-12 rounded-sm px-5 py-4">
              <span className="eyebrow">How she pitches it out loud</span>
              <p className="font-display text-ink mt-2 text-[16px] leading-[1.8]">&ldquo;{p.pitchHinglish}&rdquo;</p>
            </section>
          </div>

          {/* Right column */}
          <aside>
            <section className="shiro">
              <span className="eyebrow">Location advantages</span>
              <ul className="mt-3">
                {p.locationAdvantages.map((l) => (
                  <li key={l.label} className="border-rule-2 flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
                    <span className="text-ink-2 text-[13.5px]">{l.label}</span>
                    <span className="text-ink-3 shrink-0 font-mono text-[11px]">{l.distance}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="shiro shiro-soft mt-12">
              <span className="eyebrow">Amenities</span>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.amenities.map((a) => (
                  <span key={a} className="border-rule text-ink-2 rounded-full border px-2.5 py-1 text-[11.5px]">
                    {a}
                  </span>
                ))}
              </div>
            </section>

            {siblings.length ? (
              <section className="shiro shiro-soft mt-12">
                <span className="eyebrow">Also in {p.city}</span>
                <ul className="mt-3 space-y-2">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <Link href={`/projects/${s.id}`} className="group block py-1">
                        <span className="text-ink group-hover:text-aqua text-[13.5px] font-semibold transition-colors">
                          {s.name.replace("Aarambh ", "")}
                        </span>
                        <span className="text-ink-3 block font-mono text-[11px]">{s.priceRangeLabel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Link
              href="/call"
              className="bg-ink text-paper hover:bg-aqua mt-12 flex min-h-12 items-center justify-center rounded-sm text-[14px] font-semibold transition-colors"
            >
              Ask Priya about this
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
