"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LeadPanel } from "@/components/LeadPanel";
import { Shirorekha } from "@/components/Shirorekha";
import { Transcript } from "@/components/Transcript";
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
  idle: { label: "Ready", tone: "text-ink-3" },
  connecting: { label: "Connecting", tone: "text-amber" },
  listening: { label: "Listening", tone: "text-magenta" },
  thinking: { label: "Thinking", tone: "text-amber" },
  speaking: { label: "Priya is speaking", tone: "text-aqua" },
  reconnecting: { label: "Reconnecting", tone: "text-amber" },
  ended: { label: "Call ended", tone: "text-ink-3" },
  error: { label: "Error", tone: "text-magenta" },
};

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

  const start = useCallback(async () => {
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
    startedAtRef.current = Date.now();

    // Register the call before connecting so a crash mid-call still leaves a
    // row. The id is captured in a local as well as state because the LiveCall
    // callbacks below close over this render's scope.
    let newCallId: string | null = null;
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "browser" }),
      });
      const data = await res.json();
      newCallId = data.call?.id ?? null;
      setCallId(newCallId);
    } catch {
      setCallId(null);
    }

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
        void finaliseCall(newCallId, call);
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
    <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
      {/* --- Live rule: the signature element -------------------------
          Only rendered once a call exists. Idle it was a bare rule with empty
          space above and below, which reads as a stray line rather than as the
          instrument it becomes. */}
      {state !== "idle" ? (
        <div className="pt-6">
          <Shirorekha levelsRef={levelsRef} active={active} height={64} />
        </div>
      ) : (
        <div className="pt-10" />
      )}

      {/* --- Status bar ---------------------------------------------- */}
      <div className="border-rule flex flex-wrap items-center gap-x-5 gap-y-2 border-b pt-1 pb-3">
        <div className="flex items-center gap-2">
          {active ? <span className="bg-magenta live-dot h-2 w-2 rounded-full" aria-hidden /> : null}
          {/* Screen readers get call-state changes announced without the
              transcript itself firing on every streamed token. */}
          <span
            role="status"
            aria-live="polite"
            className={cn("font-mono text-[11px] font-semibold tracking-[0.1em] uppercase", stateCopy.tone)}
          >
            {stateCopy.label}
          </span>
        </div>

        {(active || elapsed > 0) && (
          <span className="text-ink tnum font-mono text-[13px] font-semibold">{clock(elapsed)}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {active ? (
            <>
              <button
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? "Unmute your microphone" : "Mute your microphone"}
                className={cn(
                  "border-rule hover:border-ink min-h-11 rounded-sm border px-4 font-mono text-[11px] font-semibold tracking-wide uppercase transition-colors",
                  muted ? "bg-magenta-wash text-magenta border-magenta/40" : "text-ink-2",
                )}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={stop}
                aria-label="End the call"
                className="bg-magenta text-paper min-h-11 rounded-sm px-5 font-mono text-[11px] font-semibold tracking-wide uppercase transition-opacity hover:opacity-85"
              >
                End call
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border-magenta/30 bg-magenta-wash mt-4 rounded-sm border px-4 py-3">
          <p className="text-magenta text-[13px] font-semibold">{error}</p>
          <p className="text-ink-2 mt-1 text-[12.5px] leading-relaxed">
            If this mentions a missing key, add <code className="font-mono">GEMINI_API_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> and restart. Microphone errors usually mean the browser
            blocked mic access — check the padlock icon in the address bar.
          </p>
        </div>
      ) : null}

      {/* --- Pre-call setup ------------------------------------------ */}
      {showSetup ? (
        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <div>
            <p className="eyebrow">Browser voice demo</p>
            <h1 className="font-display text-ink mt-3 text-[38px] leading-[1.12] sm:text-[46px]">
              Press call. Speak Hindi.
              <br />
              Watch the lead fill itself in.
            </h1>
            <p className="text-ink-2 mt-5 max-w-[54ch] text-[15px] leading-[1.7]">
              Priya is a sales executive for a fictional Delhi-NCR developer. She opens the call, works out what you
              want, pitches the project that actually fits, and writes the qualified lead into the CRM while you talk.
              Interrupt her whenever you like — she stops mid-word.
            </p>

            <button
              onClick={start}
              className="group bg-ink text-paper hover:bg-aqua mt-8 inline-flex items-center gap-3 rounded-sm px-6 py-3.5 text-[15px] font-semibold transition-colors"
            >
              <span className="bg-paper/25 flex h-6 w-6 items-center justify-center rounded-full">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .7-.2 1l-2.3 2.2z" />
                </svg>
              </span>
              Start the call
              <span className="text-paper/50 font-mono text-[11px] tracking-wide">MIC REQUIRED</span>
            </button>

            <p className="text-ink-3 mt-3 text-[12px]">
              Works in Chrome, Edge and Safari. Use headphones if you can — it keeps Priya from hearing herself.
            </p>

            <div className="shiro shiro-soft mt-12">
              <p className="eyebrow">Try saying</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  { t: "मुझे नोएडा में 3BHK चाहिए, budget डेढ़ करोड़ तक", s: "Hindi" },
                  { t: "Investment ke liye dekh raha hoon, Sector 150 mein kya options hain?", s: "Hinglish" },
                  { t: "What's the possession timeline and is it RERA registered?", s: "English" },
                  { t: "Actually budget badha ke 2 crore kar dete hain", s: "Change mid-call" },
                ].map((x) => (
                  <li key={x.t} className="flex items-baseline gap-3">
                    <span className="border-rule text-ink-3 shrink-0 rounded-full border px-1.5 py-px font-mono text-[9px] tracking-wide">
                      {x.s}
                    </span>
                    <span className="font-display text-ink-2 text-[15px] leading-relaxed">{x.t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Call setup */}
          <div className="lg:border-rule lg:border-l lg:pl-10">
            <div className="shiro">
              <p className="eyebrow">Call setup</p>
            </div>

            <label className="mt-5 block">
              <span className="text-ink-2 mb-1.5 block text-[12px] font-semibold">Opening language</span>
              <div className="border-rule grid grid-cols-3 overflow-hidden rounded-sm border">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLanguage(l.id)}
                    className={cn(
                      "border-rule min-h-11 text-[12px] font-semibold transition-colors not-last:border-r",
                      language === l.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="text-ink-3 mt-2 text-[11.5px] leading-relaxed">
                Only sets the greeting. She switches to whatever you speak.
              </p>
            </label>

            <div className="bg-paper-2 mt-3 rounded-sm px-3 py-2.5">
              <p className="font-display text-ink-2 text-[14px] leading-relaxed">
                {LANGUAGES.find((l) => l.id === language)?.sample}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-ink-2 mb-1.5 block text-[12px] font-semibold">Voice</span>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="border-rule bg-paper text-ink focus:border-ink min-h-11 w-full rounded-sm border px-3 text-[13px] outline-none"
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
              className="text-ink-3 hover:text-ink mt-5 inline-flex min-h-9 items-center font-mono text-[11px] tracking-[0.08em] uppercase transition-colors"
            >
              {showAdvanced ? "− " : "+ "}Change the flow
            </button>

            {showAdvanced ? (
              <div className="rise-in mt-3 space-y-4">
                <label className="block">
                  <span className="text-ink-2 mb-1.5 block text-[12px] font-semibold">Caller&rsquo;s name</span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Leave blank and she'll ask for it"
                    className="border-rule bg-paper text-ink placeholder:text-ink-3/60 focus:border-ink w-full rounded-sm border px-3 py-2 text-[13px] outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-ink-2 mb-1.5 block text-[12px] font-semibold">Extra instructions</span>
                  <textarea
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    rows={4}
                    placeholder={'e.g. "Ask about parking before budget." or "The caller is an NRI in Dubai."'}
                    className="border-rule bg-paper text-ink placeholder:text-ink-3/60 focus:border-ink w-full resize-y rounded-sm border px-3 py-2 text-[13px] leading-relaxed outline-none"
                  />
                  <span className="text-ink-3 mt-1.5 block text-[11.5px] leading-relaxed">
                    Appended to her system prompt for this call only. Useful for changing the conversation flow live.
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* --- Live call ------------------------------------------------ */}
      {!showSetup ? (
        <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="flex min-h-[420px] flex-col">
            <div className="shiro shrink-0">
              <span className="eyebrow">Transcript</span>
            </div>
            <Transcript
              turns={turns}
              thinking={state === "connecting"}
              emptyHint="Priya will open the call in a moment. Speak whenever you're ready — you can talk over her."
              className="mt-3 max-h-[min(58vh,620px)] flex-1 pr-2"
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
                className="border-rule mt-4 flex shrink-0 items-center gap-2 border-t pt-4"
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="…or type instead of speaking"
                  aria-label="Type a message to Priya instead of speaking"
                  className="border-rule bg-paper text-ink placeholder:text-ink-3/60 focus:border-ink min-h-11 flex-1 rounded-sm border px-3 text-[13px] outline-none"
                />
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="bg-ink text-paper hover:bg-aqua min-h-11 rounded-sm px-4 text-[13px] font-semibold transition-colors disabled:opacity-35"
                >
                  Send
                </button>
              </form>
            ) : null}

            {state === "ended" || state === "error" ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={start}
                  className="bg-ink text-paper hover:bg-aqua rounded-sm px-5 py-2.5 text-[13px] font-semibold transition-colors"
                >
                  Start a fresh call
                </button>
                {recordingUrl ? (
                  <a
                    href={recordingUrl}
                    download={`priya-call-${callId ?? "recording"}.wav`}
                    className="border-aqua text-aqua hover:bg-aqua hover:text-paper rounded-sm border px-5 py-2.5 text-[13px] font-semibold transition-colors"
                  >
                    Download recording (.wav)
                  </a>
                ) : null}
                {callId ? (
                  <Link
                    href={`/leads/${callId}`}
                    className="border-rule text-ink hover:border-ink rounded-sm border px-5 py-2.5 text-[13px] font-semibold transition-colors"
                  >
                    Open the lead record
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="lg:border-rule flex min-h-0 flex-col lg:border-l lg:pl-10">
            <LeadPanel requirements={requirements} toolCalls={toolCalls} className="max-h-[min(70vh,760px)]" />
          </div>
        </div>
      ) : null}

      {/* --- Post-call summary --------------------------------------- */}
      {showResult ? (
        <div className="border-rule border-t py-10">
          <div className="shiro">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Call summary</span>
              {summarising ? <span className="text-amber font-mono text-[10px]">Generating…</span> : null}
            </div>
          </div>

          {summary ? (
            <div className="rise-in mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <h2 className="font-display text-ink text-[26px] leading-snug">{summary.headline}</h2>
                <p className="text-ink-2 mt-4 max-w-[68ch] text-[14.5px] leading-[1.75]">{summary.summary}</p>

                {summary.objections.length ? (
                  <div className="mt-6">
                    <span className="eyebrow">Objections raised</span>
                    <ul className="mt-2 space-y-1.5">
                      {summary.objections.map((o, i) => (
                        <li key={i} className="text-ink-2 border-magenta/30 border-l-2 pl-3 text-[13.5px] leading-relaxed">
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="bg-aqua-wash mt-6 rounded-sm px-4 py-3">
                  <span className="eyebrow">Next action</span>
                  <p className="text-ink mt-1 text-[14px] font-medium leading-relaxed">{summary.nextAction}</p>
                </div>

                {summary.agentNotes ? (
                  <p className="text-ink-3 mt-4 text-[13px] leading-relaxed italic">{summary.agentNotes}</p>
                ) : null}
              </div>

              <div className="lg:border-rule lg:border-l lg:pl-8">
                <div className="shiro shiro-soft">
                  <span className="eyebrow">Qualification</span>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-display text-ink tnum text-[46px] leading-none">
                    {summary.qualification.score}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.1em] uppercase",
                      summary.qualification.band === "hot"
                        ? "bg-magenta text-paper"
                        : summary.qualification.band === "warm"
                          ? "bg-amber-wash text-amber"
                          : "bg-paper-2 text-ink-3",
                    )}
                  >
                    {summary.qualification.band}
                  </span>
                </div>
                <p className="text-ink-2 mt-3 text-[13px] leading-relaxed">{summary.qualification.reasoning}</p>

                {summary.languagesUsed.length ? (
                  <div className="mt-5">
                    <span className="eyebrow">Languages</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {summary.languagesUsed.map((l) => (
                        <span key={l} className="border-rule text-ink-2 rounded-full border px-2 py-0.5 text-[11px]">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : summarising ? (
            <p className="text-ink-3 mt-4 text-[13px]">Reading the transcript and scoring the lead…</p>
          ) : (
            <p className="text-ink-3 mt-4 text-[13px]">No summary was generated for this call.</p>
          )}
        </div>
      ) : null}

      {/* --- Connection log ------------------------------------------ */}
      {log.length > 0 && !showSetup ? (
        <details className="border-rule border-t py-4">
          <summary className="eyebrow cursor-pointer select-none">Connection log ({log.length})</summary>
          <pre className="text-ink-3 thin-scroll mt-3 max-h-52 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {log.join("\n")}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
