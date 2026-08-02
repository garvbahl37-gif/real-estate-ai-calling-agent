import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PROJECTS, formatInr, operatingMarkets } from "@/lib/projects";

/**
 * The hero excerpt is verbatim from a recorded end-to-end test, not written
 * copy. It is the most characteristic artefact this product makes, so it opens
 * the page instead of a stock skyline photograph.
 */
const HERO_EXCHANGE = [
  { who: "priya", text: "Namaste! Main Priya bol rahi hoon Aarambh Realty se — do minute baat kar sakte hain?" },
  { who: "caller", text: "Main investment ke liye dekh raha hoon, Noida mein" },
  {
    who: "priya",
    text: "Achha, Noida mein investment ke liye? Kis area mein dekh rahe hain — Sector 150, Expressway side ya kahin aur?",
  },
  { who: "caller", text: "3BHK chahiye, budget around 1.5 crore tak" },
  {
    who: "priya",
    text: "Isme hamara Skyline Greens hai, Sector 150 mein. 3BHK 1.35 se 1.65 crore ke beech. Expressway se 5 minute door. Possession December 2027.",
  },
];

const CAPABILITIES = [
  {
    title: "Speaks the way buyers speak",
    body: "Hindi, Hinglish and Indian English, switching mid-sentence to follow the caller. No script, no IVR tree, no “press 1 for sales”.",
  },
  {
    title: "Stops when you interrupt",
    body: "Talk over her and she stops within milliseconds and answers what you just asked — the same barge-in a real salesperson has.",
  },
  {
    title: "Qualifies while she talks",
    body: "Location, configuration, budget, purpose, timeline and contact details are written to the CRM through tool calls during the call, not extracted afterwards.",
  },
  {
    title: "Sells only what exists",
    body: "Every price, possession date and distance comes from a fixed catalogue. No guaranteed returns, no invented amenities, no commitments she can't keep.",
  },
];

