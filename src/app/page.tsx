import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Ear,
  Gauge,
  Languages,
  LayoutDashboard,
  MessageSquareOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Plug,
  ShieldCheck,
  Users,
  Volume2,
  Wrench,
} from "lucide-react";
import { Handset, HeroCall } from "@/components/HeroCall";
import { HowItWorks } from "@/components/HowItWorks";
import { IntroSplash } from "@/components/IntroSplash";
import { ChatLoop, CountUp, Parallax, ToolCallDemo } from "@/components/Motion";
import { Reveal, Words } from "@/components/Reveal";
import { ProjectCard } from "@/components/ProjectCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar, Card, Chip, Mark, PriyaAvatar, Ring, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { PROJECTS, formatInr, getProject, operatingMarkets } from "@/lib/projects";
import type { Project } from "@/lib/types";

const HEADLINE = ["She", "calls", "property", "buyers", "and", "speaks"];

/* One of each kind she sells, so the strip shows the spread rather than four towers. */
const FEATURED = ["skyline-greens", "villa-grande", "corporate-square", "green-acres"]
  .map((id) => getProject(id))
  .filter((p): p is Project => Boolean(p));

export default function Home() {
  // Derived, not hardcoded — the band drifted out of date the moment the
  // catalogue grew from four projects to fifteen.
  const cheapest = Math.min(...PROJECTS.map((p) => p.priceMinInr));
  const dearest = Math.max(...PROJECTS.map((p) => p.priceMaxInr));

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <IntroSplash />

      {/* ---------------- Hero ---------------- */}
      <Card as="div">
        <SiteHeader current="/" bare />

        <div className="grid gap-4 px-2.5 pb-2.5 sm:px-4 sm:pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-8">
          <div className="flex flex-col px-2.5 pt-8 pb-6 sm:px-4 lg:pt-16 lg:pb-8 lg:pl-8">
            <div className="fade-in-up" style={{ "--d": "0ms" } as React.CSSProperties}>
              <Chip icon={<Languages className="h-3.5 w-3.5" />}>Hindi · Hinglish · English</Chip>
            </div>
            <p className="text-ink fade-in-up mt-6 text-[15px]" style={{ "--d": "80ms" } as React.CSSProperties}>
              Introducing Priya, an AI calling agent for real estate
            </p>
            <h1 className="text-ink mt-3 text-[42px] leading-[1.06] font-medium tracking-[-0.035em] sm:text-[58px] lg:text-[64px]">
              {HEADLINE.map((w, i) => (
                <span key={i}>
                  <span className="word-in" style={{ "--w": i } as React.CSSProperties}>
                    {w}
                  </span>{" "}
                </span>
              ))}
              <span className="word-in" style={{ "--w": HEADLINE.length } as React.CSSProperties}>
                <span className="highlight highlight-in" style={{ "--d": "0.95s" } as React.CSSProperties}>
                  हिंदी
                </span>
              </span>
            </h1>
            <p className="text-ink-2 fade-in-up mt-6 max-w-[50ch] text-[16px] leading-[1.65]" style={{ "--d": "700ms" } as React.CSSProperties}>
              Priya phones buyers for a fictional Noida developer. She opens the call, works out what they want,
              pitches the project that actually fits the budget, answers what they interrupt her with, and leaves a
              scored lead behind. Speech in, speech out — no robot pauses in between.
            </p>

            <div className="fade-in-up relative mt-9 flex flex-wrap items-center gap-3" style={{ "--d": "850ms" } as React.CSSProperties}>
              <Link href="/call" className={btn("primary", "lg")}>
                <PhoneCall className="h-4 w-4" aria-hidden />
                Talk to her now
              </Link>
              <Link href="/how-it-works" className={btn("soft", "lg")}>
                How it works
              </Link>
            </div>

            {/* The one hand-written aside, drawn in after the buttons land, as on the reference. */}
            <div className="text-ink-2 mt-3 ml-28 hidden items-start gap-1 sm:flex" aria-hidden>
              <svg width="38" height="30" viewBox="0 0 38 30" fill="none" className="mt-0.5">
                <path
                  d="M36 26C24 27 10 22 6 6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  className="draw-in"
                  style={{ "--d": "1.35s" } as React.CSSProperties}
                />
                <path
                  d="M2.5 10 6 4.5l4.5 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="draw-in"
                  style={{ "--d": "1.85s" } as React.CSSProperties}
                />
              </svg>
              <span
                className="font-hand fade-in-up mt-3 -rotate-3 text-[19px] leading-none"
                style={{ "--d": "1.6s" } as React.CSSProperties}
              >
                interrupt her — she stops mid-word
              </span>
            </div>

            <div className="fade-in-up mt-auto pt-12" style={{ "--d": "1.1s" } as React.CSSProperties}>
              <p className="label">Runs on</p>
              <ul className="text-ink-3/80 mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-[15px] font-semibold tracking-[-0.01em]">
                <li>Gemini Live</li>
                <li>Twilio</li>
                <li>Neon Postgres</li>
                <li>Vercel</li>
              </ul>
            </div>
          </div>

          <HeroCall className="min-h-[540px] lg:min-h-[660px]" />
        </div>
      </Card>

      {/* ---------------- Capabilities ---------------- */}
      <Card className="overflow-hidden px-5 py-12 sm:px-10 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <Reveal
            as="h2"
            from="words"
            className="text-ink max-w-[16ch] text-[32px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[40px]"
          >
            <Words text="Qualifies the buyer while she talks" />
          </Reveal>
          <Reveal as="p" delay={200} className="text-ink-2 max-w-[52ch] text-[14.5px] leading-relaxed lg:justify-self-end">
            No script, no IVR tree, no &ldquo;press 1 for sales&rdquo;. Location, configuration, budget, purpose,
            timeline and contact details land in the CRM through tool calls during the conversation — not extracted
            afterwards.
          </Reveal>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard delay={0} title="Speaks the way buyers speak" body="Hindi, Hinglish and Indian English, switching mid-sentence to follow the caller.">
            <ChatLoop
              lines={[
                { text: "नमस्ते! बजट कितना रखा है?", side: "left", tone: "cobalt", tag: "Hindi" },
                { text: "Budget 1.5 crore tak hai", side: "right", tone: "white", tag: "Hinglish" },
                { text: "What's the possession date?", side: "right", tone: "pale", tag: "English" },
                { text: "Possession December 2027 hai.", side: "left", tone: "cobalt", tag: "Hinglish" },
              ]}
            />
          </FeatureCard>

          <FeatureCard delay={120} title="Stops when you interrupt" body="Talk over her and she goes quiet within one audio frame, then answers what you asked.">
            <ChatLoop
              stepMs={1300}
              lines={[
                { text: <>Possession December 20<span className="opacity-50">—</span></>, side: "left", tone: "white" },
                { text: "Aur RERA registered hai?", side: "right", tone: "cobalt" },
                { text: "Ji haan — RERA ID abhi bata deti hoon.", side: "left", tone: "white" },
              ]}
            />
            <LiveWaveMini className="mt-3" />
          </FeatureCard>

          <FeatureCard delay={240} title="Writes the lead as she goes" body="Every fact she learns is a tool call, so a dropped call still leaves a partial lead.">
            <ToolCallDemo />
          </FeatureCard>

          <FeatureCard delay={360} title="Sells only what exists" body="Every price, date and distance comes from a fixed catalogue. If it isn't there, she says she'll confirm.">
            <div className="rounded-[12px] bg-white p-3">
              <div className="flex items-center gap-2">
                <PriyaAvatar size={24} />
                <div className="min-w-0">
                  <p className="text-ink truncate text-[12px] font-semibold">Skyline Greens</p>
                  <p className="text-ink-3 text-[10px]">UPRERAPRJ-DEMO-150001</p>
                </div>
              </div>
              <dl className="mt-2.5 space-y-1.5 text-[11px]">
                {[
                  ["3BHK", "₹1.35 – 1.65 Cr"],
                  ["Possession", "Dec 2027"],
                  ["Expressway", "5 min drive"],
                  ["Guaranteed returns", "never promised"],
                ].map(([k, v], i) => (
                  <div key={k} className="seq flex items-center gap-2" style={{ "--i": i } as React.CSSProperties}>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white",
                        i === 3 ? "bg-ink-3" : "bg-cobalt",
                      )}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />
                    </span>
                    <dt className="text-ink-3 flex-1">{k}</dt>
                    <dd className="text-ink font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </FeatureCard>
        </div>
      </Card>

      {/* ---------------- What buyers ask ---------------- */}
      <Card className="relative overflow-hidden pt-5 pb-14 sm:pb-20">
        <Marquee />

        <Reveal className="relative px-5 pt-12 sm:px-10 sm:pt-20">
          <FloatingAsk i={0} speed={0.22} className="top-12 left-[6%]" name="Rohit S" tone="pale">
            Possession kab tak hai?
          </FloatingAsk>
          <FloatingAsk i={1} speed={-0.14} className="top-20 right-[7%]" name="Anita K" tone="cobalt" right delay>
            Is it RERA registered?
          </FloatingAsk>
          <FloatingAsk i={2} speed={-0.2} className="bottom-[2%] left-[4%]" name="Mohan P" tone="white" delay>
            क्या लोन मिल जाएगा?
          </FloatingAsk>
          <FloatingAsk i={3} speed={0.16} className="right-[5%] bottom-[6%]" name="Neha V" tone="pale" right>
            Sector 150 mein kya hai?
          </FloatingAsk>

          <div className="relative mx-auto max-w-[680px] pb-4 text-center">
            <Chip icon={<Users className="h-3.5 w-3.5" />}>What buyers ask her</Chip>
            <Reveal as="h2" from="words" delay={150} className="text-ink mt-5 text-[32px] leading-[1.12] font-medium tracking-[-0.03em] sm:text-[42px]">
              <Words text="Every enquiry gets a real conversation, in the buyer’s own language" />
            </Reveal>
          </div>
        </Reveal>

        <Reveal delay={150} as="div" className="relative mx-auto mt-12 max-w-[920px] px-5 sm:px-10 xl:px-0">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Languages", n: 3, note: "Hindi · Hinglish · English" },
            { k: "Projects", n: PROJECTS.length, note: `${formatInr(cheapest)} – ${formatInr(dearest)}` },
            { k: "Markets", n: operatingMarkets().length, note: "Noida · Greater Noida · Ghaziabad" },
            { k: "Running cost", n: 0, prefix: "₹", note: "Free tier throughout" },
          ].map((s) => (
            <div key={s.k} className="wash-soft rounded-[20px] px-5 py-5">
              <dt className="label">{s.k}</dt>
              <dd className="text-ink tnum mt-2 text-[34px] leading-none font-medium tracking-[-0.03em]">
                <CountUp value={s.n} prefix={s.prefix} />
              </dd>
              <dd className="text-ink-3 mt-2 text-[11.5px] leading-snug">{s.note}</dd>
            </div>
          ))}
        </dl>
        </Reveal>
      </Card>

      {/* ---------------- How a call becomes a lead ---------------- */}
      {/* Pinned scroll story on desktop, as in the reel; plain cards below lg. */}
      <HowItWorks
        className="hidden lg:block"
        steps={[
          {
            title: "She places the call",
            body: "Browser or a real phone line through Twilio — the same agent, the same tools, behind both.",
            stage: "wash",
            visual: (
              <div className="relative flex h-full items-center justify-center">
                {[620, 460, 320].map((s) => (
                  <span key={s} className="border-cobalt/12 absolute rounded-full border" style={{ width: s, height: s }} aria-hidden />
                ))}
                <span className="how-glow bg-cobalt/45 absolute bottom-[10%] h-[150px] w-[340px] rounded-full blur-3xl" aria-hidden />
                <div className="how-phone">
                  <Handset seconds={12} />
                </div>
                <span
                  className="seq text-ink absolute top-8 left-8 flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 text-[12.5px] font-semibold backdrop-blur"
                  style={{ "--i": 2 } as React.CSSProperties}
                >
                  <PhoneCall className="text-cobalt h-3.5 w-3.5" aria-hidden /> Outbound · +91 98100•••45
                </span>
              </div>
            ),
          },
          {
            title: "Real-time transcription",
            body: "Both sides transcribed as they speak, in the script they were spoken in — Hindi stays Hindi.",
            stage: "bg-[#dbe8fc]",
            visual: (
              <div className="relative flex h-full flex-col justify-center px-10 xl:px-16">
                <div className="mx-auto w-full max-w-[540px] space-y-3.5">
                  <TranscriptRow big i={0} who="caller" t="00:04">
                    Haan ji, boliye
                  </TranscriptRow>
                  <TranscriptRow big i={1} who="priya" t="00:06">
                    Aap Noida mein ghar dekh rahe the — apne liye ya investment?
                  </TranscriptRow>
                  <TranscriptRow big i={2} who="caller" t="00:11">
                    Investment, 3BHK chahiye. Budget 1.5 crore tak.
                  </TranscriptRow>
                  <TranscriptRow big i={3} who="priya" t="00:15">
                    Toh Skyline Greens dekhiye — Sector 150, 3BHK 1.35 se 1.65 crore.
                  </TranscriptRow>
                </div>
                <div className="seq absolute inset-x-0 bottom-10 flex justify-center" style={{ "--i": 4 } as React.CSSProperties}>
                  <LiveWave />
                </div>
              </div>
            ),
          },
          {
            title: "A scored lead, not a recording",
            body: "Summary, objections, next action and a 0–100 score, written the moment she hangs up.",
            stage: "bg-ice",
            visual: (
              <div className="flex h-full items-center justify-center">
                <div className="w-[400px] origin-center scale-[1.32]">
                  <SummaryMock />
                </div>
              </div>
            ),
          },
          {
            title: "Site visits, lined up",
            body: "Visits she agrees on the call land on the board with the day and time the buyer asked for.",
            stage: "bg-mid",
            visual: (
              <div className="relative h-full">
                <div className="absolute top-1/2 left-[12%] w-[620px] origin-left -translate-y-1/2 scale-[1.42]">
                  <CalendarMock />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Card className="px-5 py-12 sm:px-10 sm:py-16 lg:hidden">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Chip>How it works</Chip>
            <h2 className="text-ink mt-5 max-w-[18ch] text-[32px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[40px]">
              How a phone call becomes a scored lead
            </h2>
          </div>
          <p className="text-ink-2 max-w-[50ch] text-[14.5px] leading-relaxed lg:justify-self-end">
            One native-audio model hears the buyer and answers with its voice. The CRM fills in while she is still
            talking, and the call is summarised and scored the moment it ends.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-3 lg:grid-cols-2">
          <StepCard delay={0} step="01" title="She places the call" body="Browser or a real phone line through Twilio — the same agent behind both.">
            <div className="seq" style={{ "--i": 0 } as React.CSSProperties}>
              <PhoneMock />
            </div>
          </StepCard>
          <StepCard delay={120} step="02" title="Real-time transcription" body="Both sides transcribed as they speak, in the script they were spoken in.">
            <div className="mx-auto w-full max-w-[380px] space-y-2.5">
              <TranscriptRow i={0} who="caller" t="00:04">
                Haan ji, boliye
              </TranscriptRow>
              <TranscriptRow i={1} who="priya" t="00:06">
                Aap Noida mein ghar dekh rahe the — apne liye ya investment?
              </TranscriptRow>
              <TranscriptRow i={2} who="caller" t="00:11">
                Investment, 3BHK chahiye
              </TranscriptRow>
              <div className="seq" style={{ "--i": 3 } as React.CSSProperties}>
                <Waveform className="pt-2" />
              </div>
            </div>
          </StepCard>
          <StepCard delay={0} step="03" title="A scored lead, not a recording" body="Summary, objections, next action and a 0–100 score, written as soon as she hangs up.">
            <div className="seq w-full max-w-[360px]" style={{ "--i": 0 } as React.CSSProperties}>
              <SummaryMock />
            </div>
          </StepCard>
          <StepCard delay={120} step="04" title="Site visits, lined up" body="Visits she agrees on the call land on the board with the time the buyer asked for.">
            <div className="seq flex w-full justify-center" style={{ "--i": 0 } as React.CSSProperties}>
              <CalendarMock />
            </div>
          </StepCard>
        </div>
      </Card>

      {/* ---------------- Catalogue ---------------- */}
      <Card className="px-5 py-12 sm:px-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Chip>What she can sell</Chip>
            <Reveal as="h2" from="words" className="text-ink mt-5 text-[32px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[40px]">
              <Words text={`${PROJECTS.length} projects, one honest catalogue`} />
            </Reveal>
            <Reveal as="p" delay={250} className="text-ink-2 mt-3 max-w-[62ch] text-[14.5px] leading-relaxed">
              Spread across budgets and property types, so changing your budget mid-call genuinely changes what she
              recommends. All fictional — invented for this demo, no real developer data.
            </Reveal>
          </div>
          <Link href="/projects" className={btn("outline")}>
            See the full catalogue <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((p, i) => (
            <Reveal key={p.id} from="rise" delay={i * 120} className="flex">
              <ProjectCard project={p} className="w-full" zoomIn />
            </Reveal>
          ))}
        </div>
      </Card>

      {/* ---------------- Honesty ---------------- */}
      <Card className="px-5 py-12 sm:px-10 sm:py-16">
        <div className="text-center">
          <Chip icon={<Check className="h-3.5 w-3.5" />}>What is real, what is not</Chip>
          <Reveal
            as="h2"
            from="words"
            className="text-ink mx-auto mt-5 max-w-[20ch] text-[32px] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[40px]"
          >
            <Words text="No part of this pretends to be more than it is" />
          </Reveal>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Reveal from="rise" className="wash rounded-[22px] p-6 sm:p-8">
            <p className="text-ink text-[18px] font-semibold">Functional</p>
            <ul className="mt-5 space-y-3">
              {[
                "Live two-way voice with interruption",
                "Hindi / Hinglish / English switching",
                "Requirement capture via tool calls",
                "Project matching against real budgets",
                "Lead storage and call summaries",
                "Inbound and outbound phone calls via Twilio",
              ].map((l, i) => (
                <li
                  key={l}
                  className="seq text-ink-2 flex items-start gap-3 text-[14px] leading-snug"
                  style={{ "--i": i * 0.45 } as React.CSSProperties}
                >
                  <span className="bg-cobalt mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal from="rise" delay={150} className="bg-cobalt rounded-[22px] p-6 text-white sm:p-8">
            <p className="text-[18px] font-semibold">Simulated</p>
            <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {[
                { icon: Mark, t: "The developer", b: `Aarambh Realty and all ${PROJECTS.length} projects are invented.` },
                { icon: BadgeCheck, t: "RERA numbers", b: "Placeholders, not real registrations." },
                { icon: CalendarDays, t: "Site visits", b: "Recorded on the lead, not booked in a calendar." },
                { icon: MessageSquareOff, t: "WhatsApp", b: "No message is actually sent to the buyer." },
                { icon: Plug, t: "Integrations", b: "No external CRM or dialler is connected." },
              ].map(({ icon: Icon, t, b }, i) => (
                <div key={t} className="seq" style={{ "--i": i * 0.5 } as React.CSSProperties}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/15">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <p className="mt-3 text-[14.5px] font-semibold">{t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/75">{b}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Card>

      {/* ---------------- CTA ---------------- */}
      <Card className="p-2.5 sm:p-4">
        <Reveal className="wash relative overflow-hidden rounded-[22px] px-6 py-16 text-center sm:py-20">
          <Orbit />
          <Reveal
            as="h2"
            from="words"
            delay={200}
            className="text-ink mx-auto mt-8 max-w-[20ch] text-[30px] leading-[1.12] font-medium tracking-[-0.03em] sm:text-[40px]"
          >
            <Words text="Ask her for a 3BHK. Then change your mind." />
          </Reveal>
          <p className="text-ink-2 mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed">
            Change the budget, change the sector, ask about possession, interrupt her halfway through. That is the
            interesting part.
          </p>
          <Link href="/call" className={cn(btn("primary", "lg"), "mt-8")}>
            <PhoneCall className="h-4 w-4" aria-hidden />
            Start a call
          </Link>
        </Reveal>
      </Card>

      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** Rises into place like the reel's card row, one after another, then plays what is inside. */
function FeatureCard({ title, body, delay, children }: { title: string; body: string; delay: number; children: React.ReactNode }) {
  return (
    <Reveal from="rise" delay={delay} className="wash flex min-h-[360px] flex-col rounded-[22px] p-5">
      <h3 className="text-ink text-[18px] leading-[1.2] font-semibold tracking-[-0.015em]">{title}</h3>
      <p className="text-ink-2 mt-2 text-[13px] leading-relaxed">{body}</p>
      <div className="mt-auto pt-6">{children}</div>
    </Reveal>
  );
}

const MARQUEE = [
  { icon: Languages, t: "Hinglish", solid: false },
  { icon: Ear, t: "Barge-in", solid: true },
  { icon: Wrench, t: "Tool calls", solid: false },
  { icon: Gauge, t: "Lead scoring", solid: true },
  { icon: CalendarDays, t: "Site visits", solid: false },
  { icon: PhoneCall, t: "Phone line", solid: true },
  { icon: ShieldCheck, t: "Grounded facts", solid: false },
];

/** The tab strip that runs along the top of the reference's impact section. */
function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {MARQUEE.map(({ icon: Icon, t, solid }) => (
        <li key={t} className="text-ink flex items-center gap-2.5 text-[13px] font-medium tracking-[0.04em] whitespace-nowrap uppercase">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              solid ? "bg-mid text-white" : "bg-ice text-cobalt",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Decorative waveform. `cut` leaves the gap a barge-in makes. */
function Waveform({ className, cut }: { className?: string; cut?: boolean }) {
  const bars = [3, 5, 8, 12, 7, 10, 16, 9, 5, 12, 18, 11, 6, 9, 14, 8, 4, 7, 12, 16, 10, 6, 4, 8, 13, 9, 5, 3, 6, 10, 7, 4];
  return (
    <div className={cn("flex h-6 items-center gap-[3px]", className)} aria-hidden>
      {bars.map((h, i) => {
        const silent = cut && i >= 12 && i <= 15;
        return (
          <span
            key={i}
            className={cn("w-[3px] rounded-full", silent ? "bg-pale" : i > 15 && cut ? "bg-cobalt" : i % 3 ? "bg-mid" : "bg-cobalt")}
            style={{ height: silent ? 3 : h + 4 }}
          />
        );
      })}
    </div>
  );
}

function FloatingAsk({
  className,
  name,
  tone,
  right,
  delay,
  i,
  speed,
  children,
}: {
  className?: string;
  name: string;
  tone: "cobalt" | "pale" | "white";
  right?: boolean;
  delay?: boolean;
  i: number;
  /** How far it slides against the scroll; opposite signs pull neighbours apart. */
  speed: number;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("absolute hidden xl:block", className)} aria-hidden>
      <Parallax speed={speed}>
        <div className="drift" style={delay ? { animationDelay: "-3s" } : undefined}>
          <div className={cn("seq flex items-center gap-2", right && "flex-row-reverse")} style={{ "--i": i } as React.CSSProperties}>
            <Avatar name={name} size={36} className="ring-4 ring-white" />
            <span
              className={cn(
                "rounded-full px-3.5 py-2 text-[13px] font-medium shadow-[0_12px_24px_-16px_rgb(19_40_110/0.6)]",
                tone === "cobalt" && "bg-cobalt text-white",
                tone === "pale" && "bg-pale text-navy",
                tone === "white" && "text-ink border-line border bg-white",
              )}
            >
              {children}
            </span>
          </div>
        </div>
      </Parallax>
    </div>
  );
}

/** A short, always-moving meter for the barge-in card. */
function LiveWaveMini({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-6 items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className={cn("eq-bar w-[3px] rounded-full", i % 3 ? "bg-mid" : "bg-cobalt")}
          style={{ height: 6 + ((i * 7) % 16), animationDelay: `${(i % 6) * 0.12}s` }}
        />
      ))}
    </div>
  );
}

function StepCard({
  step,
  title,
  body,
  delay,
  children,
}: {
  step: string;
  title: string;
  body: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay} className="wash-soft flex flex-col gap-5 rounded-[22px] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-3 pt-3 sm:px-4">
        <span className="text-cobalt font-mono text-[12px] font-semibold">{step}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-ink text-[20px] leading-tight font-semibold tracking-[-0.015em]">{title}</h3>
          <p className="text-ink-2 mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="wash relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-[18px] p-5">
        {children}
      </div>
    </Reveal>
  );
}

function TranscriptRow({
  who,
  t,
  i,
  big,
  children,
}: {
  who: "priya" | "caller";
  t: string;
  i: number;
  big?: boolean;
  children: React.ReactNode;
}) {
  const isPriya = who === "priya";
  return (
    <div className={cn("seq flex items-end gap-2", isPriya && "flex-row-reverse")} style={{ "--i": i } as React.CSSProperties}>
      {isPriya ? <PriyaAvatar size={big ? 34 : 24} /> : <Avatar name="Rahul Verma" size={big ? 34 : 24} />}
      <p
        className={cn(
          "max-w-[78%] rounded-[14px] bg-white leading-snug",
          big ? "px-4 py-3 text-[14.5px] shadow-[0_12px_28px_-20px_rgb(19_40_110/0.6)]" : "px-3 py-2 text-[12px]",
          isPriya ? "rounded-br-[5px]" : "rounded-bl-[5px]",
        )}
      >
        {children}
        <span className="text-ink-3 tnum ml-2 font-mono text-[9px]">{t}</span>
      </p>
    </div>
  );
}

/** The reel's live waveform under the transcript: bars that keep moving. */
function LiveWave() {
  return (
    <div className="flex h-10 items-center gap-[4px]" aria-hidden>
      {Array.from({ length: 44 }, (_, i) => (
        <span
          key={i}
          className={cn("eq-bar w-[3px] rounded-full", i % 4 === 0 ? "bg-cobalt" : "bg-mid")}
          style={{ height: 8 + ((i * 11) % 30), animationDelay: `${(i % 9) * 0.1}s` }}
        />
      ))}
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative">
      <div className="bg-cobalt/30 absolute -inset-10 rounded-full blur-3xl" aria-hidden />
      <div className="relative w-[172px] rounded-[30px] border-[5px] border-[#16181d] bg-gradient-to-b from-[#3b63f0] to-[#14286e] px-4 pt-7 pb-5 text-center text-white shadow-[0_30px_60px_-30px_rgb(19_40_110/0.8)]">
        <span className="absolute top-2 left-1/2 h-[14px] w-[52px] -translate-x-1/2 rounded-full bg-[#16181d]" aria-hidden />
        <p className="text-[9.5px] text-white/70">Outbound · Aarambh Realty</p>
        <span className="mx-auto mt-4 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/15 ring-8 ring-white/10">
          <Mark className="h-8 w-8" strokeWidth={2} />
        </span>
        <p className="mt-3 text-[14px] font-semibold">Priya</p>
        <p className="tnum font-mono text-[10px] text-white/70">+91 98100•••45 · 00:12</p>
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {[MicOff, Volume2, Mic].map((Icon, i) => (
            <span key={i} className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          ))}
        </div>
        <span className="bg-rose mx-auto mt-4 flex h-9 w-9 items-center justify-center rounded-full">
          <PhoneOff className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function SummaryMock() {
  return (
    <div className="w-full max-w-[360px] rounded-[16px] bg-white p-4 shadow-[0_18px_40px_-26px_rgb(19_40_110/0.6)]">
      <div className="flex items-center gap-3">
        <Avatar name="Rahul Verma" size={36} />
        <div className="min-w-0">
          <p className="text-ink text-[13px] font-semibold">Rahul Verma</p>
          <p className="text-ink-3 tnum font-mono text-[10px]">+91 98100•••45 · New lead</p>
        </div>
        <Ring value={90} size={46} stroke={6} track="var(--color-pale)" className="ml-auto">
          <span className="text-ink tnum text-[12px] font-semibold">90</span>
        </Ring>
      </div>
      <div className="seq bg-ice mt-3 rounded-[10px] px-3 py-2" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="text-cobalt text-[10px] font-semibold">Call summary</p>
        <p className="text-ink-2 mt-0.5 text-[11px] leading-snug">
          3BHK in Sector 150 up to ₹1.5 Cr, for investment. Asked about possession and RERA; wants a Saturday visit.
        </p>
      </div>
      <dl className="mt-3 space-y-1 text-[11px]">
        {[
          ["Budget", "Up to ₹1.5 Cr"],
          ["Matched", "Skyline Greens"],
          ["Timeline", "3–6 months"],
        ].map(([k, v], i) => (
          <div key={k} className="seq flex justify-between" style={{ "--i": 1 + i } as React.CSSProperties}>
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="seq mt-4 grid grid-cols-2 gap-2" style={{ "--i": 4 } as React.CSSProperties}>
        <span className="border-line text-ink flex h-8 items-center justify-center rounded-full border text-[11.5px] font-semibold">
          Call back
        </span>
        <span className="bg-cobalt flex h-8 items-center justify-center rounded-full text-[11.5px] font-semibold text-white">
          Book visit
        </span>
      </div>
    </div>
  );
}

/** `i` is the order they pop onto the board. */
const VISITS: Record<string, { who: string; where: string; when: string; tone: string; i: number }[]> = {
  Fri: [{ who: "Neha", where: "Urbania", when: "Evening", tone: "bg-pale text-navy", i: 2 }],
  Sat: [
    { who: "Rahul", where: "Skyline Greens", when: "Morning", tone: "bg-cobalt text-white", i: 0 },
    { who: "Anita", where: "Meadows", when: "Afternoon", tone: "bg-mid text-navy", i: 3 },
  ],
  Sun: [{ who: "Mohan", where: "Villa Grande", when: "11 am", tone: "bg-cobalt text-white", i: 1 }],
};

function CalendarMock() {
  const days = ["Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex w-full max-w-[520px] overflow-hidden rounded-[14px] bg-white text-[10.5px] shadow-[0_18px_40px_-26px_rgb(19_40_110/0.6)]">
      <div className="border-line-2 hidden w-[112px] shrink-0 border-r p-3 sm:block">
        <span className="text-cobalt flex items-center gap-1 text-[11px] font-semibold">
          <Mark className="h-3.5 w-3.5" strokeWidth={2.2} /> Aarambh
        </span>
        <ul className="text-ink-3 mt-4 space-y-1">
          {[
            [LayoutDashboard, "Dashboard"],
            [Users, "Leads"],
            [CalendarDays, "Site visits"],
          ].map(([Icon, l], i) => {
            const I = Icon as typeof Users;
            return (
              <li
                key={l as string}
                className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-1", i === 2 && "bg-ice text-cobalt font-semibold")}
              >
                <I className="h-3 w-3" aria-hidden />
                {l as string}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-w-0 flex-1 p-3">
        <p className="text-ink text-[12px] font-semibold">Site visits</p>
        <p className="text-ink-3">This week</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {days.map((d) => (
            <div key={d}>
              <p className="text-ink-3 text-center font-medium">{d}</p>
              <div className="bg-frost mt-1.5 h-[150px] space-y-1.5 rounded-md p-1">
                {(VISITS[d] ?? []).map((v) => (
                  <span
                    key={v.who}
                    className={cn("seq block rounded-[5px] px-1.5 py-1.5 leading-tight", v.tone)}
                    style={{ "--i": v.i } as React.CSSProperties}
                  >
                    <span className="block truncate font-semibold">{v.who}</span>
                    <span className="block truncate opacity-80">{v.where}</span>
                    <span className="block truncate opacity-70">{v.when}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Orbit() {
  return (
    <div className="relative mx-auto h-[170px] w-[170px]" aria-hidden>
      <span className="border-cobalt/25 spin-slow absolute inset-0 rounded-full border border-dashed" />
      <span className="border-cobalt/20 absolute inset-[26px] rounded-full border" />
      <span className="absolute inset-[50px] flex items-center justify-center rounded-full bg-white">
        <PriyaAvatar size={52} className="live-ring" />
      </span>
      {/* The bento board's orbit: buyers circling Priya, faces kept upright. */}
      <div className="orbit absolute inset-0">
        {[
          { name: "Rohit S", pos: "-top-3 left-[70px]" },
          { name: "Neha V", pos: "top-[100px] -right-3" },
          { name: "Mohan P", pos: "bottom-3 left-0" },
        ].map((a) => (
          <span key={a.name} className={cn("orbit-upright absolute", a.pos)}>
            <Avatar name={a.name} size={32} className="ring-4 ring-white" />
          </span>
        ))}
      </div>
    </div>
  );
}
