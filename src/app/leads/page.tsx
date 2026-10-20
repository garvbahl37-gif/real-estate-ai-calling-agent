import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mic, PhoneCall, PhoneIncoming, Search } from "lucide-react";
import { LeadMap, type MapPin } from "@/components/LeadMap";
import { LiveCallPill } from "@/components/LiveCallPill";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { VisitBoard } from "@/components/VisitBoard";
import { Avatar, Card, EmptyNote, Meter, Panel, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { budgetLabel, captureProgress } from "@/lib/lead-fields";
import { leadLocation } from "@/lib/presentation";
import { redactCall } from "@/lib/redact";
import { listCalls, storageBackend } from "@/lib/store";
import type { CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads — Aarambh Realty",
  description: "Every call the AI agent has taken, with the captured requirements and qualification score.",
};

type BandFilter = "all" | "hot" | "warm" | "cold" | "unscored";

function band(call: CallRecord) {
  return call.summary?.qualification.band ?? null;
}

function reqOf(call: CallRecord) {
  return call.summary?.requirements ?? call.requirements;
}

function duration(sec?: number) {
  if (!sec) return "—";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function istDay(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Cards rendered before "Show all" — the stats, map and board still count every call. */
const LIST_PAGE = 40;

/** A call row older than this with no hang-up crashed rather than is still talking. */
const LIVE_WINDOW_MS = 30 * 60 * 1000;

/** The request time. This page is force-dynamic, so it is read fresh on every render. */
function requestTime() {
  return Date.now();
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filter: BandFilter = (["hot", "warm", "cold", "unscored"] as const).find((b) => b === params.band) ?? "all";
  const showAll = params.all === "1";

  let calls: CallRecord[] = [];
  let error: string | null = null;
  try {
    // Public page: mask before anything renders. `false` also drops the
    // transcripts, which a list view never needed.
    calls = (await listCalls(200)).map((c) => redactCall(c, false));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const backend = storageBackend();
  const now = requestTime();
  const today = istDay(now);
  const callsToday = calls.filter((c) => istDay(c.startedAt) === today).length;
  const scored = calls.filter((c) => c.summary);
  const counts = {
    hot: calls.filter((c) => band(c) === "hot").length,
    warm: calls.filter((c) => band(c) === "warm").length,
    cold: calls.filter((c) => band(c) === "cold").length,
    unscored: calls.length - scored.length,
  };
  const isLive = (c: CallRecord) => c.status === "in_progress" && now - Date.parse(c.startedAt) < LIVE_WINDOW_MS;
  const live = calls.find(isLive) ?? null;
  const byChannel = {
    browser: calls.filter((c) => c.channel === "browser").length,
    phone: calls.filter((c) => c.channel === "phone").length,
  };
  const timed = calls.filter((c) => c.durationSec);
  const avgSec = timed.length ? Math.round(timed.reduce((n, c) => n + c.durationSec!, 0) / timed.length) : undefined;

  const shown = calls.filter((c) => {
    if (filter === "all") return true;
    if (filter === "unscored") return !c.summary;
    return band(c) === filter;
  });

  // Where buyers are looking, grouped to the nearest few hundred metres.
  const pinMap = new Map<string, MapPin>();
  for (const c of calls) {
    const at = leadLocation(reqOf(c));
    if (!at) continue;
    const key = at.map((n) => n.toFixed(2)).join(",");
    const pin = pinMap.get(key) ?? { at, count: 0 };
    pin.count++;
    pinMap.set(key, pin);
  }
  const pins = [...pinMap.values()];
  const located = pins.reduce((n, p) => n + p.count, 0);

  // What is being asked for.
  const demand = new Map<string, number>();
  for (const c of calls) for (const cfg of reqOf(c).configurations ?? []) demand.set(cfg, (demand.get(cfg) ?? 0) + 1);
  const topDemand = [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const demandMax = Math.max(1, ...topDemand.map(([, n]) => n));

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/leads" />

      <Card as="div" className="p-2.5 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[480px_minmax(0,1fr)]">
          {/* ---------------- Left: the lead list ---------------- */}
          <Panel className="flex min-w-0 flex-col p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-ink text-[34px] leading-none font-medium tracking-[-0.035em] sm:text-[40px]">Leads</h1>
                <p className="text-ink-2 mt-2.5 text-[13.5px]">
                  {calls.length} calls ·{" "}
                  {backend === "postgres" ? (
                    "stored in Postgres"
                  ) : (
                    <span className="text-amber">in-memory — set DATABASE_URL to persist</span>
                  )}
                </p>
              </div>
              <Link
                href="/call"
                aria-label="Start a call"
                className="bg-cobalt shadow-cta hover:bg-cobalt-deep flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-white transition-colors"
              >
                <PhoneCall className="h-6 w-6" aria-hidden />
              </Link>
            </div>

            <nav className="mt-7 flex flex-wrap gap-1.5" aria-label="Filter leads">
              {(
                [
                  ["all", "All", calls.length],
                  ["hot", "Hot", counts.hot],
                  ["warm", "Warm", counts.warm],
                  ["cold", "Cold", counts.cold],
                  ["unscored", "Not scored", counts.unscored],
                ] as const
              ).map(([key, label, n]) => (
                <Link
                  key={key}
                  href={key === "all" ? "/leads" : `/leads?band=${key}`}
                  aria-current={filter === key ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors",
                    filter === key ? "bg-ink text-white" : "text-ink-2 hover:text-ink bg-white",
                  )}
                >
                  {label}
                  <span className={cn("tnum text-[11px]", filter === key ? "text-white/60" : "text-ink-3")}>{n}</span>
                </Link>
              ))}
            </nav>

            {error ? (
              <p className="bg-rose-wash text-rose mt-5 rounded-[16px] px-4 py-3 text-[13px]">Could not load leads: {error}</p>
            ) : null}

            {calls.length === 0 && !error ? (
              <div className="mt-5 rounded-[18px] bg-white px-6 py-12 text-center">
                <p className="text-ink text-[18px] font-semibold">No calls yet.</p>
                <p className="text-ink-2 mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed">
                  Every conversation with Priya lands here — the requirements she captured, the objections raised, and a
                  qualification score.
                </p>
                <Link href="/call" className={cn(btn("primary"), "mt-6")}>
                  Take the first call
                </Link>
              </div>
            ) : null}

            {calls.length > 0 && shown.length === 0 ? (
              <EmptyNote className="mt-5 bg-white">Nothing in this band yet.</EmptyNote>
            ) : null}

            {shown.length ? (
              <ul className="thin-scroll -mr-2 mt-5 max-h-[640px] space-y-3 overflow-y-auto pr-2">
                {(showAll ? shown : shown.slice(0, LIST_PAGE)).map((c) => (
                  <li key={c.id}>
                    <LeadRow call={c} live={isLive(c)} />
                  </li>
                ))}
                {!showAll && shown.length > LIST_PAGE ? (
                  <li>
                    <Link
                      href={`/leads?${new URLSearchParams({ ...(filter !== "all" ? { band: filter } : {}), all: "1" })}`}
                      className="text-cobalt hover:bg-ice flex min-h-11 items-center justify-center rounded-[16px] bg-white text-[13px] font-semibold transition-colors"
                    >
                      Show all {shown.length} leads
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {calls.length ? (
              <div className="border-pale mt-6 border-t pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-ink-3 text-[18px] font-medium tracking-[-0.015em]">Recent calls</p>
                  <Search className="text-ink-3 h-4 w-4" aria-hidden />
                </div>
                <ul className="mt-4 space-y-3.5">
                  {calls.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <VoiceRow call={c} live={isLive(c)} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <LiveCallPill className="mt-6" live={live ? { id: live.id, startedAt: live.startedAt } : null} />
          </Panel>

          {/* ---------------- Right: the numbers ---------------- */}
          <div className="flex min-w-0 flex-col gap-8 p-1 sm:p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                tone="cobalt"
                icon={<PhoneIncoming className="h-6 w-6" aria-hidden />}
                value={callsToday}
                label={["Calls", "today"]}
                foot={[calls.length, "calls in all"]}
              />
              <StatCard
                tone="mid"
                icon={<Mic className="h-6 w-6" aria-hidden />}
                value={scored.length}
                label={["Leads", "scored"]}
                foot={[counts.hot, `hot lead${counts.hot === 1 ? "" : "s"}`]}
              />
            </div>

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
              <div className="min-w-0">
                <h2 className="text-ink text-[22px] font-medium tracking-[-0.02em]">Lead quality</h2>
                <p className="text-ink-3 mt-1 text-[12.5px]">
                  {scored.length} of {calls.length} calls scored after hang-up
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-6">
                  <ul className="min-w-[180px] flex-1 space-y-3">
                    {(
                      [
                        ["Hot", counts.hot, "bg-cobalt"],
                        ["Warm", counts.warm, "bg-mid"],
                        ["Cold", counts.cold, "bg-pale"],
                      ] as const
                    ).map(([l, n, dot]) => (
                      <li key={l} className="flex items-center gap-3 text-[13.5px]">
                        <span className={cn("h-3 w-3 rounded-[3px]", dot)} aria-hidden />
                        <span className="text-ink flex-1">{l} leads</span>
                        <span className="text-ink tnum font-semibold">{pct(n, scored.length)}</span>
                      </li>
                    ))}
                  </ul>
                  <Donut hot={counts.hot} warm={counts.warm} cold={counts.cold} />
                </div>

                <h3 className="text-ink mt-10 text-[16px] font-semibold tracking-[-0.01em]">In demand</h3>
                <p className="text-ink-3 mt-1 text-[12.5px]">Configurations buyers asked for</p>
                {topDemand.length ? (
                  <ul className="mt-4 space-y-3">
                    {topDemand.map(([cfg, n]) => (
                      <li key={cfg} className="grid grid-cols-[64px_1fr_28px] items-center gap-3 text-[13px]">
                        <span className="text-ink font-semibold">{cfg}</span>
                        <Meter value={n} max={demandMax} />
                        <span className="text-ink-3 tnum text-right">{n}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-3 mt-4 text-[13px]">Nothing captured yet.</p>
                )}

                <dl className="mt-10 grid grid-cols-3 gap-2">
                  {[
                    ["Browser", String(byChannel.browser)],
                    ["Phone", String(byChannel.phone)],
                    ["Avg. length", duration(avgSec)],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-frost rounded-[16px] px-4 py-3.5">
                      <dt className="label">{k}</dt>
                      <dd className="text-ink tnum mt-1.5 text-[22px] leading-none font-medium tracking-[-0.02em]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-ink text-[22px] font-medium tracking-[-0.02em]">Lead geography</h2>
                    <p className="text-ink-3 mt-1 text-[12.5px]">
                      {located ? `${located} leads placed by what they asked for` : "Projects shown; no lead has a location yet"}
                    </p>
                  </div>
                  <Link href="/projects" className={btn("outline", "sm")}>
                    Projects <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
                <LeadMap pins={pins} className="mx-auto mt-4 h-auto w-full max-w-[460px]" />
                <div className="text-ink-3 mt-2 flex justify-center gap-5 text-[11.5px]">
                  <span className="flex items-center gap-1.5">
                    <span className="bg-cobalt h-2.5 w-2.5 rounded-full" /> Leads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="bg-mid h-2.5 w-2.5 rounded-full" /> Projects
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-8">
        <VisitBoard calls={calls} />
      </Card>

      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function pct(n: number, of: number) {
  return of ? `${Math.round((n / of) * 100)}%` : "—";
}

function StatCard({
  tone,
  icon,
  value,
  label,
  foot,
}: {
  tone: "cobalt" | "mid";
  icon: React.ReactNode;
  value: number;
  label: [string, string];
  foot: [number, string];
}) {
  return (
    <div className={cn("rounded-[26px] p-6", tone === "cobalt" ? "bg-cobalt text-white" : "bg-mid text-navy")}>
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[16px] bg-white shadow-[0_10px_20px_-12px_rgb(19_40_110/0.5)]",
          tone === "cobalt" ? "text-cobalt" : "text-navy",
        )}
      >
        {icon}
      </span>
      <div className="mt-6 flex items-end gap-3">
        <span className="tnum text-[54px] leading-[0.9] font-medium tracking-[-0.04em]">{value}</span>
        <span className={cn("pb-1 text-[13px] leading-tight", tone === "cobalt" ? "text-white/85" : "text-navy/80")}>
          {label[0]}
          <br />
          {label[1]}
        </span>
      </div>
      <div className={cn("mt-6 flex items-baseline gap-2.5 border-t pt-4", tone === "cobalt" ? "border-white/30" : "border-navy/20")}>
        <span className="tnum text-[22px] font-medium">{foot[0]}</span>
        <span className={cn("text-[13px]", tone === "cobalt" ? "text-white/85" : "text-navy/80")}>{foot[1]}</span>
      </div>
    </div>
  );
}

/** The quality split as the reference's donut: thick segments, gaps between, a figure in the middle. */
function Donut({ hot, warm, cold }: { hot: number; warm: number; cold: number }) {
  const total = hot + warm + cold;
  const size = 168;
  const r = 66;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 6 : 0;
  let offset = 0;
  const segs = (
    [
      [hot, "#325ced"],
      [warm, "#8bb7f0"],
      [cold, "#cfe4ff"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, color]) => {
      const len = Math.max(0, (n / total) * c - gap);
      const seg = { len, color, offset };
      offset += (n / total) * c;
      return seg;
    });

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f8" strokeWidth={18} />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={22}
            strokeDasharray={`${s.len} ${c}`}
            strokeDashoffset={-s.offset}
          />
        ))}
        <circle cx={size / 2} cy={size / 2} r={r - 20} fill="none" stroke="#e9f1fd" strokeWidth={3} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-ink tnum text-[24px] font-semibold tracking-[-0.02em]">{total ? pct(hot, total) : "—"}</span>
        <span className="text-ink-3 text-[11px] font-semibold tracking-[0.08em] uppercase">Hot</span>
      </div>
    </div>
  );
}

function LeadRow({ call: c, live }: { call: CallRecord; live: boolean }) {
  const req = reqOf(c);
  const b = band(c);
  const { filled, total } = captureProgress(req);
  const where = req.preferredLocations?.join(", ") || req.configurations?.join(" / ");
  return (
    <Link href={`/leads/${c.id}`} className="group hover:shadow-soft block rounded-[20px] bg-white p-4 transition-shadow">
      <div className="flex items-center gap-3">
        <Avatar name={req.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-[15px] font-semibold">{req.name || "Unidentified caller"}</p>
          <p className="text-ink-3 truncate text-[12px]">{where || req.phone || c.fromNumber || `${c.channel} call`}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("tnum text-[15px] font-semibold", b === "hot" ? "text-cobalt" : "text-ink")}>
            {c.summary ? c.summary.qualification.score : "—"}
          </p>
          <p className={cn("text-[11px] capitalize", live ? "text-cobalt font-semibold" : "text-ink-3")}>
            {b ?? (live ? "live" : "not scored")}
          </p>
        </div>
        <div className="hidden w-[84px] shrink-0 text-right sm:block">
          <p className="text-ink tnum truncate text-[13.5px] font-semibold">{budgetLabel(req) ?? "—"}</p>
          <p className="text-ink-3 text-[11px]">Budget</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <Meter value={filled} max={total} />
          <p className="text-ink-3 mt-1.5 text-[11px]">
            <span className="text-ink-2 tnum font-semibold">
              {filled}/{total}
            </span>{" "}
            fields captured
          </p>
        </div>
        <span className="text-cobalt flex items-center gap-1 text-[12.5px] font-semibold">
          View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** The reference's voice-message row: who, what kind of call, and the shape of how she spoke. */
function VoiceRow({ call: c, live }: { call: CallRecord; live: boolean }) {
  const req = reqOf(c);
  const turns = c.telemetry?.turns ?? [];
  const longest = Math.max(1, ...turns.map((t) => t.spokenMs));
  return (
    <Link href={`/leads/${c.id}`} className="group flex items-center gap-3">
      <span className="relative">
        <Avatar name={req.name} size={42} />
        <span
          className={cn(
            "border-frost absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2",
            live ? "bg-[#22c55e]" : c.channel === "phone" ? "bg-cobalt" : "bg-mid",
          )}
          aria-hidden
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink group-hover:text-cobalt block truncate text-[14px] font-semibold transition-colors">
          {req.name || "Unidentified caller"}
        </span>
        <span className="text-ink-3 flex items-center gap-1.5 text-[12px]">
          <Mic className="h-3 w-3" aria-hidden />
          {c.channel === "phone" ? "Phone call" : "Browser call"} · {duration(c.durationSec)}
        </span>
      </span>
      {turns.length ? (
        <span className="hidden h-6 items-center gap-[2px] sm:flex" aria-label={`${turns.length} turns`}>
          {turns.slice(0, 22).map((t, i) => (
            <span
              key={i}
              className={cn("w-[3px] rounded-full", i % 3 ? "bg-mid" : "bg-cobalt")}
              style={{ height: 4 + Math.round((t.spokenMs / longest) * 18) }}
            />
          ))}
        </span>
      ) : null}
      {c.summary?.qualification.band === "hot" ? (
        <span className="bg-cobalt h-2.5 w-2.5 shrink-0 rounded-full" aria-label="Hot lead" />
      ) : null}
    </Link>
  );
}
