"use client";

import { cn } from "@/lib/cn";
import { formatInr, getProject } from "@/lib/projects";
import type { LeadRequirements, ToolInvocation } from "@/lib/types";

const TIMELINE_LABEL: Record<string, string> = {
  immediate: "Immediately",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  beyond_12_months: "12 months +",
  unknown: "Not established",
};

const INTENT_LABEL: Record<string, string> = {
  buy: "Buying",
  invest: "Investing",
  rent: "Renting",
  just_browsing: "Browsing",
  not_interested: "Not interested",
  unknown: "Not established",
};

const PURPOSE_LABEL: Record<string, string> = {
  self_use: "Self-use",
  investment: "Investment",
  both: "Self-use + investment",
  unknown: "Not established",
};

function budgetLabel(req: LeadRequirements): string | undefined {
  const { budgetMinInr: lo, budgetMaxInr: hi } = req;
  if (lo == null && hi == null) return undefined;
  if (lo != null && hi != null) return lo === hi ? formatInr(lo) : `${formatInr(lo)} – ${formatInr(hi)}`;
  return lo != null ? `${formatInr(lo)} +` : `Up to ${formatInr(hi!)}`;
}

interface Field {
  key: string;
  label: string;
  value?: string;
}

function toFields(req: LeadRequirements): Field[] {
  return [
    { key: "name", label: "Name", value: req.name },
    { key: "phone", label: "Phone", value: req.phone },
    { key: "email", label: "Email", value: req.email },
    { key: "intent", label: "Intent", value: req.intent ? INTENT_LABEL[req.intent] : undefined },
    { key: "locations", label: "Location", value: req.preferredLocations?.join(", ") },
    {
      key: "type",
      label: "Property type",
      value: req.propertyType && req.propertyType !== "unknown" ? req.propertyType : undefined,
    },
    { key: "config", label: "Configuration", value: req.configurations?.join(", ") },
    { key: "budget", label: "Budget", value: budgetLabel(req) },
    { key: "purpose", label: "Purpose", value: req.purpose ? PURPOSE_LABEL[req.purpose] : undefined },
    { key: "timeline", label: "Timeline", value: req.timeline ? TIMELINE_LABEL[req.timeline] : undefined },
    {
      key: "financing",
      label: "Financing",
      value: req.financing === "loan" ? "Home loan" : req.financing === "self_funded" ? "Self-funded" : undefined,
    },
    {
      key: "project",
      label: "Matched project",
      value: req.interestedProjectIds?.map((id) => getProject(id)?.name ?? id).join(", "),
    },
    {
      key: "visit",
      label: "Site visit",
      value: req.siteVisitRequested ? req.siteVisitPreference || "Requested" : undefined,
    },
  ];
}

export function LeadPanel({
  requirements,
  toolCalls,
  className,
}: {
  requirements: LeadRequirements;
  toolCalls: ToolInvocation[];
  className?: string;
}) {
  const fields = toFields(requirements);
  const filled = fields.filter((f) => f.value).length;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shiro shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">Lead record</span>
          <span className="text-ink-3 tnum font-mono text-[10px]">
            {filled}/{fields.length} captured
          </span>
        </div>
      </div>

      <dl className="mt-3 shrink-0">
        {fields.map((f) => (
          // Keying on the value makes React remount the row whenever the agent
          // writes a new one, which replays the CSS flash for free — no effect,
          // no timer, no state tracking what changed.
          <div
            key={`${f.key}:${f.value ?? ""}`}
            className={cn(
              "border-rule-2 grid grid-cols-[100px_1fr] items-baseline gap-2 border-b px-1 py-[7px] last:border-b-0",
              f.value && "field-land",
            )}
          >
            <dt className="text-ink-3 font-mono text-[10px] tracking-[0.06em] uppercase">{f.label}</dt>
            <dd
              className={cn(
                "text-[13.5px] leading-snug",
                f.value ? "text-ink font-medium" : "text-ink-3/60",
              )}
            >
              {f.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      {requirements.notes ? (
        <div className="bg-amber-wash mt-3 shrink-0 rounded-sm px-3 py-2">
          <span className="eyebrow">Agent note</span>
          <p className="text-ink-2 mt-1 text-[12.5px] leading-relaxed">{requirements.notes}</p>
        </div>
      ) : null}

      <div className="shiro shiro-soft mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-baseline justify-between">
          <span className="eyebrow">Tool calls</span>
          <span className="text-ink-3 tnum font-mono text-[10px]">{toolCalls.length}</span>
        </div>
        <div className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto">
          {toolCalls.length === 0 ? (
            <p className="text-ink-3/70 py-2 text-[12px] leading-relaxed">
              Nothing yet. Every time Priya learns something she writes it here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...toolCalls].reverse().map((t) => (
                <li key={t.id + t.at} className="rise-in bg-paper-2 rounded-sm px-2 py-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-aqua font-mono text-[11px] font-semibold">{t.name}</span>
                    <span className="text-ink-3 tnum ml-auto font-mono text-[9.5px]">
                      {String(Math.floor(t.at / 1000)).padStart(2, "0")}s
                    </span>
                  </div>
                  <code className="text-ink-3 mt-0.5 block truncate font-mono text-[10.5px]">
                    {JSON.stringify(t.args)}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
