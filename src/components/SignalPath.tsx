import { cn } from "@/lib/cn";

/**
 * The signal path, as a diagram rather than an ASCII block.
 *
 * The original version was a <pre> of box-drawing characters. It read well in a
 * terminal and badly on a phone — 90 columns wide, no reflow, and unreadable
 * below a laptop. This says the same thing in three stages that stack.
 *
 * The two transports are shown side by side because the point of the
 * architecture is that they converge: identical prompt, identical tools,
 * identical executor, different plumbing.
 */

function Node({
  title,
  detail,
  tone = "plain",
}: {
  title: string;
  detail?: string;
  tone?: "plain" | "aqua" | "magenta" | "solid";
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] px-4 py-3",
        tone === "solid" && "bg-cobalt text-white shadow-cta",
        tone === "aqua" && "bg-pale",
        tone === "magenta" && "bg-mid/60",
        tone === "plain" && "border-line border bg-white",
      )}
    >
      <p className={cn("text-[13px] leading-snug font-semibold", tone === "solid" ? "text-white" : "text-ink")}>{title}</p>
      {detail ? (
        <p className={cn("mt-0.5 font-mono text-[10.5px] leading-snug", tone === "solid" ? "text-white/75" : "text-navy/70")}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function StageLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="text-ink flex items-center gap-2.5 text-[15px] font-semibold">
      <span className="bg-cobalt tnum flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white">{n}</span>
      {children}
    </p>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-2 pl-4">
      <span className="border-cobalt/40 h-5 border-l-2 border-dashed" />
      {label ? <span className="text-ink-3 font-mono text-[10px]">{label}</span> : null}
    </div>
  );
}

export function SignalPath() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* --- Stage 1: the two transports --- */}
      <div className="bg-frost rounded-panel p-5">
        <StageLabel n={1}>Capture</StageLabel>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <p className="text-ink-3 mb-2 text-[11.5px] font-semibold">Browser</p>
            <Node title="Microphone" detail="getUserMedia · echo cancellation" />
            <Arrow />
            <Node title="AudioWorklet · pcm-recorder" detail="Float32 → Int16 · 16 kHz · 128 ms" tone="aqua" />
          </div>
          <div>
            <p className="text-ink-3 mb-2 text-[11.5px] font-semibold">Phone</p>
            <Node title="Caller dials Twilio number" detail="TwiML <Connect><Stream>" />
            <Arrow />
            <Node title="Node WebSocket bridge" detail="8 kHz μ-law → PCM 16 kHz" tone="aqua" />
          </div>
        </div>
      </div>

      {/* --- Stage 2: the model --- */}
      <div className="bg-frost rounded-panel p-5">
        <StageLabel n={2}>Converse</StageLabel>
        <div className="mt-4">
          <Node title="Gemini Live API" detail="native audio · speech-to-speech · WebSocket" tone="solid" />
          <p className="text-ink-2 mt-3 text-[12.5px] leading-relaxed">
            One socket carries audio both ways, plus transcripts and tool calls. No ASR → LLM → TTS chain, so
            interruption is immediate and prosody survives.
          </p>
          <Arrow label="toolCall" />
          <Node title="executeAgentTool()" detail="pure · no network · ~0 ms" tone="magenta" />
          <ul className="text-ink-2 mt-3 space-y-1 font-mono text-[11px]">
            {[
              "update_lead_requirements",
              "search_projects",
              "get_project_details",
              "schedule_site_visit",
              "end_call",
            ].map((t) => (
              <li key={t} className="text-ink-3">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* --- Stage 3: outputs --- */}
      <div className="bg-frost rounded-panel p-5">
        <StageLabel n={3}>Capture the lead</StageLabel>
        <div className="mt-4">
          <Node title="AudioWorklet · pcm-player" detail="24 kHz queue · instant flush on barge-in" tone="aqua" />
          <Arrow label="requirements patch" />
          <Node title="Live CRM panel" detail="fills in while she is still talking" />
          <Arrow label="PATCH /api/calls/:id · every 4 s" />
          <Node title="Postgres" detail="Neon · transcript, tools, requirements" />
          <Arrow label="on hang-up" />
          <Node title="Gemini 3.5 Flash" detail="responseSchema · summary + score" tone="magenta" />
        </div>
      </div>
    </div>
  );
}
