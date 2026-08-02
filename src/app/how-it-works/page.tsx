import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AGENT_FUNCTION_DECLARATIONS } from "@/lib/agent-tools";

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
    body: "Every session died on connect with a bare “Internal error encountered.” Bisecting the config field by field isolated one flag: enableAffectiveDialog. It fails identically on v1alpha and v1beta, and only when the config is locked into a token — it works fine passed directly with a raw API key. It is off on the browser path and on for the Twilio bridge.",
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
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/how-it-works" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-24 sm:px-8">
        <div className="shiro mt-10">
          <p className="eyebrow">Architecture</p>
          <h1 className="font-display text-ink mt-3 max-w-[22ch] text-[34px] leading-[1.12] sm:text-[46px]">
            How a phone call becomes a scored lead.
          </h1>
        </div>

        {/* ---------------- Signal path ---------------- */}
        <section className="mt-14">
          <div className="shiro shiro-soft">
            <span className="eyebrow">Signal path</span>
          </div>
          <div className="thin-scroll mt-5 overflow-x-auto">
            <pre className="text-ink-2 font-mono text-[11.5px] leading-[1.75] whitespace-pre">{`  BROWSER DEMO                                          PHONE DEMO
  ────────────                                          ──────────
  Microphone                                            Caller dials Twilio number
      │  getUserMedia                                       │
      ▼                                                     ▼
  AudioWorklet  pcm-recorder                            TwiML  <Connect><Stream>
      │  Float32 → Int16, 16 kHz, 128 ms chunks             │
      │                                                     ▼
      │                                                 Twilio Media Streams
      │                                                 8 kHz μ-law, base64
      │                                                     │
      │                                                     ▼
      │                                                 Node WS bridge
      │                                                 μ-law → PCM 16 kHz
      │                                                     │
      └──────────────┐                     ┌────────────────┘
                     ▼                     ▼
              ╔═══════════════════════════════════╗
              ║   Gemini Live API  (WebSocket)    ║
              ║   native audio · speech-to-speech ║
              ╚═══════════════════════════════════╝
                     │                     │
        audio 24 kHz │                     │ toolCall
        transcripts  │                     ▼
                     │              executeAgentTool()
                     │              ├─ update_lead_requirements
                     │              ├─ search_projects
                     │              ├─ get_project_details
                     │              ├─ schedule_site_visit
                     │              └─ end_call
                     ▼                     │
              AudioWorklet pcm-player      │  requirements patch
              (queue + instant flush       ▼
               on barge-in)          Live CRM panel  ──►  PATCH /api/calls/:id
                                                              │
                                            call ends         ▼
                                                        Gemini 3.5 Flash
                                                        responseSchema
                                                              │
                                                              ▼
                                                        Postgres · summary,
                                                        score, objections`}</pre>
          </div>
        </section>

        {/* ---------------- Key decisions ---------------- */}
        <section className="mt-20">
          <div className="shiro">
            <span className="eyebrow">Three decisions that shaped everything</span>
          </div>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
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
              <div key={d.n} className="shiro shiro-soft">
                <span className="text-aqua font-mono text-[11px] font-bold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-ink mt-1.5 text-[15px] leading-snug font-semibold">{d.n}</h3>
                <p className="text-ink-2 mt-2.5 text-[13.5px] leading-[1.65]">{d.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Stack ---------------- */}
        <section className="mt-20">
          <div className="shiro">
            <span className="eyebrow">Stack</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-ink border-b">
                  {["Layer", "Choice", "Why"].map((h) => (
                    <th key={h} className="eyebrow pb-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STACK.map((r) => (
                  <tr key={r.layer} className="border-rule-2 border-b">
                    <td className="text-ink w-[110px] py-3 pr-4 align-top text-[13px] font-semibold">{r.layer}</td>
                    <td className="text-ink-2 w-[300px] py-3 pr-4 align-top font-mono text-[12px] leading-relaxed">
                      {r.choice}
                    </td>
                    <td className="text-ink-2 py-3 align-top text-[13px] leading-relaxed">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Tools ---------------- */}
        <section className="mt-20">
          <div className="shiro">
            <span className="eyebrow">The agent&rsquo;s tools</span>
            <p className="text-ink-2 mt-3 max-w-[70ch] text-[14px] leading-relaxed">
              Declared once and shared by both the browser client and the telephony bridge. The executor is pure — it
              touches no network — because a database round-trip inside a tool call is audible on a voice call as a
              stall. Persistence happens on a separate timer.
            </p>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_FUNCTION_DECLARATIONS.map((t) => (
              <div key={t.name} className="shiro shiro-soft">
                <code className="text-aqua font-mono text-[12.5px] font-semibold">{t.name}</code>
                <p className="text-ink-2 mt-2 text-[12.5px] leading-[1.6]">{t.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Challenges ---------------- */}
        <section className="mt-20">
          <div className="shiro">
            <span className="eyebrow">What went wrong on the way</span>
            <h2 className="font-display text-ink mt-3 text-[28px] leading-tight">
              Six problems that were not in any documentation.
            </h2>
          </div>
          <div className="mt-8 grid gap-x-12 gap-y-9 lg:grid-cols-2">
            {CHALLENGES.map((c) => (
              <div key={c.title} className="shiro shiro-soft">
                <h3 className="text-ink text-[14.5px] leading-snug font-semibold">{c.title}</h3>
                <p className="text-ink-2 mt-2.5 text-[13.5px] leading-[1.7]">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Limits + next ---------------- */}
        <section className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <div className="shiro">
              <span className="eyebrow">Known limitations</span>
            </div>
            <ul className="text-ink-2 mt-5 space-y-2.5 text-[13.5px] leading-relaxed">
              {[
                "Free-tier rate limits apply. Sustained concurrent calls will hit them.",
                "Site visits, WhatsApp messages and callbacks are recorded on the lead, not actually dispatched.",
                "Phone audio is 8 kHz μ-law, so telephony transcription is measurably worse than the browser demo.",
                "The catalogue is hand-written TypeScript. Adding a project means a code change, not a document upload.",
                "No authentication on the CRM — anyone with the URL can read the leads. Fine for a demo, not for real leads.",
                "Heavy accents and very noisy lines still degrade recognition; she asks the caller to repeat rather than guessing.",
                "Only the browser demo is deployed serverless; the phone bridge needs a long-lived process.",
              ].map((l) => (
                <li key={l} className="border-rule border-l-2 pl-3">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="shiro">
              <span className="eyebrow">Next version</span>
            </div>
            <ul className="text-ink-2 mt-5 space-y-2.5 text-[13.5px] leading-relaxed">
              {NEXT_VERSION.map((l) => (
                <li key={l} className="border-aqua/30 border-l-2 pl-3">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="border-rule mt-20 border-t pt-10 text-center">
          <Link
            href="/call"
            className="bg-ink text-paper hover:bg-aqua inline-flex min-h-12 items-center rounded-sm px-6 text-[14.5px] font-semibold transition-colors"
          >
            Try it yourself
          </Link>
        </div>
      </main>
    </div>
  );
}
