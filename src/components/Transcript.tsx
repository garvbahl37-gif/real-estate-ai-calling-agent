"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import { projectFromToolArgs } from "@/lib/presentation";
import type { Project, ToolInvocation, TranscriptTurn } from "@/lib/types";
import { ProjectBubbleCard } from "@/components/ProjectBubbleCard";
import { Avatar, PriyaAvatar } from "@/components/ui";

/** Devanagari codepoint range — used to switch the type treatment per turn. */
const DEVANAGARI = /[ऀ-ॿ]/;

function scriptOf(text: string): "devanagari" | "latin" | "mixed" {
  const hasDev = DEVANAGARI.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasDev && hasLatin) return "mixed";
  if (hasDev) return "devanagari";
  return "latin";
}

function langLabel(turn: TranscriptTurn): string | null {
  const s = scriptOf(turn.text);
  if (s === "mixed") return "Hinglish";
  if (s === "devanagari") return "Hindi";
  if (turn.languageCode?.startsWith("hi")) return "Hindi (romanised)";
  return null;
}

function stamp(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Pins each `get_project_details` result to the first thing Priya said after
 * it ran — that is the turn in which she is talking about it. Each project is
 * shown once, the first time she looks it up.
 */
function projectCardsByTurn(turns: TranscriptTurn[], toolCalls: ToolInvocation[] | undefined) {
  const out = new Map<string, Project[]>();
  if (!toolCalls?.length) return out;
  const seen = new Set<string>();
  for (const call of toolCalls) {
    if (call.name !== "get_project_details") continue;
    const project = projectFromToolArgs(call.args);
    if (!project || seen.has(project.id)) continue;
    const turn = turns.find((t) => t.role === "agent" && t.at >= call.at - 500);
    if (!turn) continue;
    seen.add(project.id);
    out.set(turn.id, [...(out.get(turn.id) ?? []), project]);
  }
  return out;
}

export function Transcript({
  turns,
  toolCalls,
  thinking,
  emptyHint,
  follow = true,
  className,
}: {
  turns: TranscriptTurn[];
  toolCalls?: ToolInvocation[];
  thinking?: boolean;
  emptyHint?: string;
  /** Stick to the newest turn. Off for a finished call, which should open at its first line. */
  follow?: boolean;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(follow);
  const cards = useMemo(() => projectCardsByTurn(turns, toolCalls), [turns, toolCalls]);

  // Follow the conversation, but stop fighting the user if they scroll back.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, thinking, cards]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div ref={scroller} onScroll={onScroll} className={cn("thin-scroll overflow-y-auto", className)}>
      {turns.length === 0 && !thinking ? (
        <p className="text-ink-3 px-2 py-10 text-center text-[13px] leading-relaxed">{emptyHint}</p>
      ) : null}

      <div className="space-y-4 pb-2">
        {turns.map((turn) => {
          const isAgent = turn.role === "agent";
          const script = scriptOf(turn.text);
          const lang = langLabel(turn);
          return (
            <div key={turn.id} className={cn("rise-in flex items-start gap-2.5", !isAgent && "flex-row-reverse")}>
              {isAgent ? <PriyaAvatar size={30} className="mt-5" /> : <Avatar name="Caller" size={30} className="mt-5" />}
              {/* The first <span> in this column is the speaker — the e2e scripts read it. */}
              <div className={cn("flex min-w-0 flex-1 flex-col", isAgent ? "items-start" : "items-end")}>
                <div className={cn("mb-1 flex items-baseline gap-2 px-1", !isAgent && "flex-row-reverse")}>
                  <span className="text-ink text-[12px] font-semibold">{isAgent ? "Priya" : "Caller"}</span>
                  <span className="text-ink-3 tnum font-mono text-[10.5px]">{stamp(turn.at)}</span>
                  {lang ? (
                    <span className="bg-ice text-navy rounded-full px-1.5 py-px text-[10px] font-medium">{lang}</span>
                  ) : null}
                </div>
                <p
                  data-turn={isAgent ? "agent" : "caller"}
                  className={cn(
                    "max-w-[min(560px,92%)] rounded-[18px] px-4 py-2.5 text-[14.5px] leading-[1.6]",
                    isAgent ? "text-ink rounded-tl-[6px] bg-white" : "bg-cobalt rounded-tr-[6px] text-white",
                    // Devanagari needs more room between lines than Latin does.
                    script !== "latin" && "text-[15.5px] leading-[1.85]",
                    turn.partial && "opacity-70",
                  )}
                >
                  {turn.text}
                  {turn.partial ? (
                    <span
                      className={cn("ml-0.5 inline-block h-[1em] w-[2px] align-middle", isAgent ? "bg-ink/40" : "bg-white/60")}
                    />
                  ) : null}
                </p>
                {isAgent ? cards.get(turn.id)?.map((p) => <ProjectBubbleCard key={p.id} project={p} />) : null}
              </div>
            </div>
          );
        })}

        {thinking ? (
          <div className="flex items-center gap-2.5">
            <PriyaAvatar size={30} />
            <div className="flex items-center gap-1.5 rounded-[18px] rounded-tl-[6px] bg-white px-4 py-3.5">
              <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
              <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
              <span className="bg-cobalt thinking-dot h-1.5 w-1.5 rounded-full" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
