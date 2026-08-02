import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Transcript } from "@/components/Transcript";
import { cn } from "@/lib/cn";
import { formatInr, getProject } from "@/lib/projects";
import { getCall } from "@/lib/store";
import type { LeadRequirements } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIMELINE_LABEL: Record<string, string> = {
  immediate: "Immediately",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  beyond_12_months: "Beyond 12 months",
  unknown: "Not established",
};

function budgetLabel(r: LeadRequirements) {
  const { budgetMinInr: lo, budgetMaxInr: hi } = r;
  if (lo == null && hi == null) return undefined;
  if (lo != null && hi != null && lo !== hi) return `${formatInr(lo)} – ${formatInr(hi)}`;
  return formatInr((hi ?? lo)!);
}

function rows(r: LeadRequirements) {
  return [
    ["Name", r.name],
    ["Phone", r.phone],
    ["Email", r.email],
    ["Intent", r.intent && r.intent !== "unknown" ? r.intent.replace(/_/g, " ") : undefined],
    ["Preferred location", r.preferredLocations?.join(", ")],
    ["Property type", r.propertyType && r.propertyType !== "unknown" ? r.propertyType : undefined],
    ["Configuration", r.configurations?.join(", ")],
    ["Budget", budgetLabel(r)],
    ["Purpose", r.purpose && r.purpose !== "unknown" ? r.purpose.replace(/_/g, " ") : undefined],
    ["Timeline", r.timeline ? TIMELINE_LABEL[r.timeline] : undefined],
    ["Financing", r.financing && r.financing !== "unknown" ? r.financing.replace(/_/g, " ") : undefined],
    ["Interested in", r.interestedProjectIds?.map((id) => getProject(id)?.name ?? id).join(", ")],
    ["Site visit", r.siteVisitRequested ? r.siteVisitPreference || "Requested" : undefined],
  ] as const;
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await getCall(id);
  if (!call) notFound();

  const req = call.summary?.requirements ?? call.requirements;
  const s = call.summary;
  const started = new Date(call.startedAt);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/leads" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-20 sm:px-8">
        <div className="shiro mt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/leads" className="eyebrow hover:text-ink transition-colors">
                ← All leads
              </Link>
              <h1 className="font-display text-ink mt-2 text-[32px] leading-tight sm:text-[38px]">
                {req.name || "Unidentified caller"}
              </h1>
              <p className="text-ink-3 mt-1.5 font-mono text-[12px]">
                {req.phone || call.fromNumber || "no number captured"} · {call.channel} call ·{" "}
                {started.toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
                {call.durationSec != null
                  ? ` · ${String(Math.floor(call.durationSec / 60)).padStart(2, "0")}:${String(call.durationSec % 60).padStart(2, "0")}`
                  : ""}
              </p>
            </div>

            {s ? (
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-2.5">
                  <span className="font-display text-ink tnum text-[42px] leading-none">{s.qualification.score}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.1em] uppercase",
                      s.qualification.band === "hot"
                        ? "bg-magenta text-paper"
                        : s.qualification.band === "warm"
                          ? "bg-amber-wash text-amber"
                          : "bg-paper-2 text-ink-3",
                    )}
                  >
                    {s.qualification.band}
                  </span>
                </div>
                <p className="text-ink-3 mt-1 font-mono text-[10px] tracking-[0.1em] uppercase">Qualification</p>
              </div>
            ) : null}
          </div>
        </div>

        {s ? (
          <section className="mt-10">
            <h2 className="font-display text-ink text-[24px] leading-snug">{s.headline}</h2>
            <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
              <div>
                <p className="text-ink-2 max-w-[70ch] text-[14.5px] leading-[1.75]">{s.summary}</p>

                <div className="bg-aqua-wash mt-6 rounded-sm px-4 py-3">
                  <span className="eyebrow">Next action</span>
                  <p className="text-ink mt-1 text-[14px] leading-relaxed font-medium">{s.nextAction}</p>
                </div>

                {s.objections.length ? (
                  <div className="shiro shiro-soft mt-8">
                    <span className="eyebrow">Objections raised</span>
                    <ul className="mt-3 space-y-2">
                      {s.objections.map((o, i) => (
                        <li key={i} className="text-ink-2 border-magenta/30 border-l-2 pl-3 text-[13.5px] leading-relaxed">
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {s.agentNotes ? (
                  <div className="shiro shiro-soft mt-8">
                    <span className="eyebrow">Agent notes</span>
                    <p className="text-ink-2 mt-2 text-[13.5px] leading-relaxed">{s.agentNotes}</p>
                  </div>
                ) : null}
              </div>

              <aside>
                <div className="shiro shiro-soft">
                  <span className="eyebrow">Why this score</span>
                  <p className="text-ink-2 mt-2 text-[13px] leading-relaxed">{s.qualification.reasoning}</p>
                </div>
                {s.languagesUsed.length ? (
                  <div className="shiro shiro-soft mt-6">
                    <span className="eyebrow">Languages spoken</span>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {s.languagesUsed.map((l) => (
                        <span key={l} className="border-rule text-ink-2 rounded-full border px-2.5 py-0.5 text-[11.5px]">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </section>
        ) : (
          <p className="text-ink-3 mt-8 text-[13.5px]">
            {call.status === "in_progress"
              ? "This call is still in progress. The summary is generated when it ends."
              : "No summary was generated for this call."}
          </p>
        )}

        {/* ---- Requirements + transcript ---- */}
        <section className="mt-14 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
          <div>
            <div className="shiro">
              <span className="eyebrow">Captured requirements</span>
            </div>
            <dl className="mt-3">
              {rows(req).map(([label, value]) => (
                <div key={label} className="border-rule-2 grid grid-cols-[110px_1fr] items-baseline gap-2 border-b py-2 last:border-b-0">
                  <dt className="text-ink-3 font-mono text-[10px] tracking-[0.06em] uppercase">{label}</dt>
                  <dd className={cn("text-[13.5px] leading-snug", value ? "text-ink font-medium" : "text-ink-3/60")}>
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>

            {req.notes ? (
              <div className="bg-amber-wash mt-4 rounded-sm px-3 py-2.5">
                <span className="eyebrow">Note</span>
                <p className="text-ink-2 mt-1 text-[12.5px] leading-relaxed">{req.notes}</p>
              </div>
            ) : null}

            <div className="shiro shiro-soft mt-8">
              <span className="eyebrow">Tool calls ({call.toolCalls.length})</span>
              <ul className="mt-2.5 space-y-1.5">
                {call.toolCalls.map((t, i) => (
                  <li key={`${t.id}-${i}`} className="bg-paper-2 rounded-sm px-2.5 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-aqua font-mono text-[11px] font-semibold">{t.name}</span>
                      <span className="text-ink-3 tnum ml-auto font-mono text-[9.5px]">
                        {String(Math.floor(t.at / 1000)).padStart(2, "0")}s
                      </span>
                    </div>
                    <code className="text-ink-3 mt-0.5 block font-mono text-[10.5px] break-all">
                      {JSON.stringify(t.args)}
                    </code>
                  </li>
                ))}
                {call.toolCalls.length === 0 ? <li className="text-ink-3 text-[12px]">None recorded.</li> : null}
              </ul>
            </div>
          </div>

          <div>
            <div className="shiro">
              <span className="eyebrow">Full transcript ({call.transcript.length} turns)</span>
            </div>
            <Transcript
              turns={call.transcript}
              emptyHint="Nothing was transcribed for this call."
              className="mt-4 max-h-[70vh] pr-2"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
