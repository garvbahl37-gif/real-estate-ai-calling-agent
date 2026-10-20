"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  ChevronDown,
  Download,
  Headphones,
  Keyboard,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  SendHorizontal,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { LeadPanel } from "@/components/LeadPanel";
import { Shirorekha } from "@/components/Shirorekha";
import { Transcript } from "@/components/Transcript";
import { BandPill, Card, Chip, Panel, PriyaAvatar, Ring, btn } from "@/components/ui";
import { DEFAULT_VOICE, VOICES } from "@/lib/agent-prompt";
import { DEFAULT_LIVE_MODEL } from "@/lib/models";
import { LiveCall, type CallState } from "@/lib/live-session";
import { cn } from "@/lib/cn";
import type { CallSummary, LeadRequirements, ToolInvocation, TranscriptTurn } from "@/lib/types";

type OpeningLanguage = "hindi" | "hinglish" | "english";

const LANGUAGES: { id: OpeningLanguage; label: string; sample: string }[] = [
  { id: "hinglish", label: "Hinglish", sample: "Namaste! Main Priya bol rahi hoon Aarambh Realty se." },
  { id: "hindi", label: "Hindi", sample: "नमस्ते! मैं प्रिया बोल रही हूँ, आरंभ रियल्टी से।" },
  { id: "english", label: "English", sample: "Hello! This is Priya calling from Aarambh Realty." },
];

const STATE_COPY: Record<CallState, { label: string; tone: string }> = {
  idle: { label: "Ready", tone: "bg-line-2 text-ink-3" },
  connecting: { label: "Connecting", tone: "bg-cream text-amber" },
  listening: { label: "Listening", tone: "bg-ice text-navy" },
  thinking: { label: "Thinking", tone: "bg-cream text-amber" },
  speaking: { label: "Priya is speaking", tone: "bg-cobalt text-white" },
  reconnecting: { label: "Reconnecting", tone: "bg-cream text-amber" },
  ended: { label: "Call ended", tone: "bg-line-2 text-ink-2" },
  error: { label: "Error", tone: "bg-rose-wash text-rose" },
};

const TRY_SAYING = [
  { t: "मुझे नोएडा में 3BHK चाहिए, budget डेढ़ करोड़ तक", s: "Hindi" },
  { t: "Investment ke liye dekh raha hoon, Sector 150 mein kya options hain?", s: "Hinglish" },
  { t: "What's the possession timeline and is it RERA registered?", s: "English" },
  { t: "Actually budget badha ke 2 crore kar dete hain", s: "Change mid-call" },
];

