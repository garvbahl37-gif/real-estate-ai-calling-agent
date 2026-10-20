import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Info, PhoneCall } from "lucide-react";
import { ProjectCatalogue } from "@/components/ProjectCatalogue";
import { ProjectHero } from "@/components/ProjectHero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Chip, btn } from "@/components/ui";
import { cn } from "@/lib/cn";
import { PROJECTS, formatInr, getProject, operatingMarkets } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — Aarambh Realty",
  description:
    "The fictional project catalogue the AI agent sells from. Every price, possession date and distance she quotes comes from here.",
};

export default function ProjectsPage() {
  const cheapest = Math.min(...PROJECTS.map((p) => p.priceMinInr));
  const dearest = Math.max(...PROJECTS.map((p) => p.priceMaxInr));
  const readyToMove = PROJECTS.filter((p) => p.status === "ready_to_move").length;
  const flagship = getProject("skyline-greens") ?? PROJECTS[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <SiteHeader current="/projects" />

      <ProjectHero project={flagship} backHref="/" backLabel="Home" />

      <Card className="px-5 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <Chip icon={<BookOpenCheck className="h-3.5 w-3.5" />}>The agent&rsquo;s knowledge base</Chip>
            <h2 className="text-ink mt-5 max-w-[18ch] text-[32px] leading-[1.08] font-medium tracking-[-0.03em] sm:text-[44px]">
              Everything Priya knows, and nothing she doesn&rsquo;t
            </h2>
          </div>
          <p className="text-ink-2 max-w-[60ch] text-[14.5px] leading-[1.7]">
            This is not a listings page. It is the fixed set of facts the agent is permitted to state on a call. A
            compact index goes into her system instruction; the full sheet is what{" "}
            <code className="bg-ice text-navy rounded-md px-1.5 py-0.5 font-mono text-[12.5px]">get_project_details</code>{" "}
            returns when a caller asks something specific. If a question is not answered here, she is instructed to say
            she will confirm — not to guess.
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: "Projects", v: String(PROJECTS.length) },
            { k: "Price range", v: `${formatInr(cheapest)} – ${formatInr(dearest)}` },
            { k: "Markets", v: String(operatingMarkets().length), note: operatingMarkets().join(" · ") },
            { k: "Ready to move", v: String(readyToMove) },
          ].map((s, i) => (
            <div key={s.k} className={cn("rounded-[20px] px-5 py-5", i === 0 ? "bg-cobalt text-white" : "wash-soft")}>
              <dt className={cn("text-[12px] font-medium", i === 0 ? "text-white/75" : "text-ink-3")}>{s.k}</dt>
              <dd className={cn("mt-2 text-[24px] leading-tight font-medium tracking-[-0.02em]", i === 0 ? "text-white" : "text-ink")}>
                {s.v}
              </dd>
              {s.note ? <dd className="text-ink-3 mt-1.5 text-[11.5px] leading-snug">{s.note}</dd> : null}
            </div>
          ))}
        </dl>

        <p className="bg-cream text-ink-2 mt-6 flex max-w-[86ch] gap-3 rounded-[18px] px-4 py-3.5 text-[13px] leading-relaxed">
          <Info className="text-amber mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="text-amber font-semibold">All fictional.</strong> Aarambh Realty and these {PROJECTS.length}{" "}
            projects were invented for this assignment. The RERA numbers are placeholders and are not real registrations,
            construction progress is illustrative, and the photographs are representative stock. No confidential or
            proprietary developer data is used anywhere in this project.
          </span>
        </p>
      </Card>

      <ProjectCatalogue projects={PROJECTS} />

      <Card className="p-2.5 sm:p-4">
        <div className="wash rounded-[22px] px-6 py-14 text-center">
          <h2 className="text-ink text-[28px] font-medium tracking-[-0.03em] sm:text-[36px]">Ask her about any of these.</h2>
          <p className="text-ink-2 mx-auto mt-3 max-w-[48ch] text-[14.5px] leading-relaxed">
            Name a budget and a sector and watch her pick. Then change the budget.
          </p>
          <Link href="/call" className={cn(btn("primary", "lg"), "mt-7")}>
            <PhoneCall className="h-4 w-4" aria-hidden />
            Start a call
          </Link>
        </div>
      </Card>

      <SiteFooter />
    </div>
  );
}
