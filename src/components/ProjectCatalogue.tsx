"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatInr } from "@/lib/projects";
import type { Project } from "@/lib/types";

/**
 * The catalogue, organised along a budget axis.
 *
 * This is not a property portal — it is the agent's memory, the fixed set of
 * facts she is allowed to state on a call. So the page is built around the
 * field that most changes her answer: budget carries the heaviest weight in the
 * matcher, and "raise your budget and she recommends something else" is the
 * behaviour an interviewer will actually test.
 *
 * Hence the ladder. Every project's price band is drawn against one shared
 * scale, so the coverage and the gaps are visible at a glance, and it is
 * obvious why ₹1.5 Cr and ₹2.5 Cr land on different projects.
 */

const FLOOR = 25 * 100_000; // ₹25 L
const CEILING = 16 * 10_000_000; // ₹16 Cr

/** Log scale: the range spans 60x, and linear would crush everything under ₹1 Cr. */
function position(value: number): number {
  const t = (Math.log(value) - Math.log(FLOOR)) / (Math.log(CEILING) - Math.log(FLOOR));
  return Math.max(0, Math.min(1, t)) * 100;
}

const TICKS = [50 * 100_000, 1 * 10_000_000, 2.5 * 10_000_000, 5 * 10_000_000, 10 * 10_000_000];

const STATUS_LABEL: Record<Project["status"], string> = {
  ready_to_move: "Ready to move",
  under_construction: "Under construction",
  new_launch: "New launch",
};

type TypeFilter = "all" | Project["propertyType"];
type StatusFilter = "all" | Project["status"];