export default function Home() {
  // Derived, not hardcoded — the band drifted out of date the moment the
  // catalogue grew from four projects to fifteen.
  const cheapest = Math.min(...PROJECTS.map((p) => p.priceMinInr));
  const dearest = Math.max(...PROJECTS.map((p) => p.priceMaxInr));

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/" />

      <main className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="mx-auto max-w-[1400px] px-5 pt-14 pb-20 sm:px-8 sm:pt-20">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-20">
            <div>
              <p className="eyebrow">AI calling agent · real estate · Delhi NCR</p>
              <h1 className="font-display text-ink mt-5 text-[42px] leading-[1.08] tracking-[-0.01em] sm:text-[58px]">
                She calls property buyers
                <br />
                and speaks <span className="text-aqua">हिंदी</span>.
              </h1>
              <p className="text-ink-2 mt-6 max-w-[56ch] text-[16px] leading-[1.7]">
                Priya is a voice agent for a fictional Noida developer. She opens the call, works out what you want,
                pitches the project that actually fits your budget, handles the questions you interrupt her with, and
                leaves a scored lead behind. Speech in, speech out — no robot pauses in between.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/call"
                  className="bg-ink text-paper hover:bg-aqua inline-flex min-h-12 items-center gap-3 rounded-sm px-6 text-[15px] font-semibold transition-colors"
                >
                  <span className="bg-paper/25 flex h-6 w-6 items-center justify-center rounded-full">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .7-.2 1l-2.3 2.2z" />
                    </svg>
                  </span>
                  Talk to her now
                </Link>
                <Link
                  href="/how-it-works"
                  className="border-rule text-ink hover:border-ink inline-flex min-h-12 items-center rounded-sm border px-5 text-[14px] font-semibold transition-colors"
                >
                  How it works
                </Link>
              </div>

              <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                {[
                  { k: "Languages", v: "3", note: "Hindi · Hinglish · English" },
                  { k: "Projects", v: String(PROJECTS.length), note: `${formatInr(cheapest)} – ${formatInr(dearest)}` },
                  { k: "Markets", v: String(operatingMarkets().length), note: "Noida · Greater Noida · Ghaziabad" },
                  { k: "Running cost", v: "₹0", note: "Free tier throughout" },
                ].map((s) => (
                  <div key={s.k} className="shiro shiro-soft">
                    <dt className="eyebrow">{s.k}</dt>
                    <dd className="font-display text-ink mt-1.5 text-[30px] leading-none">{s.v}</dd>
                    <dd className="text-ink-3 mt-1.5 text-[11.5px] leading-snug">{s.note}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <aside className="lg:pt-2">
              <div className="shiro">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">From a recorded call</span>
                  <span className="text-ink-3 font-mono text-[10px]">00:00 — 00:52</span>
                </div>
              </div>
              <div className="mt-5 space-y-5">
                {HERO_EXCHANGE.map((line, i) => (
                  <div key={i}>
                    <span
                      className={`font-mono text-[10px] font-semibold tracking-[0.12em] uppercase ${
                        line.who === "priya" ? "text-aqua" : "text-magenta"
                      }`}
                    >
                      {line.who === "priya" ? "Priya" : "Caller"}
                    </span>
                    <p
                      className={`font-display mt-1 border-l-2 pl-3 text-[15.5px] leading-[1.75] ${
                        line.who === "priya" ? "border-aqua/30 text-ink" : "border-magenta/30 text-ink-2"
                      }`}
                    >
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-ink-3 mt-6 text-[12px] leading-relaxed">
                Verbatim from an end-to-end test. That call ran 92 seconds, fired 9 tool calls and scored the lead
                90/100.
              </p>
            </aside>
          </div>
        </section>

        {/* ---------------- Capabilities ---------------- */}
        <section className="border-rule border-t">
          <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map((c) => (
                <div key={c.title} className="shiro">
                  <h3 className="text-ink text-[15px] leading-snug font-semibold">{c.title}</h3>
                  <p className="text-ink-2 mt-2.5 text-[13.5px] leading-[1.65]">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Catalogue ---------------- */}
        <section className="border-rule border-t">
          <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">What she can sell</p>
                <h2 className="font-display text-ink mt-3 text-[30px] leading-tight sm:text-[36px]">
                  Four projects, one honest catalogue.
                </h2>
                <p className="text-ink-2 mt-3 max-w-[62ch] text-[14.5px] leading-relaxed">
                  Deliberately spread across budgets and property types, so changing your budget mid-call genuinely
                  changes what she recommends. All fictional — invented for this demo, no real developer data.
                </p>
              </div>
              <Link
                href="/projects"
                className="text-aqua hover:text-ink inline-flex min-h-9 items-center text-[13px] font-semibold underline-offset-4 hover:underline"
              >
                See the full catalogue →
              </Link>
            </div>

            <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECTS.map((p) => (
                <article key={p.id} className="shiro">
                  <span className="eyebrow">{p.locality}</span>
                  <h3 className="font-display text-ink mt-2 text-[19px] leading-snug">{p.name}</h3>
                  <p className="text-ink-2 mt-2 text-[13px] leading-relaxed">{p.tagline}</p>
                  <p className="text-ink mt-3 font-mono text-[12.5px] font-semibold">{p.priceRangeLabel}</p>
                  <p className="text-ink-3 mt-1 text-[11.5px]">
                    {Array.from(new Set(p.units.filter((u) => u.available).map((u) => u.configuration))).join(" · ")}
                  </p>
                  <p className="text-ink-3 mt-2 text-[11.5px] leading-snug">
                    {p.status === "ready_to_move"
                      ? "Ready to move"
                      : p.status === "new_launch"
                        ? "New launch"
                        : "Under construction"}
                    {" · from "}
                    {formatInr(p.priceMinInr)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Honesty ---------------- */}
        <section className="border-rule border-t">
          <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-20">
              <div>
                <p className="eyebrow">What is real, what is not</p>
                <h2 className="font-display text-ink mt-3 text-[30px] leading-tight sm:text-[36px]">
                  No part of this pretends to be more than it is.
                </h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="shiro shiro-soft">
                  <span className="text-aqua font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                    Functional
                  </span>
                  <ul className="text-ink-2 mt-3 space-y-1.5 text-[13px] leading-relaxed">
                    <li>Live two-way voice with interruption</li>
                    <li>Hindi / Hinglish / English switching</li>
                    <li>Requirement capture via tool calls</li>
                    <li>Project matching against real budgets</li>
                    <li>Lead storage and call summaries</li>
                    <li>Inbound phone calls via Twilio</li>
                  </ul>
                </div>
                <div className="shiro shiro-soft">
                  <span className="text-magenta font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                    Simulated
                  </span>
                  <ul className="text-ink-2 mt-3 space-y-1.5 text-[13px] leading-relaxed">
                    <li>The developer and all four projects</li>
                    <li>RERA numbers — placeholders, unverified</li>
                    <li>Site visits are recorded, not booked</li>
                    <li>No WhatsApp message is actually sent</li>
                    <li>No CRM or dialer integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="border-rule border-t">
          <div className="mx-auto max-w-[1400px] px-5 py-20 text-center sm:px-8">
            <h2 className="font-display text-ink text-[32px] leading-tight sm:text-[42px]">
              Ask her for a 3BHK. Then change your mind.
            </h2>
            <p className="text-ink-2 mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed">
              Change the budget, change the sector, ask about possession, interrupt her halfway through. That is the
              interesting part.
            </p>
            <Link
              href="/call"
              className="bg-ink text-paper hover:bg-aqua mt-8 inline-flex min-h-12 items-center rounded-sm px-7 text-[15px] font-semibold transition-colors"
            >
              Start a call
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-rule border-t">
        <div className="text-ink-3 mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-[12px] sm:px-8">
          <span>Aarambh Realty is a fictional developer created for this demo.</span>
          <Link href="/how-it-works" className="hover:text-ink ml-auto inline-flex min-h-9 items-center underline-offset-4 hover:underline">
            Architecture &amp; stack
          </Link>
          <a href="/api/health" className="hover:text-ink inline-flex min-h-9 items-center underline-offset-4 hover:underline">
            System health
          </a>
        </div>
      </footer>
    </div>
  );
}
