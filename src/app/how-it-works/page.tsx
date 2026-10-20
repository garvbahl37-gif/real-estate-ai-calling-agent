import type { Metadata } from "next";
import Link from "next/link";
import { AudioLines, Bug, Layers, Network, PhoneCall, Rocket, Sparkles, TriangleAlert, Wrench } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SignalPath } from "@/components/SignalPath";
import { Chip, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AGENT_FUNCTION_DECLARATIONS } from "@/lib/agent-tools";
import { PROJECTS, operatingMarkets } from "@/lib/projects";

export const metadata: Metadata = {
  title: "How it works — architecture & stack",
  description:
    "The architecture behind the AI calling agent: Gemini Live native audio, ephemeral tokens, tool-based lead capture, and the Twilio bridge.",
};

const STACK = [
  { layer: "Voice", choice: "Gemini Live API — gemini-3.1-flash-live-preview", why: "Native speech-to-speech. No ASR→LLM→TTS chain, so no compounding latency and no lost prosody. Free tier." },
  { layer: "Reasoning", choice: "Same Live model, with function calling", why: "Qualification and project matching happen inside the voice turn, not in a second pass." },
  { layer: "Post-call", choice: "Gemini 3.5 Flash + responseSchema", why: "Structured summary and lead scoring. Free tier. ~1.4 s." },
  { layer: "App", choice: "Next.js 16 (App Router) + TypeScript + Tailwind 4", why: "One deployable for the UI, the API routes and the CRM." },
  { layer: "Audio", choice: "Two AudioWorklets (16 kHz capture / 24 kHz playback)", why: "Off the main thread, so a React render can never stutter the audio." },
  { layer: "Storage", choice: "Neon Postgres, in-memory fallback", why: "Free tier. Falls back to memory so the repo runs with zero setup." },
  { layer: "Telephony", choice: "Twilio Media Streams ↔ Node WebSocket bridge", why: "Optional. Adds a real dial-in number without changing the agent." },
  { layer: "Hosting", choice: "Vercel", why: "Free tier. Everything except the telephony bridge is serverless." },
];

const CHALLENGES = [
  {
    title: "Ephemeral tokens silently drop your config",
    body: "The agent connected, spoke fluently, and introduced itself as “Gemini” in English. The system instruction was never applied. The Live API treats an ephemeral token's liveConnectConstraints.config as authoritative and discards whatever the client passes to live.connect(). Once the whole config is minted into the token, it works — and the browser can no longer tamper with the prompt, the tools or the guardrails, which is a better design than the one I started with.",
  },
  {
    title: "enableAffectiveDialog kills token-based sessions",
    body: "Every session died on connect with a bare “Internal error encountered.” Bisecting the config field by field isolated one flag: enableAffectiveDialog. It fails identically on v1alpha and v1beta, through a token and with a raw key, on both transports — it only appears to work with a minimal config, which is what made it look transport-specific at first. It is off, behind a flag, so it is one argument to re-test when the preview model stabilises.",
  },
  {
    title: "The agent will not speak first",
    body: "The Live API is turn-based and stays silent until it receives something, no matter what the system instruction says about greeting. A real outbound call opens with the agent, so the session sends a short text turn on connect. Doing that inside the onopen callback does nothing — onopen fires before live.connect() resolves, so the session handle is still undefined.",
  },
  {
    title: "Barge-in has to flush audio you already queued",
    body: "Playback is a worklet draining a queue of PCM chunks rather than scheduled buffer sources. On an interruption the queue is dropped and the agent goes quiet within one render quantum (~2.7 ms). Scheduling AudioBufferSourceNodes instead would keep playing audio already handed to the audio thread, which is exactly the “robot talks over you” failure.",
  },
  {
    title: "She invented a city",
    body: "An early opening line was “aapne humaari Gurgaon wali property ke liye enquiry ki thi” — there are no Gurgaon projects. It had generalised from an example in the prompt. Fixed by removing the location from the opening template and adding an explicit geography rule listing the only markets she operates in.",
  },
    {
    title: "A fix for a bug that did not exist",
    body: "Transcripts filled with sentences nobody had said, so I built a client-side noise gate to stop the model inventing words out of room tone. It made the agent noticeably slow: the gate closes during the ordinary pauses inside a sentence, fragmenting the stream. Measuring the microphone afterwards showed the real cause — it was picking up actual speech in the room at ten times the gate threshold. The gate was reverted. The lesson was to measure the input before theorising about the model.",
  },
  {
    title: "gemini-2.5-flash is a trap on new keys",
    body: "The obvious default for the summariser returns 404 “no longer available to new users” on a freshly issued API key, as does 2.5-flash-lite. Verified gemini-3.5-flash against a new key instead.",
  },
];

