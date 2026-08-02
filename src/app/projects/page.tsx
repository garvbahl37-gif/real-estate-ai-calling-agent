import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCatalogue } from "@/components/ProjectCatalogue";
import { SiteHeader } from "@/components/SiteHeader";
import { PROJECTS, formatInr, operatingMarkets } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — Aarambh Realty",
  description:
    "The fictional project catalogue the AI agent sells from. Every price, possession date and distance she quotes comes from here.",
};

export default function ProjectsPage() {
  const cheapest = Math.min(...PROJECTS.map((p) => p.priceMinInr));
  const dearest = Math.max(...PROJECTS.map((p) => p.priceMaxInr));
  const readyToMove = PROJECTS.filter((p) => p.status === "ready_to_move").length;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="/projects" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-24 sm:px-8">
        <div className="shiro mt-10">
          <p className="eyebrow">The agent&rsquo;s knowledge base</p>
          <h1 className="font-display text-ink mt-3 max-w-[18ch] text-[34px] leading-[1.1] sm:text-[46px]">
            Everything Priya knows, and nothing she doesn&rsquo;t.
          </h1>
          <p className="text-ink-2 mt-5 max-w-[68ch] text-[15px] leading-[1.7]">
            This is not a listings page. It is the fixed set of facts the agent is permitted to state on a call. A
            compact index goes into her system instruction; the full sheet below is what{" "}
            <code className="font-mono text-[13.5px]">get_project_details</code> returns when a caller asks something
            specific. If a question is not answered here, she is instructed to say she will confirm — not to guess.
          </p>
        </div>

        <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {[
            { k: "Projects", v: String(PROJECTS.length) },
            { k: "Price range", v: `${formatInr(cheapest)} – ${formatInr(dearest)}` },
            { k: "Markets", v: String(operatingMarkets().length), note: operatingMarkets().join(" · ") },
            { k: "Ready to move", v: String(readyToMove) },
          ].map((s) => (
            <div key={s.k} className="shiro shiro-soft">
              <dt className="eyebrow">{s.k}</dt>
              <dd className="font-display text-ink mt-1.5 text-[22px] leading-tight">{s.v}</dd>
              {s.note ? <dd className="text-ink-3 mt-1 text-[11px] leading-snug">{s.note}</dd> : null}
            </div>
          ))}
        </dl>

        <p className="border-magenta/30 bg-magenta-wash text-ink-2 mt-8 max-w-[72ch] rounded-sm border px-4 py-3 text-[13px] leading-relaxed">
          <strong className="text-magenta font-semibold">All fictional.</strong> Aarambh Realty and these fifteen
          projects were invented for this assignment. The RERA numbers are placeholders and are not real registrations.
          No confidential or proprietary developer data is used anywhere in this project.
        </p>

        <div className="mt-16">
          <ProjectCatalogue projects={PROJECTS} />
        </div>

        <div className="border-rule mt-20 border-t pt-10 text-center">
          <p className="font-display text-ink text-[24px]">Ask her about any of these.</p>
          <p className="text-ink-2 mx-auto mt-2 max-w-[48ch] text-[14px] leading-relaxed">
            Name a budget and a sector and watch her pick. Then change the budget.
          </p>
          <Link
            href="/call"
            className="bg-ink text-paper hover:bg-aqua mt-6 inline-flex min-h-12 items-center rounded-sm px-6 text-[14.5px] font-semibold transition-colors"
          >
            Start a call
          </Link>
        </div>
      </main>
    </div>
  );
}
