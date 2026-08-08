import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { describeProviders } from "@/lib/actions/runner";
import { allCampaignProgress, listCampaigns } from "@/lib/campaigns/store";
import { aggregate, type EvalRun } from "@/lib/eval/types";
import { callingEnabled } from "@/lib/ops-auth";
import { listCallAnalytics, storageBackend, type CallAnalyticsRow } from "@/lib/store";
import type { Campaign } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations — Aarambh Realty",
  description: "Eval scores, call latency, factual accuracy, campaigns and post-call delivery.",
};

/**
 * The page that answers "is this agent actually working?".
 *
 * Deliberately not a demo surface. Every number here is measured rather than
 * asserted — the eval scores come from adversarial personas played against a
 * real Live session, the latency from instrumented calls, the accuracy from
 * claims checked against the catalogue. A voice agent that sounds good and is
 * wrong 8% of the time is worse than one that sounds worse and is right, and
 * nothing on the call page would tell you which one you have.
 */

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function loadEvalRun(): Promise<EvalRun | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "evals", "latest.json"), "utf8");
    return JSON.parse(raw) as EvalRun;
  } catch {
    // Absent before the first `pnpm eval`, and absent in any deployment that
    // did not commit a run. Both are fine; the section explains itself.
    return null;
  }
}

/** Percentile over a sorted-on-demand list. Nearest-rank, which is what p95 means here. */
function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function latencyStats(calls: CallAnalyticsRow[]) {
  const ttfa = calls.flatMap(
    (c) => c.telemetry?.turns?.map((t) => t.timeToFirstAudioMs).filter((n) => n > 0) ?? [],
  );
  const tools = calls.flatMap((c) => c.telemetry?.tools?.map((t) => t.durationMs) ?? []);
  return {
    sampled: calls.filter((c) => c.telemetry).length,
    turns: ttfa.length,
    p50: percentile(ttfa, 50),
    p95: percentile(ttfa, 95),
    toolP95: percentile(tools, 95),
    bargeIns: calls.reduce((n, c) => n + (c.telemetry?.bargeIns ?? 0), 0),
    reconnects: calls.reduce((n, c) => n + (c.telemetry?.reconnects ?? 0), 0),
  };
}