function clock(ms: number) {
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function CallConsole() {
  const callRef = useRef<LiveCall | null>(null);
  const startedAtRef = useRef<number>(0);
  // Audio levels update ~60x/sec. Held in a ref so the waveform canvas can read
  // them every frame without re-rendering this component.
  const levelsRef = useRef({ mic: 0, agent: 0 });

  const [callId, setCallId] = useState<string | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [requirements, setRequirements] = useState<LeadRequirements>({});
  const [toolCalls, setToolCalls] = useState<ToolInvocation[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [typed, setTyped] = useState("");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summarising, setSummarising] = useState(false);

  // Setup form
  const [voice, setVoice] = useState<string>(DEFAULT_VOICE);
  const [language, setLanguage] = useState<OpeningLanguage>("hinglish");
  const [customerName, setCustomerName] = useState("");
  const [scenario, setScenario] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const active =
    state === "listening" ||
    state === "speaking" ||
    state === "thinking" ||
    state === "connecting" ||
    state === "reconnecting";

  /* ---------------- timer ---------------- */
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(t);
  }, [active]);

  /* ---------------- persistence ---------------- */
  // Snapshot to the server on a timer rather than on every transcript delta —
  // deltas arrive several times a second and would swamp the API route.
  const latest = useRef({ turns, requirements, toolCalls });
  useEffect(() => {
    latest.current = { turns, requirements, toolCalls };
  }, [turns, requirements, toolCalls]);

  useEffect(() => {
    if (!active || !callId) return;
    const t = setInterval(() => {
      const id = callId;
      void fetch(`/api/calls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: latest.current.turns,
          requirements: latest.current.requirements,
          toolCalls: latest.current.toolCalls,
        }),
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [active, callId]);

  const finaliseCall = useCallback(async (id: string | null, call?: LiveCall | null) => {
    if (!id) return;
    setSummarising(true);
    try {
      const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      await fetch(`/api/calls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: latest.current.turns,
          requirements: latest.current.requirements,
          toolCalls: latest.current.toolCalls,
          telemetry: call?.getTelemetry(),
          handoff: call?.getHandoff(),
          status: "completed",
          endedAt: new Date().toISOString(),
          durationSec,
        }),
      });
      const res = await fetch(`/api/calls/${id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummarising(false);
    }
  }, []);

  /* ---------------- start / stop ---------------- */

  // A second click while the first is still connecting would build a second
  // LiveCall before the first exists to be torn down — two agents at once.
  const startingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Tear the previous call down first. Each click builds a new LiveCall, and
      // without this an older instance can still hold a socket and a player open,
      // so two agents talk at once.
      await callRef.current?.stop("restarted");
      callRef.current = null;

      setError(null);
      setSummary(null);
      setTurns([]);
      setRequirements({});
      setToolCalls([]);
      setLog([]);
      setElapsed(0);
      setRecordingUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      // The previous call's id must not linger: the 4 s snapshot timer would
      // write this call's transcript onto it until the new id arrives.
      setCallId(null);
      // Leave the setup screen on the click, not when the network answers.
      setState("connecting");
      startedAtRef.current = Date.now();

      // Register the call alongside connecting rather than before it: the row
      // still exists almost at once, so a crash mid-call still leaves one, but a
      // slow database (a cold Neon branch takes several seconds) no longer holds
      // the caller on the setup screen. The callbacks below wait on this promise
      // for the id instead of closing over a value that is not there yet.
      const registration: Promise<string | null> = fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "browser" }),
      })
        .then((res) => res.json())
        .then((data) => {
          const id: string | null = data.call?.id ?? null;
          setCallId(id);
          return id;
        })
        .catch(() => {
          setCallId(null);
          return null;
        });

      const call = new LiveCall({
        onState: setState,
        onTranscript: setTurns,
        onRequirements: setRequirements,
        onToolCall: (t) => setToolCalls((prev) => [...prev, t]),
        onLevel: (mic, agent) => {
          levelsRef.current.mic = mic;
          levelsRef.current.agent = agent;
        },
        onError: setError,
        onLog: (line) => setLog((prev) => [...prev.slice(-40), line]),
        onEnded: () => {
          const wav = call.getRecording();
          if (wav) setRecordingUrl(URL.createObjectURL(wav));
          void registration.then((id) => finaliseCall(id, call));
        },
      });
      callRef.current = call;
      await call.start({
        voice,
        model: DEFAULT_LIVE_MODEL,
        openingLanguage: language,
        customerName: customerName.trim() || undefined,
        scenarioOverride: scenario.trim() || undefined,
      });
    } finally {
      startingRef.current = false;
    }
  }, [voice, language, customerName, scenario, finaliseCall]);

  const stop = useCallback(() => {
    void callRef.current?.stop("user_hangup");
  }, []);

  useEffect(() => {
    return () => {
      void callRef.current?.stop("unmounted");
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    callRef.current?.setMuted(next);
  };

  /* ---------------- render ---------------- */

  const stateCopy = STATE_COPY[state];
  const showSetup = state === "idle";
  const showResult = (state === "ended" || state === "error") && turns.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="bg-rose-wash rounded-card flex gap-3 px-5 py-4 sm:px-8">
          <AlertCircle className="text-rose mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-rose text-[13.5px] font-semibold">{error}</p>
            <p className="text-ink-2 mt-1 text-[12.5px] leading-relaxed">
              If this mentions a missing key, add <code className="font-mono">GEMINI_API_KEY</code> to{" "}
              <code className="font-mono">.env.local</code> and restart. Microphone errors usually mean the browser
              blocked mic access — check the padlock icon in the address bar.
            </p>
          </div>
        </div>
      ) : null}

      {/* --- Pre-call setup ------------------------------------------ */}
      {showSetup ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="flex flex-col px-5 py-10 sm:px-10 sm:py-14">
            <div>
              <Chip icon={<Mic className="h-3.5 w-3.5" />}>Browser voice demo</Chip>
            </div>
            <h1 className="text-ink mt-6 max-w-[17ch] text-[38px] leading-[1.06] font-medium tracking-[-0.035em] sm:text-[52px]">
              Press call. Speak <span className="highlight">Hindi</span>. Watch the lead fill itself in.
            </h1>
            <p className="text-ink-2 mt-5 max-w-[54ch] text-[15.5px] leading-[1.65]">
              Priya is a sales executive for a fictional Delhi-NCR developer. She opens the call, works out what you
              want, pitches the project that actually fits, and writes the qualified lead into the CRM while you talk.
              Interrupt her whenever you like — she stops mid-word.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={start} className={btn("primary", "lg")}>
                <PhoneCall className="h-4 w-4" aria-hidden />
                Start the call
              </button>
              <span className="text-ink-3 flex items-center gap-1.5 text-[12px]">
                <Headphones className="h-3.5 w-3.5" aria-hidden />
                Mic required · headphones help
              </span>
            </div>
            <p className="text-ink-3 mt-3 text-[12px]">
              Works in Chrome, Edge and Safari. Headphones keep Priya from hearing herself.
            </p>

            <div className="wash mt-10 rounded-[22px] p-5 sm:p-6">
              <p className="text-ink text-[14px] font-semibold">Try saying</p>
              <ul className="mt-4 space-y-2.5">
                {TRY_SAYING.map((x, i) => (
                  <li key={x.t} className={cn("flex items-center gap-2", i % 2 && "flex-row-reverse")}>
                    <span
                      className={cn(
                        "max-w-[80%] rounded-[16px] px-3.5 py-2 text-[14px] leading-snug",
                        i % 2 ? "text-ink rounded-br-[6px] bg-white" : "bg-cobalt rounded-bl-[6px] text-white",
                      )}
                    >
                      {x.t}
                    </span>
                    <span className="text-ink-3 shrink-0 text-[11px] font-medium">{x.s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Call setup */}
          <Card as="aside" className="flex flex-col p-5 sm:p-7">
            <p className="text-ink text-[18px] font-semibold tracking-[-0.015em]">Call setup</p>
            <p className="text-ink-3 mt-1 text-[12.5px]">Applies to this call only.</p>

            <div className="mt-6">
              <span className="text-ink-2 mb-2 block text-[12.5px] font-semibold">Opening language</span>
              <div className="bg-frost grid grid-cols-3 gap-1 rounded-full p-1" role="group" aria-label="Opening language">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    aria-pressed={language === l.id}
                    className={cn(
                      "min-h-10 rounded-full text-[13px] font-semibold transition-colors",
                      language === l.id ? "text-cobalt bg-white shadow-[0_4px_12px_-6px_rgb(19_40_110/0.35)]" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="text-ink-3 mt-2 text-[11.5px] leading-relaxed">
                Only sets the greeting. She switches to whatever you speak.
              </p>
            </div>

            <div className="bg-frost mt-3 flex items-start gap-2.5 rounded-[18px] p-3">
              <PriyaAvatar size={28} />
              <p className="text-ink rounded-[14px] rounded-tl-[5px] bg-white px-3 py-2 text-[13.5px] leading-relaxed">
                {LANGUAGES.find((l) => l.id === language)?.sample}
              </p>
            </div>

            <label className="mt-6 block">
              <span className="text-ink-2 mb-2 block text-[12.5px] font-semibold">Voice</span>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="border-line bg-frost text-ink focus:border-cobalt min-h-11 w-full rounded-[14px] border px-3 text-[13px] outline-none"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.description}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => setShowAdvanced((s) => !s)}
              aria-expanded={showAdvanced}
              className="text-cobalt hover:text-cobalt-deep mt-5 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {showAdvanced ? "Hide flow changes" : "Change the flow"}
            </button>

            {showAdvanced ? (
              <div className="rise-in mt-3 space-y-4">
                <label className="block">
                  <span className="text-ink-2 mb-2 block text-[12.5px] font-semibold">Caller&rsquo;s name</span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Leave blank and she'll ask for it"
                    className="border-line bg-frost text-ink placeholder:text-ink-3/70 focus:border-cobalt w-full rounded-[14px] border px-3 py-2.5 text-[13px] outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-ink-2 mb-2 block text-[12.5px] font-semibold">Extra instructions</span>
                  <textarea
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    rows={4}
                    placeholder={'e.g. "Ask about parking before budget." or "The caller is an NRI in Dubai."'}
                    className="border-line bg-frost text-ink placeholder:text-ink-3/70 focus:border-cobalt w-full resize-y rounded-[14px] border px-3 py-2.5 text-[13px] leading-relaxed outline-none"
                  />
                  <span className="text-ink-3 mt-1.5 block text-[11.5px] leading-relaxed">
                    Appended to her system prompt for this call only. Useful for changing the conversation flow live.
                  </span>
                </label>
              </div>
            ) : null}

            <div className="mt-auto pt-6">
            <ol className="wash space-y-3 rounded-[18px] p-4 text-[12.5px]">
              {[
                "Allow the microphone when the browser asks",
                "Priya opens the call — answer her like a buyer",
                "Interrupt, change your budget, switch language",
                "The lead record fills in on the right as you talk",
              ].map((s, i) => (
                <li key={s} className="text-ink-2 flex items-start gap-2.5 leading-snug">
                  <span className="bg-cobalt tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            </div>
          </Card>
        </div>
      ) : null}

      {/* --- Live call ------------------------------------------------ */}
      {!showSetup ? (
        <>
          {/* Call bar: who, state, clock, the live waveform, and the controls. */}
          <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <PriyaAvatar size={44} className={cn(active && "live-ring")} />
              <div>
                <p className="text-ink text-[14.5px] font-semibold">Priya · Aarambh Realty</p>
                <div className="mt-1 flex items-center gap-2">
                  {/* Screen readers get call-state changes announced without the
                      transcript itself firing on every streamed token. */}
                  <span
                    role="status"
                    aria-live="polite"
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", stateCopy.tone)}
                  >
                    {active ? <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
                    {stateCopy.label}
                  </span>
                  {active || elapsed > 0 ? (
                    <span className="text-ink tnum font-mono text-[13px] font-semibold">{clock(elapsed)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="order-last min-w-[200px] flex-1 basis-full sm:order-none sm:basis-auto">
              <Shirorekha levelsRef={levelsRef} active={active} height={44} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {active ? (
                <>
                  <button
                    onClick={toggleMute}
                    aria-pressed={muted}
                    aria-label={muted ? "Unmute your microphone" : "Mute your microphone"}
                    className={cn(btn(muted ? "outline" : "soft", "md"), muted && "border-rose text-rose")}
                  >
                    {muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={stop} aria-label="End the call" className={btn("danger", "md")}>
                    <PhoneOff className="h-4 w-4" aria-hidden />
                    End call
                  </button>
                </>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="flex min-h-[520px] flex-col p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-3">
                <Chip icon={<AudioLines className="h-3.5 w-3.5" />}>Live transcript</Chip>
                <span className="text-ink-3 tnum text-[12px]">{turns.length} turns</span>
              </div>
              <Panel className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                <Transcript
                  turns={turns}
                  toolCalls={toolCalls}
                  thinking={state === "connecting"}
                  emptyHint="Priya will open the call in a moment. Speak whenever you're ready — you can talk over her."
                  className="max-h-[min(58vh,620px)] flex-1 pr-1"
                />

                {active ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = typed.trim();
                      if (!text) return;
                      callRef.current?.sendText(text);
                      setTyped("");
                    }}
                    className="mt-3 flex shrink-0 items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-[0_6px_18px_-12px_rgb(19_40_110/0.4)]"
                  >
                    <Keyboard className="text-ink-3 h-4 w-4 shrink-0" aria-hidden />
                    <input
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="…or type instead of speaking"
                      aria-label="Type a message to Priya instead of speaking"
                      className="text-ink placeholder:text-ink-3/70 min-h-10 min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
                    />
                    <button type="submit" disabled={!typed.trim()} className={btn("primary", "sm")}>
                      <SendHorizontal className="h-3.5 w-3.5" aria-hidden />
                      Send
                    </button>
                  </form>
                ) : null}
              </Panel>

              {state === "ended" || state === "error" ? (
                <div className="flex flex-wrap gap-2.5 px-1 pt-4">
                  <button onClick={start} className={btn("primary")}>
                    <PhoneCall className="h-4 w-4" aria-hidden />
                    Start a fresh call
                  </button>
                  {recordingUrl ? (
                    <a href={recordingUrl} download={`priya-call-${callId ?? "recording"}.wav`} className={btn("soft")}>
                      <Download className="h-4 w-4" aria-hidden />
                      Download recording (.wav)
                    </a>
                  ) : null}
                  {callId ? (
                    <Link href={`/leads/${callId}`} className={btn("outline")}>
                      Open the lead record <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <Card as="aside" className="flex min-h-0 flex-col p-5 sm:p-6">
              <LeadPanel requirements={requirements} toolCalls={toolCalls} className="max-h-[min(78vh,820px)]" />
            </Card>
          </div>
        </>
      ) : null}

      {/* --- Post-call summary --------------------------------------- */}
      {showResult ? (
        <Card className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between gap-3">
            <Chip icon={<Sparkles className="h-3.5 w-3.5" />}>
              <span className="tracking-[0.08em] uppercase">Call summary</span>
            </Chip>
            {summarising ? <span className="text-amber text-[12px] font-semibold">Generating…</span> : null}
          </div>

          {summary ? (
            <div className="rise-in mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <h2 className="text-ink text-[26px] leading-snug font-medium tracking-[-0.025em] sm:text-[30px]">
                  {summary.headline}
                </h2>
                <p className="text-ink-2 mt-4 max-w-[68ch] text-[14.5px] leading-[1.75]">{summary.summary}</p>

                {summary.objections.length ? (
                  <div className="mt-6">
                    <p className="text-ink text-[13.5px] font-semibold">Objections raised</p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {summary.objections.map((o, i) => (
                        <li key={i} className="bg-frost text-ink-2 rounded-[14px] px-3.5 py-2 text-[13px] leading-snug">
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="bg-cobalt mt-6 rounded-[20px] px-5 py-4 text-white">
                  <p className="text-[12px] font-semibold text-white/75">Next action</p>
                  <p className="mt-1 text-[15px] leading-relaxed font-medium">{summary.nextAction}</p>
                </div>

                {summary.agentNotes ? (
                  <p className="text-ink-3 mt-4 text-[13px] leading-relaxed italic">{summary.agentNotes}</p>
                ) : null}
              </div>

              <Panel className="p-5">
                <p className="text-ink text-[13.5px] font-semibold">Qualification</p>
                <div className="mt-4 flex items-center gap-4">
                  <Ring value={summary.qualification.score} size={92} stroke={10} track="var(--color-pale)">
                    <span className="text-ink tnum text-[26px] leading-none font-semibold">{summary.qualification.score}</span>
                    <span className="text-ink-3 text-[10px]">/ 100</span>
                  </Ring>
                  <BandPill band={summary.qualification.band} />
                </div>
                <p className="text-ink-2 mt-4 text-[13px] leading-relaxed">{summary.qualification.reasoning}</p>

                {summary.languagesUsed.length ? (
                  <div className="mt-5">
                    <p className="label">Languages</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {summary.languagesUsed.map((l) => (
                        <span key={l} className="text-navy rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Panel>
            </div>
          ) : summarising ? (
            <p className="text-ink-3 mt-5 text-[13.5px]">Reading the transcript and scoring the lead…</p>
          ) : (
            <p className="text-ink-3 mt-5 text-[13.5px]">No summary was generated for this call.</p>
          )}
        </Card>
      ) : null}

      {/* --- Connection log ------------------------------------------ */}
      {log.length > 0 && !showSetup ? (
        <Card as="div" className="px-5 py-4 sm:px-8">
          <details className="group">
            <summary className="text-ink-2 flex min-h-9 cursor-pointer items-center gap-2 text-[13px] font-semibold select-none">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              Connection log ({log.length})
            </summary>
            <pre className="text-ink-3 thin-scroll bg-frost mt-3 max-h-52 overflow-auto rounded-[14px] p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {log.join("\n")}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
