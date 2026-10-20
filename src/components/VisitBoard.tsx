import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { getProject } from "@/lib/projects";
import type { CallRecord } from "@/lib/types";

/**
 * Site visits as a week board, after the Get Talky portal calendar.
 *
 * Priya records the visit the buyer asked for as free text ("Saturday
 * morning", "kal shaam", "shanivaar 11 baje") — nothing is booked anywhere.
 * So this only reads the day and time out of what was said and places the
 * card; anything it cannot place goes in "To confirm", and the board says
 * plainly that these are requests.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const PER_DAY = 4;

const DAY_WORDS: [number, RegExp][] = [
  [0, /\b(mon(day)?|somv[a]+r)\b|सोमवार/i],
  [1, /\b(tue(s|sday)?|mangalv[a]+r)\b|मंगलवार/i],
  [2, /\b(wed(nesday)?|budhv[a]+r)\b|बुधवार/i],
  [3, /\b(thu(rs|rsday)?|guruv[a]+r|brihaspativ[a]+r)\b|गुरुवार/i],
  [4, /\b(fri(day)?|shukrav[a]+r)\b|शुक्रवार/i],
  [5, /\b(sat(urday)?|shaniv[a]+r|weekend)\b|शनिवार/i],
  [6, /\b(sun(day)?|raviv[a]+r|itw[a]+r)\b|रविवार|इतवार/i],
];

/** Monday = 0, in Indian time, so a late-evening call lands on the right day. */
function weekdayIst(iso: string) {
  const d = new Date(iso);
  const name = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
  return (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 7) % 7;
}

function placeDay(pref: string, calledAt: string): number | null {
  for (const [day, re] of DAY_WORDS) if (re.test(pref)) return day;
  if (/\b(tomorrow|kal)\b|कल/i.test(pref)) return (weekdayIst(calledAt) + 1) % 7;
  if (/\b(today|aaj)\b|आज/i.test(pref)) return weekdayIst(calledAt);
  return null;
}

function placeTime(pref: string): string | null {
  const clock = pref.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)\b/i);
  if (clock) return `${clock[1]}${clock[2] ? `:${clock[2]}` : ""} ${clock[3].toLowerCase() === "baje" ? "baje" : clock[3].toLowerCase()}`;
  if (/morning|subah|सुबह/i.test(pref)) return "Morning";
  if (/afternoon|dopahar|दोपहर/i.test(pref)) return "Afternoon";
  if (/evening|shaam|sham\b|शाम/i.test(pref)) return "Evening";
  return null;
}

interface Visit {
  id: string;
  name: string;
  project?: string;
  when: string | null;
  raw: string;
  hot: boolean;
}

export function VisitBoard({ calls, className }: { calls: CallRecord[]; className?: string }) {
  const columns: Visit[][] = DAYS.map(() => []);
  const unplaced: Visit[] = [];

  for (const c of calls) {
    const req = c.summary?.requirements ?? c.requirements;
    if (!req.siteVisitRequested) continue;
    const raw = req.siteVisitPreference?.trim() || "";
    const visit: Visit = {
      id: c.id,
      name: req.name?.split(/\s+/)[0] || "Caller",
      project: req.interestedProjectIds?.map((id) => getProject(id)?.name.replace("Aarambh ", "")).find(Boolean),
      when: raw ? placeTime(raw) : null,
      raw: raw || "No time given",
      hot: c.summary?.qualification.band === "hot",
    };
    const day = raw ? placeDay(raw, c.startedAt) : null;
    (day == null ? unplaced : columns[day]).push(visit);
  }

  const total = columns.reduce((n, col) => n + col.length, unplaced.length);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink flex items-center gap-2 text-[18px] font-semibold tracking-[-0.015em]">
            <CalendarDays className="text-cobalt h-[18px] w-[18px]" aria-hidden />
            Site visits
          </p>
          <p className="text-ink-3 mt-1 text-[12.5px]">
            {total ? `${total} requested on calls` : "None requested yet"} · placed by the day and time the buyer asked for —
            requests, not bookings
          </p>
        </div>
      </div>

      <div className="thin-scroll mt-5 overflow-x-auto pb-1">
        <div className="grid min-w-[880px] grid-cols-8 gap-2">
          {[...DAYS, "To confirm"].map((d, i) => {
            const all = i < 7 ? columns[i] : unplaced;
            const items = all.slice(0, PER_DAY);
            const more = all.length - items.length;
            return (
              <div key={d} className="min-w-0">
                <p className={cn("text-center text-[12px] font-semibold", i === 7 ? "text-amber" : "text-ink-3")}>{d}</p>
                <div className={cn("mt-2 min-h-[150px] space-y-1.5 rounded-[14px] p-1.5", i === 7 ? "bg-cream/60" : "bg-frost")}>
                  {items.map((v) => (
                    <Link
                      key={v.id}
                      href={`/leads/${v.id}`}
                      title={v.raw}
                      className={cn(
                        "block rounded-[10px] px-2.5 py-2 text-[11.5px] leading-tight transition-transform hover:-translate-y-px",
                        i === 7 ? "text-ink border-line border bg-white" : v.hot ? "bg-cobalt text-white" : "bg-pale text-navy",
                      )}
                    >
                      <span className="block truncate font-semibold">{v.name}</span>
                      {v.project ? <span className="block truncate opacity-80">{v.project}</span> : null}
                      <span className="block truncate opacity-70">{i === 7 ? v.raw : (v.when ?? "Any time")}</span>
                    </Link>
                  ))}
                  {more > 0 ? (
                    <p className="text-ink-3 px-1 pt-0.5 text-center text-[11px] font-semibold">+{more} more</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