function accuracyStats(calls: CallAnalyticsRow[]) {
  const reports = calls.map((c) => c.groundedness).filter((g): g is NonNullable<typeof g> => g != null);
  const total = reports.reduce(
    (a, r) => ({
      grounded: a.grounded + r.grounded,
      unsupported: a.unsupported + r.unsupported,
      contradicted: a.contradicted + r.contradicted,
    }),
    { grounded: 0, unsupported: 0, contradicted: 0 },
  );
  const checked = total.grounded + total.unsupported + total.contradicted;
  return {
    calls: reports.length,
    ...total,
    checked,
    score: reports.length ? Math.round(reports.reduce((n, r) => n + r.score, 0) / reports.length) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Section({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="shiro">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="font-display text-ink mt-2 text-[24px] leading-tight sm:text-[27px]">{title}</h2>
          </div>
          {note ? <p className="text-ink-3 max-w-[52ch] text-[12px] leading-relaxed">{note}</p> : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="shiro shiro-soft">
      <dt className="eyebrow">{k}</dt>
      <dd
        className={cn(
          "font-display tnum mt-1.5 text-[28px] leading-none",
          tone === "good" ? "text-aqua" : tone === "bad" ? "text-magenta" : "text-ink",
        )}
      >
        {v}
      </dd>
      {sub ? <p className="text-ink-3 mt-1.5 text-[11.5px] leading-snug">{sub}</p> : null}
    </div>
  );
}

/** A 1–5 rubric score as a proportional bar. Five segments, so the scale reads without a legend. */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2.5 w-4 rounded-[1px] sm:w-5",
            score >= n ? (score >= 4 ? "bg-aqua" : "bg-amber") : "bg-rule-2",
          )}
        />
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-rule text-ink-3 rounded-sm border border-dashed px-5 py-8 text-center text-[13px] leading-relaxed">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */

export default async function OpsPage() {
  const [run, calls, campaigns, progressByCampaign] = await Promise.all([
    loadEvalRun(),
    listCallAnalytics(500).catch(() => [] as CallAnalyticsRow[]),
    listCampaigns().catch(() => [] as Campaign[]),
    allCampaignProgress().catch(() => new Map()),
  ]);

  const progress = campaigns.map((c) => ({ campaign: c, progress: progressByCampaign.get(c.id) ?? null }));

  const latency = latencyStats(calls);
  const accuracy = accuracyStats(calls);
  const providers = describeProviders();
  const rubric = run ? aggregate(run) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/ops" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-24 sm:px-8">
        <div className="shiro mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Operations</p>
              <h1 className="font-display text-ink mt-2 text-[34px] leading-tight sm:text-[40px]">
                Is she actually working?
              </h1>
            </div>
            <p className="text-ink-3 max-w-[50ch] text-[12px] leading-relaxed">
              An agent that sounds convincing and is wrong 8% of the time is worse than one that sounds worse and is
              right — and nothing on the call page would tell you which one you have. Everything here is measured.
              Storage: <span className="font-mono">{storageBackend()}</span>.
            </p>
          </div>
        </div>

        {/* ---------------- Quality ---------------- */}
        <Section
          eyebrow="Evaluation"
          title="Adversarial personas"
          note={
            <>
              Twelve callers played by a text model against a real Live session — a caller who switches language
              mid-sentence, one whose budget is impossible, one who wants a human, one who wants a city we do not
              serve. Each conversation is then scored by a judge against a fixed rubric. Run with{" "}
              <code className="font-mono">pnpm eval</code>.
            </>
          }
        >
          {run ? (
            <>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                <Stat
                  k="Mean score"
                  v={`${run.meanScore.toFixed(2)} / 5`}
                  tone={run.meanScore >= 4 ? "good" : "bad"}
                  sub={`${run.results.length} persona${run.results.length === 1 ? "" : "s"}`}
                />
                <Stat
                  k="Expectations met"
                  v={`${Math.round(run.expectationPassRate * 100)}%`}
                  tone={run.expectationPassRate >= 0.9 ? "good" : "bad"}
                  sub="Per-persona checks, not rubric scores"
                />
                <Stat
                  k="Groundedness"
                  v={run.meanGroundedness != null ? `${run.meanGroundedness}/100` : "—"}
                  tone={run.meanGroundedness != null && run.meanGroundedness >= 95 ? "good" : undefined}
                  sub="Claims verified against the catalogue"
                />
                <Stat
                  k="Commit"
                  v={run.gitSha ?? "—"}
                  sub={new Date(run.finishedAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              </dl>

              {/* min-w-0 on both children: a grid item defaults to min-width:auto,
                  so the persona table's min-w-[420px] would otherwise widen the
                  whole track and push the dimension list off-screen with it —
                  the overflow-x-auto never gets the chance to scroll. */}
              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="eyebrow">By dimension</p>
                  <ul className="mt-3 space-y-2.5">
                    {rubric.map((d) => (
                      <li key={d.key} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {/* Full width on mobile: the label, five bars and a score do not
                            fit on one 375px line, and squeezing them makes all three
                            unreadable rather than one of them wrap. */}
                        <span className="text-ink-2 w-full shrink-0 text-[12.5px] leading-tight sm:w-[18ch]">
                          {d.label}
                        </span>
                        <ScoreBar score={d.mean} />
                        <span className="text-ink tnum font-mono text-[12px]">{d.mean.toFixed(2)}</span>
                        {d.worst.score < 4 ? (
                          // min-w-0 is what lets `truncate` actually shrink here — a flex
                          // item will not go below its content width without it.
                          <span className="text-ink-3 min-w-0 flex-1 truncate text-[11px]">
                            worst: {d.worst.personaId}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="min-w-0">
                  <p className="eyebrow">By persona</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-left">
                      <thead>
                        <tr className="border-ink border-b">
                          {["Persona", "Probes", "Score", "Turns"].map((h) => (
                            <th key={h} className="eyebrow pb-2 font-normal">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {run.results.map((r) => (
                          <tr key={r.personaId} className="border-rule-2 border-b">
                            <td className="text-ink py-2.5 pr-4 align-top text-[13px] font-medium">{r.personaLabel}</td>
                            <td className="text-ink-3 py-2.5 pr-4 align-top text-[11.5px] leading-snug">
                              {r.expectations.filter((e) => e.met).length}/{r.expectations.length} checks
                            </td>
                            <td
                              className={cn(
                                "tnum py-2.5 pr-4 align-top font-mono text-[12.5px]",
                                r.overall >= 4 ? "text-aqua" : "text-magenta",
                              )}
                            >
                              {r.overall.toFixed(2)}
                            </td>
                            <td className="text-ink-3 tnum py-2.5 align-top font-mono text-[12px]">{r.turnCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyNote>
              No eval run recorded. Run <code className="font-mono">pnpm eval</code> to score the agent against every
              persona and write <code className="font-mono">evals/latest.json</code>.
            </EmptyNote>
          )}
        </Section>

        {/* ---------------- Latency ---------------- */}
        <Section
          eyebrow="Latency"
          title="What the caller experiences as slow"
          note="Time to first audio — from the caller finishing speaking to her voice starting. Averages hide the problem here; a p95 of three seconds is a call that felt broken twice even if the median was fine."
        >
          {latency.turns > 0 ? (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
              <Stat
                k="TTFA p50"
                v={latency.p50 != null ? `${latency.p50} ms` : "—"}
                tone={latency.p50 != null && latency.p50 < 1200 ? "good" : undefined}
              />
              <Stat
                k="TTFA p95"
                v={latency.p95 != null ? `${latency.p95} ms` : "—"}
                tone={latency.p95 != null && latency.p95 > 2500 ? "bad" : undefined}
              />
              <Stat
                k="Tool p95"
                v={latency.toolP95 != null ? `${latency.toolP95} ms` : "—"}
                sub="Pure executor — no network"
              />
              <Stat k="Barge-ins" v={String(latency.bargeIns)} sub="Caller interrupted her" />
              <Stat k="Reconnects" v={String(latency.reconnects)} tone={latency.reconnects > 0 ? "bad" : undefined} />
              <Stat k="Sampled" v={`${latency.turns}`} sub={`turns across ${latency.sampled} calls`} />
            </dl>
          ) : (
            <EmptyNote>No instrumented calls yet. Take a call and the numbers appear here.</EmptyNote>
          )}
        </Section>

        {/* ---------------- Accuracy ---------------- */}
        <Section
          eyebrow="Factual accuracy"
          title="What she claimed, checked"
          note="A model finds assertions in a transcript well and adjudicates them badly, so extraction is the only part delegated: it returns quoted claims and the verdict is computed here against the catalogue. A misquoted possession date is a RERA problem, not a typo."
        >
          {accuracy.calls > 0 ? (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-5">
              <Stat
                k="Score"
                v={accuracy.score != null ? `${accuracy.score}/100` : "—"}
                tone={accuracy.score != null && accuracy.score >= 95 ? "good" : "bad"}
                sub={`across ${accuracy.calls} calls`}
              />
              <Stat k="Claims checked" v={String(accuracy.checked)} />
              <Stat k="Grounded" v={String(accuracy.grounded)} tone="good" />
              <Stat k="Unsupported" v={String(accuracy.unsupported)} sub="Not in the sheet; costs half" />
              <Stat
                k="Contradicted"
                v={String(accuracy.contradicted)}
                tone={accuracy.contradicted > 0 ? "bad" : undefined}
                sub="Directly wrong"
              />
            </dl>
          ) : (
            <EmptyNote>No calls have been checked yet. Accuracy is computed when a call summary is generated.</EmptyNote>
          )}
        </Section>

        {/* ---------------- Campaigns ---------------- */}
        <Section
          eyebrow="Outbound"
          title="Campaigns"
          note={
            <>
              Dialling is{" "}
              {callingEnabled() ? (
                <span className="text-magenta font-semibold">enabled</span>
              ) : (
                <span className="text-aqua font-semibold">disabled</span>
              )}
              . With it off the queue still claims, retries and respects the 09:00–21:00 TRAI window, but places no
              call — so the engine is observable without anyone&rsquo;s phone ringing.
            </>
          }
        >
          {progress.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-ink border-b">
                    {["Campaign", "Status", "Window", "Contacts", "Queued", "Done", "Failed"].map((h) => (
                      <th key={h} className="eyebrow pb-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {progress.map(({ campaign: c, progress: p }) => (
                    <tr key={c.id} className="border-rule-2 border-b">
                      <td className="text-ink py-3 pr-4 align-top text-[13.5px] font-semibold">{c.name}</td>
                      <td className="py-3 pr-4 align-top">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase",
                            c.status === "running"
                              ? "bg-aqua text-paper"
                              : c.status === "completed"
                                ? "bg-paper-2 text-ink-3"
                                : "bg-amber-wash text-amber",
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="text-ink-2 tnum py-3 pr-4 align-top font-mono text-[12px]">
                        {c.callWindowStartHour}:00–{c.callWindowEndHour}:00
                      </td>
                      <td className="text-ink tnum py-3 pr-4 align-top font-mono text-[12.5px]">{p?.total ?? "—"}</td>
                      <td className="text-ink-2 tnum py-3 pr-4 align-top font-mono text-[12.5px]">{p?.queued ?? "—"}</td>
                      <td className="text-aqua tnum py-3 pr-4 align-top font-mono text-[12.5px]">{p?.completed ?? "—"}</td>
                      <td
                        className={cn(
                          "tnum py-3 align-top font-mono text-[12.5px]",
                          (p?.failed ?? 0) > 0 ? "text-magenta" : "text-ink-3",
                        )}
                      >
                        {p?.failed ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyNote>
              No campaigns. Creating one needs an operator token — the route can dial real numbers, so it is closed
              unless <code className="font-mono">OPS_ADMIN_TOKEN</code> is set.
            </EmptyNote>
          )}
        </Section>

        {/* ---------------- Actions ---------------- */}
        <Section
          eyebrow="Delivery"
          title="Where the lead goes next"
          note="A qualified lead sitting in a database is worth nothing. Each destination sits behind one provider interface, and none of them can fail a call — the transcript and summary are already saved by the time these run."
        >
          <ul className="border-rule divide-rule-2 divide-y border-y">
            {providers.map((p) => (
              <li key={p.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                <span className="text-ink w-[20ch] shrink-0 font-mono text-[12.5px] font-semibold">{p.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase",
                    p.configured ? "bg-aqua text-paper" : "bg-paper-2 text-ink-3",
                  )}
                >
                  {p.configured ? "live" : "not configured"}
                </span>
                <span className="text-ink-2 min-w-[24ch] flex-1 text-[13px] leading-snug">
                  {p.description}
                  {p.hint ? <span className="text-ink-3 block text-[11.5px]">{p.hint}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