export function ProjectCatalogue({ projects }: { projects: Project[] }) {
  const [market, setMarket] = useState<string>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const markets = useMemo(() => Array.from(new Set(projects.map((p) => p.city))), [projects]);
  const types = useMemo(() => Array.from(new Set(projects.map((p) => p.propertyType))), [projects]);

  const shown = useMemo(
    () =>
      projects
        .filter((p) => market === "all" || p.city === market)
        .filter((p) => type === "all" || p.propertyType === type)
        .filter((p) => status === "all" || p.status === status)
        .sort((a, b) => a.priceMinInr - b.priceMinInr),
    [projects, market, type, status],
  );

  const reset = market !== "all" || type !== "all" || status !== "all";

  return (
    <div>
      {/* ---- Filters ---- */}
      <div className="shiro">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="eyebrow">Filter</span>
          <span className="text-ink-3 tnum font-mono text-[10px]">
            {shown.length} of {projects.length}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
        <FilterGroup
          label="Market"
          value={market}
          onChange={setMarket}
          options={[{ value: "all", label: "All" }, ...markets.map((m) => ({ value: m, label: m }))]}
        />
        <FilterGroup
          label="Type"
          value={type}
          onChange={(v) => setType(v as TypeFilter)}
          options={[{ value: "all", label: "All" }, ...types.map((t) => ({ value: t, label: t }))]}
        />
        <FilterGroup
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "ready_to_move", label: "Ready" },
            { value: "under_construction", label: "Under construction" },
            { value: "new_launch", label: "New launch" },
          ]}
        />
        {reset ? (
          <button
            onClick={() => {
              setMarket("all");
              setType("all");
              setStatus("all");
            }}
            className="text-ink-3 hover:text-ink self-end font-mono text-[11px] tracking-[0.08em] uppercase underline-offset-4 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* ---- The ladder ---- */}
      <div className="shiro shiro-soft mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="eyebrow">Price ladder</span>
          <span className="text-ink-3 text-[11.5px]">
            Each bar is one project&rsquo;s price band. Log scale — the range spans 60×.
          </span>
        </div>
      </div>

      {/* Scale ticks */}
      <div className="mt-6 hidden grid-cols-[220px_1fr] sm:grid" aria-hidden>
        <div />
        <div className="relative h-4 overflow-hidden">
          {TICKS.map((t) => (
            <span
              key={t}
              className="text-ink-3 absolute -translate-x-1/2 font-mono text-[10px]"
              style={{ left: `${position(t)}%` }}
            >
              {formatInr(t)}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-2">
        {shown.map((p) => {
          const left = position(p.priceMinInr);
          const right = position(p.priceMaxInr);
          return (
            <li key={p.id} className="border-rule-2 border-b last:border-b-0">
              <Link
                href={`/projects/${p.id}`}
                className="hover:bg-paper-2 group grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-sm px-1 py-3 transition-colors sm:grid-cols-[220px_1fr]"
              >
                <div className="min-w-0">
                  <p className="text-ink group-hover:text-aqua truncate text-[14px] font-semibold transition-colors">
                    {p.name.replace("Aarambh ", "")}
                  </p>
                  <p className="text-ink-3 truncate text-[11.5px]">
                    {p.locality} · {STATUS_LABEL[p.status]}
                  </p>
                </div>

                <div className="relative h-8 overflow-hidden">
                  {/* Track */}
                  <div className="bg-rule-2 absolute top-1/2 h-px w-full -translate-y-1/2" />
                  {/* Band */}
                  <div
                    className="bg-aqua group-hover:bg-magenta absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full transition-colors"
                    style={{ left: `${left}%`, width: `${Math.max(1.2, right - left)}%` }}
                  />
                  {/* Past ~62% the label would run off the right edge and widen
                      the page, so it flips to sit before the band end instead. */}
                  {right > 62 ? (
                    <span
                      className="text-ink-2 absolute top-1/2 -translate-y-1/2 pr-2 text-right font-mono text-[10.5px] whitespace-nowrap"
                      style={{ right: `${100 - left}%` }}
                    >
                      {p.priceRangeLabel}
                    </span>
                  ) : (
                    <span
                      className="text-ink-2 absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[10.5px] whitespace-nowrap"
                      style={{ left: `${right}%` }}
                    >
                      {p.priceRangeLabel}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {shown.length === 0 ? (
        <p className="text-ink-3 py-10 text-center text-[13.5px]">
          Nothing matches those filters. <button onClick={() => { setMarket("all"); setType("all"); setStatus("all"); }} className="text-aqua underline underline-offset-4">Clear them</button>.
        </p>
      ) : null}

      {/* ---- Cards ---- */}
      <div className="shiro mt-16">
        <span className="eyebrow">Every project</span>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="group shiro shiro-soft block">
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">{p.locality}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase",
                  p.status === "ready_to_move"
                    ? "bg-aqua-wash text-aqua"
                    : p.status === "new_launch"
                      ? "bg-magenta-wash text-magenta"
                      : "bg-paper-2 text-ink-3",
                )}
              >
                {p.status === "ready_to_move" ? "Ready" : p.status === "new_launch" ? "New" : "U/C"}
              </span>
            </div>

            <h3 className="font-display text-ink group-hover:text-aqua mt-2 text-[20px] leading-snug transition-colors">
              {p.name.replace("Aarambh ", "")}
            </h3>
            <p className="text-ink-2 mt-2 line-clamp-2 text-[13px] leading-relaxed">{p.tagline}</p>

            <p className="text-ink mt-3 font-mono text-[12.5px] font-semibold">{p.priceRangeLabel}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from(new Set(p.units.filter((u) => u.available).map((u) => u.configuration))).map((c) => (
                <span key={c} className="border-rule text-ink-2 rounded-full border px-2 py-0.5 font-mono text-[10px]">
                  {c}
                </span>
              ))}
            </div>

            <p className="text-aqua mt-4 text-[12px] font-semibold">
              Full details <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "min-h-9 rounded-full border px-3 text-[12px] font-medium capitalize transition-colors",
              value === o.value
                ? "bg-ink text-paper border-ink"
                : "border-rule text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
