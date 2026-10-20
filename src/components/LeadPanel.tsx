"use client";

import { Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { leadFields } from "@/lib/lead-fields";
import type { LeadRequirements, ToolInvocation } from "@/lib/types";
import { Meter } from "@/components/ui";

export function LeadPanel({
  requirements,
  toolCalls,
  className,
}: {
  requirements: LeadRequirements;
  toolCalls: ToolInvocation[];
  className?: string;
}) {
  const fields = leadFields(requirements);
  const filled = fields.filter((f) => f.value).length;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-ink text-[16px] font-semibold tracking-[-0.01em]">Lead record</p>
          <span className="text-ink-3 tnum text-[12px]">
            <span className="text-ink font-semibold">{filled}</span>/{fields.length} fields captured
          </span>
        </div>
        <Meter value={filled} max={fields.length} className="mt-2.5" />
      </div>

      <dl className="bg-frost mt-4 shrink-0 rounded-[18px] p-1.5">
        {fields.map((f) => (
          // Keying on the value makes React remount the row whenever the agent
          // writes a new one, which replays the CSS flash for free — no effect,
          // no timer, no state tracking what changed.
          <div
            key={`${f.key}:${f.value ?? ""}`}
            className={cn(
              "grid grid-cols-[108px_1fr] items-baseline gap-2 rounded-[12px] px-3 py-[7px]",
              f.value && "field-land bg-white",
            )}
          >
            <dt className="text-ink-3 text-[12px]">{f.label}</dt>
            <dd className={cn("text-right text-[13px] leading-snug", f.value ? "text-ink font-semibold" : "text-ink-3/50")}>
              {f.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      {requirements.notes ? (
        <div className="bg-cream mt-3 shrink-0 rounded-[14px] px-3.5 py-2.5">
          <p className="text-amber text-[11.5px] font-semibold">Agent note</p>
          <p className="text-ink-2 mt-0.5 text-[12.5px] leading-relaxed">{requirements.notes}</p>
        </div>
      ) : null}

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between">
          <p className="text-ink flex items-center gap-1.5 text-[13.5px] font-semibold">
            <Wrench className="text-cobalt h-3.5 w-3.5" aria-hidden /> Tool calls
          </p>
          <span className="bg-ice text-navy tnum rounded-full px-2 py-0.5 text-[11px] font-semibold">{toolCalls.length}</span>
        </div>
        <div className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto">
          {toolCalls.length === 0 ? (
            <p className="text-ink-3 py-2 text-[12px] leading-relaxed">
              Nothing yet. Every time Priya learns something she writes it here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...toolCalls].reverse().map((t) => (
                <li key={t.id + t.at} className="rise-in border-line-2 rounded-[12px] border bg-white px-3 py-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-cobalt font-mono text-[11px] font-semibold">{t.name}</span>
                    <span className="text-ink-3 tnum ml-auto font-mono text-[10px]">
                      {String(Math.floor(t.at / 1000)).padStart(2, "0")}s
                    </span>
                  </div>
                  <code className="text-ink-3 mt-0.5 block truncate font-mono text-[10.5px]">{JSON.stringify(t.args)}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