const NEXT_VERSION = [
  "Outbound campaigns — upload a list, dial through it, respect DND and calling hours.",
  "Real integrations behind the simulated tools: WhatsApp Business for the brochure, a calendar for site visits, a real CRM for the lead.",
  "Retrieval over brochures and price sheets instead of a hand-written catalogue, so adding a project is a document upload.",
  "Call recording with consent capture, plus a Hindi word-error-rate benchmark to catch quality regressions.",
  "Warm transfer to a human the moment the caller asks for one, instead of promising a callback.",
  "An eval suite of scripted difficult callers — angry, silent, out-of-budget, wrong number — run on every prompt change.",
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/how-it-works" />

      <main className="flex flex-1 flex-col gap-3">
        <section className="bg-canvas rounded-card p-2.5 sm:p-4">
          <div className="wash rounded-[22px] px-5 py-12 sm:px-10 sm:py-16">
            <Chip tone="white" icon={<Network className="h-3.5 w-3.5" />}>
              Architecture
            </Chip>
            <h1 className="text-ink mt-5 max-w-[20ch] text-[38px] leading-[1.06] font-medium tracking-[-0.035em] sm:text-[54px]">
              How a phone call becomes a scored lead
            </h1>
            <dl className="mt-10 grid max-w-[880px] grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Projects in the catalogue", v: String(PROJECTS.length) },
                { k: "Markets covered", v: String(operatingMarkets().length) },
                { k: "Agent tools", v: String(AGENT_FUNCTION_DECLARATIONS.length) },
                { k: "Unit tests", v: "42" },
              ].map((s2, i) => (
                <div key={s2.k} className={cn("rounded-[20px] px-5 py-5", i === 0 ? "bg-cobalt text-white" : "bg-white")}>
                  <dt className={cn("text-[12px] font-medium", i === 0 ? "text-white/75" : "text-ink-3")}>{s2.k}</dt>
                  <dd className={cn("tnum mt-2 text-[32px] leading-none font-medium tracking-[-0.03em]", i === 0 ? "text-white" : "text-ink")}>
                    {s2.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------- Signal path ---------------- */}
        <section className="bg-canvas rounded-card px-5 py-10 sm:px-8 sm:py-12">
          <div className="grid gap-5 lg:grid-cols-2 lg:items-end">
            <div>
              <Chip icon={<AudioLines className="h-3.5 w-3.5" />}>Signal path</Chip>
              <h2 className="text-ink mt-4 text-[28px] leading-tight font-medium tracking-[-0.025em] sm:text-[34px]">
                Two transports, one agent
              </h2>
            </div>
            <p className="text-ink-2 max-w-[60ch] text-[14px] leading-relaxed lg:justify-self-end">
              The browser and the phone differ only in how audio gets in and out — the prompt, the tools and the
              executor behind them are the same code.
            </p>
          </div>
          <div className="mt-8">
            <SignalPath />
          </div>
        </section>

        {/* ---------------- Key decisions ---------------- */}
        <section className="bg-canvas rounded-card px-5 py-10 sm:px-8 sm:py-12">
          <Chip icon={<Sparkles className="h-3.5 w-3.5" />}>Three decisions that shaped everything</Chip>
          <div className="mt-8 grid gap-3 lg:grid-cols-3">
            {[
              {
                n: "Native speech-to-speech, not a pipeline",
                b: "The common build is Whisper → LLM → TTS. Three network hops, three failure modes, and every pause, hesitation and tonal cue is thrown away at the first step. A native audio model hears the audio and answers with audio, which is why interruption feels immediate and why the Hindi does not sound read aloud.",
              },
              {
                n: "The browser talks to Google directly",
                b: "Audio never passes through our server. The API route mints a single-use ephemeral token with the whole session configuration locked inside, and the browser opens its own socket. No proxy latency on every 128 ms chunk, no long-lived socket on a serverless function, and the raw API key never leaves the server.",
              },
              {
                n: "Qualification happens through tools, not parsing",
                b: "The agent calls update_lead_requirements the moment she learns anything, so the CRM fills in while she is still talking and a dropped call still leaves a partial lead. The post-call model reconciles rather than extracts from scratch — and tool-captured fields always win.",
              },
            ].map((d, i) => (
              <Reveal key={d.n} delay={i * 110} className={cn("rounded-[22px] p-6", i === 1 ? "bg-cobalt text-white" : "wash-soft")}>
                <span className={cn("font-mono text-[12px] font-semibold", i === 1 ? "text-white/70" : "text-cobalt")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={cn("mt-3 text-[18px] leading-snug font-semibold tracking-[-0.015em]", i === 1 ? "text-white" : "text-ink")}>
                  {d.n}
                </h3>
                <p className={cn("mt-3 text-[13.5px] leading-[1.7]", i === 1 ? "text-white/80" : "text-ink-2")}>{d.b}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Stack ---------------- */}
        <section className="bg-canvas rounded-card px-5 py-10 sm:px-8 sm:py-12">
          <Chip icon={<Layers className="h-3.5 w-3.5" />}>Stack</Chip>
          <div className="bg-frost rounded-panel mt-6 overflow-x-auto p-2">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-left">
              <thead>
                <tr>
                  {["Layer", "Choice", "Why"].map((h) => (
                    <th key={h} className="text-ink-3 px-4 pb-1 text-[12px] font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STACK.map((r) => (
                  <tr key={r.layer} className="bg-white">
                    <td className="text-ink w-[120px] rounded-l-[12px] px-4 py-3.5 align-top text-[13.5px] font-semibold">{r.layer}</td>
                    <td className="text-navy w-[320px] px-4 py-3.5 align-top font-mono text-[12px] leading-relaxed">{r.choice}</td>
                    <td className="text-ink-2 rounded-r-[12px] px-4 py-3.5 align-top text-[13px] leading-relaxed">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Tools ---------------- */}
        <section className="bg-canvas rounded-card px-5 py-10 sm:px-8 sm:py-12">
          <div className="grid gap-5 lg:grid-cols-2 lg:items-end">
            <div>
              <Chip icon={<Wrench className="h-3.5 w-3.5" />}>The agent&rsquo;s tools</Chip>
              <h2 className="text-ink mt-4 text-[28px] leading-tight font-medium tracking-[-0.025em] sm:text-[34px]">
                Declared once, shared by both transports
              </h2>
            </div>
            <p className="text-ink-2 max-w-[60ch] text-[14px] leading-relaxed lg:justify-self-end">
              The executor is pure — it touches no network — because a database round-trip inside a tool call is audible
              on a voice call as a stall. Persistence happens on a separate timer.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_FUNCTION_DECLARATIONS.map((t) => (
              <div key={t.name} className="bg-frost rounded-[20px] p-5">
                <code className="text-cobalt rounded-md bg-white px-2 py-1 font-mono text-[12px] font-semibold">{t.name}</code>
                <p className="text-ink-2 mt-3 text-[12.5px] leading-[1.6]">{t.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Challenges ---------------- */}
        <section className="bg-canvas rounded-card px-5 py-10 sm:px-8 sm:py-12">
          <Chip icon={<Bug className="h-3.5 w-3.5" />}>What went wrong on the way</Chip>
          <h2 className="text-ink mt-4 text-[28px] leading-tight font-medium tracking-[-0.025em] sm:text-[34px]">
            Problems that were not in any documentation
          </h2>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {CHALLENGES.map((c, i) => (
              <Reveal key={c.title} delay={(i % 2) * 100} className="wash-soft rounded-[22px] p-6">
                <h3 className="text-ink text-[15.5px] leading-snug font-semibold">{c.title}</h3>
                <p className="text-ink-2 mt-3 text-[13.5px] leading-[1.7]">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Limits + next ---------------- */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="bg-canvas rounded-card px-5 py-10 sm:px-8">
            <Chip icon={<TriangleAlert className="h-3.5 w-3.5" />}>Known limitations</Chip>
            <ul className="mt-6 space-y-2">
              {[
                "Free-tier rate limits apply. Sustained concurrent calls will hit them.",
                "Site visits, WhatsApp messages and callbacks are recorded on the lead, not actually dispatched.",
                "Phone audio is 8 kHz μ-law, so telephony transcription is measurably worse than the browser demo.",
                "The catalogue is hand-written TypeScript. Adding a project means a code change, not a document upload.",
                "No authentication on the CRM — anyone with the URL can read the leads. Fine for a demo, not for real leads.",
                "Heavy accents and very noisy lines still degrade recognition; she asks the caller to repeat rather than guessing.",
                "Only the browser demo is deployed serverless; the phone bridge needs a long-lived process.",
              ].map((l) => (
                <li key={l} className="bg-frost text-ink-2 rounded-[14px] px-4 py-3 text-[13.5px] leading-relaxed">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-cobalt rounded-card px-5 py-10 text-white sm:px-8">
            <Chip tone="glass" icon={<Rocket className="h-3.5 w-3.5" />}>
              Next version
            </Chip>
            <ul className="mt-6 space-y-2">
              {NEXT_VERSION.map((l) => (
                <li key={l} className="rounded-[14px] bg-white/12 px-4 py-3 text-[13.5px] leading-relaxed text-white/90">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-canvas rounded-card p-2.5 sm:p-4">
          <div className="wash rounded-[22px] px-6 py-14 text-center">
            <h2 className="text-ink text-[28px] font-medium tracking-[-0.03em] sm:text-[36px]">Hear it for yourself.</h2>
            <Link href="/call" className={cn(btn("primary", "lg"), "mt-7")}>
              <PhoneCall className="h-4 w-4" aria-hidden />
              Try it yourself
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
