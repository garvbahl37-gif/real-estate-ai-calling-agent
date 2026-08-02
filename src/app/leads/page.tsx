import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { cn } from "@/lib/cn";
import { formatInr } from "@/lib/projects";
import { listCalls, storageBackend } from "@/lib/store";
import type { CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads — Aarambh Realty",
  description: "Every call the AI agent has taken, with the captured requirements and qualification score.",
};

function band(call: CallRecord) {
  return call.summary?.qualification.band ?? null;
}

function budget(call: CallRecord) {
  const r = call.summary?.requirements ?? call.requirements;
  const { budgetMinInr: lo, budgetMaxInr: hi } = r;
  if (lo == null && hi == null) return "—";
  if (lo != null && hi != null && lo !== hi) return `${formatInr(lo)} – ${formatInr(hi)}`;
  return formatInr((hi ?? lo)!);
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

function duration(sec?: number) {
  if (!sec) return "—";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export default async function LeadsPage() {
  let calls: CallRecord[] = [];
  let error: string | null = null;
  try {
    calls = await listCalls(200);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const backend = storageBackend();
  const hot = calls.filter((c) => band(c) === "hot").length;
  const warm = calls.filter((c) => band(c) === "warm").length;
  const withPhone = calls.filter((c) => (c.summary?.requirements.phone ?? c.requirements.phone) != null).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/leads" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-20 sm:px-8">
        <div className="shiro mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Sales CRM</p>
              <h1 className="font-display text-ink mt-2 text-[34px] leading-tight sm:text-[40px]">Leads</h1>
            </div>
            <p className="text-ink-3 max-w-[46ch] text-[12px] leading-relaxed">
              Written by the agent during each call through <code className="font-mono">update_lead_requirements</code>,
              then reconciled against the transcript after hang-up.{" "}
              {backend === "postgres" ? (
                <>Stored in Postgres.</>
              ) : (
                <span className="text-amber">
                  In-memory store — set <code className="font-mono">DATABASE_URL</code> to persist across restarts.
                </span>
              )}
            </p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {[
            { k: "Calls", v: String(calls.length) },
            { k: "Hot", v: String(hot) },
            { k: "Warm", v: String(warm) },
            { k: "With a number", v: String(withPhone) },
          ].map((s) => (
            <div key={s.k} className="shiro shiro-soft">
              <dt className="eyebrow">{s.k}</dt>
              <dd className="font-display text-ink tnum mt-1.5 text-[28px] leading-none">{s.v}</dd>
            </div>
          ))}
        </dl>

        {error ? (
          <p className="border-magenta/30 bg-magenta-wash text-magenta mt-8 rounded-sm border px-4 py-3 text-[13px]">
            Could not load leads: {error}
          </p>
        ) : null}

        {calls.length === 0 && !error ? (
          <div className="border-rule mt-10 rounded-sm border border-dashed px-6 py-16 text-center">
            <p className="font-display text-ink text-[20px]">No calls yet.</p>
            <p className="text-ink-2 mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed">
              Every conversation with Priya lands here — the requirements she captured, the objections raised, and a
              qualification score.
            </p>
            <Link
              href="/call"
              className="bg-ink text-paper hover:bg-aqua mt-6 inline-flex min-h-11 items-center rounded-sm px-5 text-[13.5px] font-semibold transition-colors"
            >
              Take the first call
            </Link>
          </div>
        ) : null}

        {calls.length > 0 ? (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-ink border-b">
                  {["Lead", "Requirement", "Budget", "Score", "Channel", "When", "Length", ""].map((h) => (
                    <th key={h} className="eyebrow pb-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => {
                  const req = c.summary?.requirements ?? c.requirements;
                  const b = band(c);
                  return (
                    <tr key={c.id} className="border-rule-2 hover:bg-paper-2 border-b transition-colors">
                      <td className="py-3 pr-4 align-top">
                        <Link href={`/leads/${c.id}`} className="text-ink inline-flex min-h-9 items-center text-[14px] font-semibold hover:underline">
                          {req.name || "Unidentified caller"}
                        </Link>
                        <div className="text-ink-3 mt-0.5 font-mono text-[11px]">{req.phone || c.fromNumber || "no number"}</div>
                      </td>
                      <td className="text-ink-2 max-w-[280px] py-3 pr-4 align-top text-[13px] leading-snug">
                        {c.summary?.headline ?? [req.configurations?.join("/"), req.preferredLocations?.join(", ")].filter(Boolean).join(" · ") ?? "—"}
                      </td>
                      <td className="text-ink tnum py-3 pr-4 align-top font-mono text-[12.5px]">{budget(c)}</td>
                      <td className="py-3 pr-4 align-top">
                        {b ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase",
                              b === "hot"
                                ? "bg-magenta text-paper"
                                : b === "warm"
                                  ? "bg-amber-wash text-amber"
                                  : "bg-paper-2 text-ink-3",
                            )}
                          >
                            {c.summary!.qualification.score} {b}
                          </span>
                        ) : (
                          <span className="text-ink-3 text-[12px]">
                            {c.status === "in_progress" ? "in progress" : "not scored"}
                          </span>
                        )}
                      </td>
                      <td className="text-ink-3 py-3 pr-4 align-top text-[12px]">{c.channel}</td>
                      <td className="text-ink-3 py-3 pr-4 align-top text-[12px] whitespace-nowrap">{when(c.startedAt)}</td>
                      <td className="text-ink-3 tnum py-3 pr-4 align-top font-mono text-[12px]">{duration(c.durationSec)}</td>
                      <td className="py-3 align-top">
                        <Link href={`/leads/${c.id}`} className="text-aqua flex min-h-11 items-center text-[12px] font-semibold hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
