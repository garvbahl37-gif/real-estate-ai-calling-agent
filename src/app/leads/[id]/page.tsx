import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AudioLines, Lightbulb, PhoneCall, Sparkles, Wrench } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RetrySummary } from "@/components/RetrySummary";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Transcript } from "@/components/Transcript";
import { Avatar, BandPill, Card, Chip, Meter, Panel, Ring, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { leadFields, realSummary, summaryFailed, summaryFailureReason } from "@/lib/lead-fields";
import { redactCall } from "@/lib/redact";
import { getCall } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Same window as the CRM list: an in-progress row older than this crashed rather than is still talking. */
const LIVE_WINDOW_MS = 30 * 60 * 1000;

/** Read once per request — this page is force-dynamic, so "now" is the request time. */
function isLive(call: { status: string; startedAt: string }) {
  return call.status === "in_progress" && Date.now() - Date.parse(call.startedAt) < LIVE_WINDOW_MS;
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getCall(id);
  if (!stored) notFound();

  // This page is public, and the transcript is where a caller reads their own
  // number out loud — masking the phone field alone leaves it sitting in the
  // conversation two lines below. Redact once, here, so every section on the
  // page renders from data that is already safe.
  const call = redactCall(stored);

  const req = call.summary?.requirements ?? call.requirements;
  // A failed summarisation stores a placeholder scored 0 / cold. Treat it as no
  // summary — and offer to try again — rather than as a real cold lead.
  const s = realSummary(call.summary);
  const failed = summaryFailed(call.summary);
  const failure = summaryFailureReason(call.summary);
  const started = new Date(call.startedAt);
  const live = isLive(call);
  const fields = leadFields(req);
  const filled = fields.filter((f) => f.value).length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/leads" />
      {live ? <AutoRefresh /> : null}

      {/* ---------------- Who ---------------- */}
      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <Link href="/leads" className="text-ink-3 hover:text-ink inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All leads
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-5">
          <Avatar name={req.name} size={68} />
          <div className="min-w-0 flex-1">
            <h1 className="text-ink text-[30px] leading-tight font-medium tracking-[-0.03em] sm:text-[38px]">
              {req.name || "Unidentified caller"}
            </h1>
            <p className="text-ink-3 mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px]">
              <span className="tnum font-mono">{req.phone || call.fromNumber || "no number captured"}</span>
              <span aria-hidden>·</span>
              <span className="capitalize">{call.channel} call</span>
              <span aria-hidden>·</span>
              <span>
                {started.toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
              {call.durationSec != null ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="tnum font-mono">
                    {String(Math.floor(call.durationSec / 60)).padStart(2, "0")}:{String(call.durationSec % 60).padStart(2, "0")}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          {s ? (
            <div className="flex items-center gap-4">
              <Ring value={s.qualification.score} size={84} stroke={9} track="var(--color-pale)">
                <span className="text-ink tnum text-[22px] leading-none font-semibold">{s.qualification.score}</span>
                <span className="text-ink-3 text-[9.5px]">/ 100</span>
              </Ring>
              <div>
                <BandPill band={s.qualification.band} />
                <p className="text-ink-3 mt-1.5 text-[11.5px]">Qualification</p>
              </div>
            </div>
          ) : null}
        </div>

        {live ? (
          <div className="bg-ice mt-6 flex flex-wrap items-center gap-3 rounded-[18px] px-4 py-3">
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="eq-bar bg-cobalt h-3.5 w-[3px] rounded-full" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            <p className="text-navy flex-1 text-[13.5px] font-semibold">
              Priya is on this call — the transcript below follows it every few seconds.
            </p>
          </div>
        ) : null}
      </Card>

      {/* ---------------- Summary ---------------- */}
      {s ? (
        <Card className="px-5 py-8 sm:px-8 sm:py-10">
          <Chip icon={<Sparkles className="h-3.5 w-3.5" />}>Call summary</Chip>
          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <h2 className="text-ink text-[24px] leading-snug font-medium tracking-[-0.025em] sm:text-[28px]">{s.headline}</h2>
              <p className="text-ink-2 mt-4 max-w-[70ch] text-[14.5px] leading-[1.75]">{s.summary}</p>

              <div className="bg-cobalt mt-6 rounded-[20px] px-5 py-4 text-white">
                <p className="text-[12px] font-semibold text-white/75">Next action</p>
                <p className="mt-1 text-[15px] leading-relaxed font-medium">{s.nextAction}</p>
              </div>

              {s.objections.length ? (
                <div className="mt-7">
                  <p className="text-ink text-[13.5px] font-semibold">Objections raised</p>
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {s.objections.map((o, i) => (
                      <li key={i} className="bg-frost text-ink-2 rounded-[14px] px-3.5 py-2 text-[13px] leading-snug">
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {s.agentNotes ? (
                <div className="bg-cream mt-6 flex gap-3 rounded-[18px] px-4 py-3.5">
                  <Lightbulb className="text-amber mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div>
                    <p className="text-amber text-[12px] font-semibold">Agent notes</p>
                    <p className="text-ink-2 mt-0.5 text-[13.5px] leading-relaxed">{s.agentNotes}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <Panel className="p-5">
              <p className="text-ink text-[13.5px] font-semibold">Why this score</p>
              <p className="text-ink-2 mt-2 text-[13px] leading-relaxed">{s.qualification.reasoning}</p>
              {s.languagesUsed.length ? (
                <div className="mt-5">
                  <p className="label">Languages spoken</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.languagesUsed.map((l) => (
                      <span key={l} className="text-navy rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>
          </div>
        </Card>
      ) : failed ? (
        <Card className="px-5 py-7 sm:px-8">
          <Chip icon={<Sparkles className="h-3.5 w-3.5" />}>Call summary</Chip>
          <h2 className="text-ink mt-4 text-[22px] leading-snug font-medium tracking-[-0.02em]">
            The summary could not be generated
          </h2>
          <p className="text-ink-2 mt-2 max-w-[68ch] text-[14px] leading-relaxed">
            {failure ?? "The summariser returned an error."} The transcript and everything Priya captured during the call
            are saved and shown below — only the written summary and the score are missing.
          </p>
          <RetrySummary callId={call.id} className="mt-5" />
        </Card>
      ) : (
        <Card className="text-ink-3 px-5 py-6 text-[13.5px] sm:px-8">
          {live
            ? "This call is still in progress. The summary is generated when it ends."
            : call.status === "in_progress"
              ? "This call never finished, so no summary was generated."
              : "No summary was generated for this call."}
          {!live && call.transcript.length ? <RetrySummary callId={call.id} className="mt-4" /> : null}
        </Card>
      )}

      {/* ---------------- Requirements + transcript ---------------- */}
      <div className="grid gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card as="aside" className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-ink text-[16px] font-semibold tracking-[-0.01em]">Captured requirements</p>
            <span className="text-ink-3 tnum text-[12px]">
              <span className="text-ink font-semibold">{filled}</span>/{fields.length}
            </span>
          </div>
          <Meter value={filled} max={fields.length} className="mt-2.5" />

          <dl className="bg-frost mt-4 rounded-[18px] p-1.5">
            {fields.map((f) => (
              <div
                key={f.key}
                className={cn("grid grid-cols-[112px_1fr] items-baseline gap-2 rounded-[12px] px-3 py-2", f.value && "bg-white")}
              >
                <dt className="text-ink-3 text-[12px]">{f.label}</dt>
                <dd className={cn("text-right text-[13px] leading-snug", f.value ? "text-ink font-semibold" : "text-ink-3/50")}>
                  {f.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>

          {req.notes ? (
            <div className="bg-cream mt-3 rounded-[14px] px-3.5 py-2.5">
              <p className="text-amber text-[11.5px] font-semibold">Note</p>
              <p className="text-ink-2 mt-0.5 text-[12.5px] leading-relaxed">{req.notes}</p>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-ink flex items-center gap-1.5 text-[13.5px] font-semibold">
              <Wrench className="text-cobalt h-3.5 w-3.5" aria-hidden /> Tool calls
            </p>
            <span className="bg-ice text-navy tnum rounded-full px-2 py-0.5 text-[11px] font-semibold">{call.toolCalls.length}</span>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {call.toolCalls.map((t, i) => (
              <li key={`${t.id}-${i}`} className="border-line-2 rounded-[12px] border bg-white px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-cobalt font-mono text-[11px] font-semibold">{t.name}</span>
                  <span className="text-ink-3 tnum ml-auto font-mono text-[10px]">
                    {String(Math.floor(t.at / 1000)).padStart(2, "0")}s
                  </span>
                </div>
                <code className="text-ink-3 mt-0.5 block font-mono text-[10.5px] break-all">{JSON.stringify(t.args)}</code>
              </li>
            ))}
            {call.toolCalls.length === 0 ? <li className="text-ink-3 text-[12px]">None recorded.</li> : null}
          </ul>
        </Card>

        <Card className="flex min-w-0 flex-col p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-3">
            <Chip icon={<AudioLines className="h-3.5 w-3.5" />}>Full transcript</Chip>
            <span className="text-ink-3 tnum text-[12px]">{call.transcript.length} turns</span>
          </div>
          <Panel className="flex-1 p-3 sm:p-4">
            <Transcript
              turns={call.transcript}
              toolCalls={call.toolCalls}
              follow={live}
              emptyHint="Nothing was transcribed for this call."
              className="max-h-[78vh] pr-1"
            />
          </Panel>
          <div className="flex flex-wrap gap-2 px-1 pt-4">
            <Link href="/call" className={btn("primary")}>
              <PhoneCall className="h-4 w-4" aria-hidden /> Start a new call
            </Link>
            <Link href="/leads" className={btn("outline")}>
              Back to leads
            </Link>
          </div>
        </Card>
      </div>

      <SiteFooter />
    </div>
  );
}
