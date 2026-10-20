"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInr } from "@/lib/projects";
import type { Project } from "@/lib/types";
import { ProjectCard } from "@/components/ProjectCard";
import { Chip } from "@/components/ui";

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
  const clear = () => {
    setMarket("all");
    setType("all");
    setStatus("all");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ---- Filters ---- */}
      <section className="bg-canvas rounded-card px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink flex items-center gap-2 text-[16px] font-semibold">
            <SlidersHorizontal className="text-cobalt h-4 w-4" aria-hidden /> Filter
          </p>
          <span className="text-ink-3 tnum text-[12.5px]">
            <span className="text-ink font-semibold">{shown.length}</span> of {projects.length} projects
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-5">
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
            <button onClick={clear} className="text-cobalt hover:text-cobalt-deep self-end text-[13px] font-semibold">
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {/* ---- The ladder ---- */}
      <section className="bg-canvas rounded-card px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Chip>Price ladder</Chip>
            <h2 className="text-ink mt-4 text-[26px] leading-tight font-medium tracking-[-0.025em] sm:text-[32px]">
              Why ₹1.5 Cr and ₹2.5 Cr land on different projects
            </h2>
          </div>
          <p className="text-ink-3 max-w-[40ch] text-[12.5px] leading-relaxed">
            Each bar is one project&rsquo;s price band against one shared scale. Log scale — the range spans 60×.
          </p>
        </div>

        <div className="bg-frost rounded-panel mt-8 p-3 sm:p-5">
          {/* Scale ticks */}
          <div className="hidden grid-cols-[230px_1fr] px-2 sm:grid" aria-hidden>
            <div />
            <div className="relative h-5 overflow-hidden">
              {TICKS.map((t) => (
                <span
                  key={t}
                  className="text-ink-3 absolute -translate-x-1/2 text-[11px] font-medium"
                  style={{ left: `${position(t)}%` }}
                >
                  {formatInr(t)}
                </span>
              ))}
            </div>
          </div>

          <ul className="mt-2 space-y-1.5">
            {shown.map((p) => {
              const left = position(p.priceMinInr);
              const right = position(p.priceMaxInr);
              return (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="group hover:shadow-soft grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-[14px] bg-white px-3 py-2.5 transition-shadow sm:grid-cols-[218px_1fr]"
                  >
                    <div className="min-w-0">
                      <p className="text-ink group-hover:text-cobalt truncate text-[14px] font-semibold transition-colors">
                        {p.name.replace("Aarambh ", "")}
                      </p>
                      <p className="text-ink-3 truncate text-[11.5px]">
                        {p.locality} · {STATUS_LABEL[p.status]}
                      </p>
                    </div>

                    <div className="relative h-8 overflow-hidden">
                      {/* Track */}
                      <div className="bg-line-2 absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full" />
                      {TICKS.map((t) => (
                        <span
                          key={t}
                          className="bg-line absolute top-1/2 hidden h-3 w-px -translate-y-1/2 sm:block"
                          style={{ left: `${position(t)}%` }}
                          aria-hidden
                        />
                      ))}
                      {/* Band */}
                      <div
                        className="bg-cobalt group-hover:bg-mid absolute top-1/2 h-[8px] -translate-y-1/2 rounded-full transition-colors"
                        style={{ left: `${left}%`, width: `${Math.max(1.2, right - left)}%` }}
                      />
                      {/* Past ~62% the label would run off the right edge and widen
                          the page, so it flips to sit before the band end instead. */}
                      {right > 62 ? (
                        <span
                          className="text-ink-2 absolute top-1/2 -translate-y-1/2 pr-2 text-right text-[11.5px] font-medium whitespace-nowrap"
                          style={{ right: `${100 - left}%` }}
                        >
                          {p.priceRangeLabel}
                        </span>
                      ) : (
                        <span
                          className="text-ink-2 absolute top-1/2 -translate-y-1/2 pl-2 text-[11.5px] font-medium whitespace-nowrap"
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
              Nothing matches those filters.{" "}
              <button onClick={clear} className="text-cobalt font-semibold underline underline-offset-4">
                Clear them
              </button>
              .
            </p>
          ) : null}
        </div>
      </section>

      {/* ---- Cards ---- */}
      <section className="bg-canvas rounded-card px-5 py-8 sm:px-8 sm:py-10">
        <Chip>Every project</Chip>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
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
      <span className="label">{label}</span>
      <div className="bg-frost mt-2 flex flex-wrap gap-1 rounded-[20px] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "min-h-9 rounded-full px-3.5 text-[12.5px] font-semibold capitalize transition-colors",
              value === o.value
                ? "text-cobalt bg-white shadow-[0_4px_12px_-6px_rgb(19_40_110/0.35)]"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
