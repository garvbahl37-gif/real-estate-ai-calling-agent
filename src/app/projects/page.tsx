import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PROJECTS, formatInr } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — Aarambh Realty",
  description: "The fictional project catalogue the AI agent sells from. Every price and date she quotes comes from here.",
};

const STATUS_LABEL = {
  ready_to_move: "Ready to move",
  under_construction: "Under construction",
  new_launch: "New launch",
} as const;

export default function ProjectsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/projects" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-24 sm:px-8">
        <div className="shiro mt-10">
          <p className="eyebrow">The agent&rsquo;s knowledge base</p>
          <h1 className="font-display text-ink mt-3 max-w-[20ch] text-[34px] leading-[1.12] sm:text-[44px]">
            Everything Priya knows, and nothing she doesn&rsquo;t.
          </h1>
          <p className="text-ink-2 mt-5 max-w-[70ch] text-[15px] leading-[1.7]">
            This catalogue is compiled into her system instruction and exposed through a{" "}
            <code className="font-mono text-[13.5px]">search_projects</code> tool. Every price band, possession date,
            carpet area and distance she quotes on a call is read from here. If a caller asks something this page does
            not answer, she is instructed to say she will confirm and get back — not to guess.
          </p>
          <p className="border-magenta/30 bg-magenta-wash text-ink-2 mt-6 max-w-[70ch] rounded-sm border px-4 py-3 text-[13px] leading-relaxed">
            <strong className="text-magenta font-semibold">All fictional.</strong> Aarambh Realty and these four
            projects were invented for this assignment. The RERA numbers are placeholders and are not real
            registrations. No confidential or proprietary developer data is used anywhere in this project.
          </p>
        </div>

        <div className="mt-16 space-y-20">
          {PROJECTS.map((p) => (
            <article key={p.id} className="shiro">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="eyebrow">{STATUS_LABEL[p.status]}</span>
                <span className="text-ink-3 font-mono text-[10.5px]">{p.reraId}</span>
              </div>

              <div className="mt-3 grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
                <div>
                  <h2 className="font-display text-ink text-[28px] leading-tight sm:text-[32px]">{p.name}</h2>
                  <p className="text-ink-2 mt-1.5 text-[14px]">
                    {p.locality}, {p.city} · {p.microMarket}
                  </p>
                  <p className="text-ink-2 mt-4 max-w-[62ch] text-[15px] leading-relaxed">{p.tagline}</p>

                  <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
                    <div>
                      <span className="eyebrow">Price band</span>
                      <p className="font-display text-ink mt-1 text-[21px] leading-none">{p.priceRangeLabel}</p>
                    </div>
                    <div>
                      <span className="eyebrow">Booking amount</span>
                      <p className="font-display text-ink mt-1 text-[21px] leading-none">
                        {formatInr(p.bookingAmountInr)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <span className="eyebrow">Possession</span>
                    <p className="text-ink-2 mt-1.5 text-[13.5px] leading-relaxed">{p.possession}</p>
                  </div>

                  <div className="mt-7">
                    <span className="eyebrow">Why buyers pick it</span>
                    <ul className="mt-2 space-y-1.5">
                      {p.usps.map((u) => (
                        <li key={u} className="text-ink-2 border-aqua/30 border-l-2 pl-3 text-[13.5px] leading-relaxed">
                          {u}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-paper-2 mt-7 rounded-sm px-4 py-3">
                    <span className="eyebrow">How she pitches it out loud</span>
                    <p className="font-display text-ink mt-1.5 text-[15px] leading-[1.75]">
                      &ldquo;{p.pitchHinglish}&rdquo;
                    </p>
                  </div>
                </div>

                <div>
                  <div className="shiro shiro-soft">
                    <span className="eyebrow">Inventory</span>
                    <table className="mt-2.5 w-full border-collapse text-left">
                      <thead>
                        <tr className="border-rule border-b">
                          {["Type", "Saleable", "Carpet", "Price"].map((h) => (
                            <th key={h} className="text-ink-3 pb-1.5 font-mono text-[9.5px] font-normal tracking-[0.08em] uppercase">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.units.map((u, i) => (
                          <tr key={`${u.configuration}-${i}`} className="border-rule-2 border-b last:border-b-0">
                            <td className="text-ink py-2 text-[13px] font-semibold">
                              {u.configuration}
                              {!u.available ? <span className="text-magenta ml-1.5 text-[10px]">sold out</span> : null}
                            </td>
                            <td className="text-ink-2 tnum py-2 font-mono text-[12px]">{u.saleableAreaSqft} ft²</td>
                            <td className="text-ink-2 tnum py-2 font-mono text-[12px]">{u.carpetAreaSqft} ft²</td>
                            <td className="text-ink tnum py-2 font-mono text-[12px]">
                              {formatInr(u.priceMinInr)}
                              {u.priceMaxInr !== u.priceMinInr ? `–${formatInr(u.priceMaxInr)}` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="shiro shiro-soft mt-8">
                    <span className="eyebrow">Location advantages</span>
                    <ul className="mt-2.5 space-y-1">
                      {p.locationAdvantages.map((l) => (
                        <li key={l.label} className="border-rule-2 flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0">
                          <span className="text-ink-2 text-[13px]">{l.label}</span>
                          <span className="text-ink-3 shrink-0 font-mono text-[11px]">{l.distance}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="shiro shiro-soft mt-8">
                    <span className="eyebrow">Amenities</span>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {p.amenities.map((a) => (
                        <span key={a} className="border-rule text-ink-2 rounded-full border px-2.5 py-1 text-[11.5px]">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="shiro shiro-soft mt-8">
                    <span className="eyebrow">Payment plans</span>
                    <ul className="text-ink-2 mt-2.5 space-y-1.5 text-[13px] leading-relaxed">
                      {p.paymentPlans.map((pl) => (
                        <li key={pl}>{pl}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="border-rule mt-20 border-t pt-10 text-center">
          <p className="font-display text-ink text-[24px]">Ask her about any of these.</p>
          <Link
            href="/call"
            className="bg-ink text-paper hover:bg-aqua mt-5 inline-flex min-h-12 items-center rounded-sm px-6 text-[14.5px] font-semibold transition-colors"
          >
            Start a call
          </Link>
        </div>
      </main>
    </div>
  );
}
