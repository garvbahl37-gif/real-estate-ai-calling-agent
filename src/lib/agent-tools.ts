import { Type, type FunctionDeclaration } from "@google/genai";
import { PROJECTS, formatInr, getProject } from "./projects";
import type { LeadRequirements, Project } from "./types";

/**
 * Function declarations handed to the Gemini Live session, plus a pure executor.
 *
 * The executor is deliberately dependency-free so the identical code path runs
 * in the browser (for the web demo) and in Node (for the Twilio bridge). It
 * never touches the network — persistence is handled by the caller reacting to
 * the returned state patch, which keeps tool latency at ~0ms. On a voice call
 * that matters: a 300ms DB round-trip inside a tool call is audible as a stall.
 */

export const AGENT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "update_lead_requirements",
    description:
      "Record or update what you have learned about the caller. Call this every time you learn " +
      "something new — name, phone, budget, location, configuration, timeline, purpose. Send only " +
      "the fields that changed. Calling this repeatedly during the call is expected and correct. " +
      "If the caller revises an earlier answer, call again with the new value.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Caller's full name as they said it." },
        phone: { type: Type.STRING, description: "Contact number, digits only, e.g. 9810012345." },
        email: { type: Type.STRING, description: "Email address if offered." },
        intent: {
          type: Type.STRING,
          enum: ["buy", "invest", "rent", "just_browsing", "not_interested", "unknown"],
          description: "What the caller is actually trying to do.",
        },
        preferredLocations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Sectors, localities or cities mentioned, e.g. ["Sector 150", "Noida Expressway"].',
        },
        propertyType: {
          type: Type.STRING,
          enum: ["apartment", "villa", "plot", "commercial", "unknown"],
        },
        configurations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'e.g. ["2BHK", "3BHK"] or ["plot"].',
        },
        budgetMinInr: {
          type: Type.NUMBER,
          description: "Lower bound in RUPEES, not lakh/crore. 1 crore = 10000000, 75 lakh = 7500000.",
        },
        budgetMaxInr: {
          type: Type.NUMBER,
          description: "Upper bound in RUPEES. If they name a single figure, set both min and max to it.",
        },
        purpose: { type: Type.STRING, enum: ["self_use", "investment", "both", "unknown"] },
        timeline: {
          type: Type.STRING,
          enum: ["immediate", "1_3_months", "3_6_months", "6_12_months", "beyond_12_months", "unknown"],
          description: "How soon they intend to purchase.",
        },
        financing: { type: Type.STRING, enum: ["loan", "self_funded", "unknown"] },
        notes: {
          type: Type.STRING,
          description: "Anything else worth passing to the human sales team — objections, family context, urgency.",
        },
      },
      required: [],
    },
  },
  {
    name: "search_projects",
    description:
      "Find projects from the Aarambh Realty catalogue that fit the caller's requirements. Call " +
      "this BEFORE recommending anything, and call it again whenever the caller changes their " +
      "budget, location or configuration. Returns matches ranked by fit, with the reason each one " +
      "matched or was excluded.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        budgetMinInr: { type: Type.NUMBER, description: "In rupees." },
        budgetMaxInr: { type: Type.NUMBER, description: "In rupees." },
        locations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Free text localities, e.g. ["Sector 150", "Noida"].',
        },
        propertyType: { type: Type.STRING, enum: ["apartment", "villa", "plot", "commercial", "unknown"] },
        configurations: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'e.g. ["3BHK"]' },
        purpose: { type: Type.STRING, enum: ["self_use", "investment", "both", "unknown"] },
      },
      required: [],
    },
  },
  {
    name: "get_project_details",
    description:
      "Get the full fact sheet for one project — every unit size and price, the complete amenity " +
      "list, all location advantages, payment plans, RERA number and possession schedule. Call " +
      "this when the caller asks something specific you do not already have in front of you.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: {
          type: Type.STRING,
          enum: PROJECTS.map((p) => p.id),
          description: "The project id returned by search_projects.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "schedule_site_visit",
    description:
      "Book a site visit once the caller has agreed to one. Confirm their name and phone number " +
      "back to them before calling this.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING, enum: PROJECTS.map((p) => p.id) },
        name: { type: Type.STRING },
        phone: { type: Type.STRING },
        preferredTime: {
          type: Type.STRING,
          description: 'Whatever they said, e.g. "Saturday morning", "kal shaam 5 baje".',
        },
      },
      required: ["projectId", "name", "phone", "preferredTime"],
    },
  },
  {
    name: "end_call",
    description:
      "Hang up. Call this only AFTER you have spoken your closing line. Do not call it while the " +
      "caller still has a question pending.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        outcome: {
          type: Type.STRING,
          enum: [
            "qualified_lead",
            "site_visit_booked",
            "callback_requested",
            "not_interested",
            "wrong_number",
            "call_back_later",
          ],
        },
        reason: { type: Type.STRING, description: "One line for the CRM." },
      },
      required: ["outcome"],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

export interface ToolExecutionResult {
  /** Sent back to the model as the function response. */
  response: Record<string, unknown>;
  /** Fields to merge into the live lead record, if any. */
  requirementsPatch?: Partial<LeadRequirements>;
  /** Signals the transport layer to tear the call down. */
  endCall?: { outcome: string; reason?: string };
}

/**
 * Words that appear in almost every Delhi-NCR address and therefore carry no
 * discriminating information on their own.
 */
const GENERIC_PLACE_WORDS = new Set([
  "sector",
  "block",
  "phase",
  "extension",
  "area",
  "road",
  "near",
  "the",
  "and",
  "plot",
  "pocket",
]);

function scoreProject(
  p: Project,
  args: {
    budgetMinInr?: number;
    budgetMaxInr?: number;
    locations?: string[];
    propertyType?: string;
    configurations?: string[];
    purpose?: string;
  },
): { score: number; reasons: string[]; blockers: string[] } {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 0;

  // Budget — the strongest signal, and the one worth getting right.
  //
  // Scoring on band overlap alone is not enough. A caller with ₹3–5 Cr asking
  // for a 3BHK would still "match" a project whose band runs ₹95 L–₹2.8 Cr,
  // because the bands touch — even though its 3BHK costs ₹1.35 Cr and is
  // nowhere near what they asked for. So the check runs against the units the
  // caller could actually buy, and proximity to their number breaks ties.
  const bMin = args.budgetMinInr;
  const bMax = args.budgetMaxInr;
  if (bMin != null || bMax != null) {
    const lo = bMin ?? 0;
    const hi = bMax ?? Number.MAX_SAFE_INTEGER;
    // Buyers routinely stretch ~12% over a stated ceiling, and quote a floor
    // slightly above what they'd really accept.
    const ceiling = hi === Number.MAX_SAFE_INTEGER ? hi : hi * 1.12;
    const floor = lo * 0.85;

    // Only consider what they asked for. If they named no configuration, every
    // available unit is fair game.
    const wanted = args.configurations?.map((c) => c.toUpperCase().replace(/\s/g, ""));
    const relevant = p.units.filter(
      (u) => u.available && (!wanted?.length || wanted.includes(u.configuration.toUpperCase())),
    );

    if (relevant.length === 0) {
      // The requested configuration is sold out or absent here. Fall back to
      // the project band so it can still be offered as an alternative, and let
      // the configuration check below explain why it's not a clean match.
      if (p.priceMinInr <= ceiling && p.priceMaxInr >= floor) score += 30;
      else {
        score -= 40;
        blockers.push(
          p.priceMinInr > hi
            ? `Starts at ${formatInr(p.priceMinInr)}, above the stated budget.`
            : `Tops out at ${formatInr(p.priceMaxInr)}, below the caller's range.`,
        );
      }
    } else {
      const inBand = relevant.filter((u) => u.priceMinInr <= ceiling && u.priceMaxInr >= floor);

      if (inBand.length) {
        score += 50;
        reasons.push(
          `${inBand.length} unit type(s) inside budget: ${inBand
            .map((u) => `${u.configuration} at ${formatInr(u.priceMinInr)}–${formatInr(u.priceMaxInr)}`)
            .join(", ")}`,
        );

        // Proximity bonus, 0–25. When only a ceiling is given, buyers tend to
        // spend near it, so the ceiling is the target rather than the midpoint.
        const target = bMin != null && bMax != null ? (lo + hi) / 2 : (bMax ?? bMin)!;
        const closest = Math.min(
          ...inBand.map((u) => Math.abs((u.priceMinInr + u.priceMaxInr) / 2 - target) / target),
        );
        score += Math.round(25 * (1 - Math.min(1, closest)));
      } else {
        score -= 40;
        const cheapest = Math.min(...relevant.map((u) => u.priceMinInr));
        const dearest = Math.max(...relevant.map((u) => u.priceMaxInr));
        blockers.push(
          cheapest > hi
            ? `The ${wanted?.join("/") ?? "available"} units here start at ${formatInr(cheapest)}, above the stated budget.`
            : `The ${wanted?.join("/") ?? "available"} units here top out at ${formatInr(dearest)}, below the caller's range.`,
        );
      }
    }
  }

  // Location: loose enough that "Sector 150", "150", "Noida Expressway" and
  // "noida" all hit, strict enough that they hit the RIGHT projects.
  //
  // The subtlety is the token fallback. Matching any word longer than two
  // characters means "Sector 150" matches every project whose address contains
  // the word "sector" — which is all of them. So generic address words are
  // dropped, and when the caller names a number that number has to be present.
  if (args.locations?.length) {
    const hay = `${p.locality} ${p.city} ${p.microMarket} ${p.name}`.toLowerCase();
    const hits = args.locations.filter((raw) => {
      const l = raw.toLowerCase().trim();
      if (!l) return false;
      if (hay.includes(l)) return true;

      // "Sector 150" must not match Sector 143B.
      const numbers = l.match(/\d+[a-z]?/g);
      if (numbers?.length) return numbers.some((n) => hay.includes(n));

      const tokens = l.split(/\s+/).filter((t) => t.length > 2 && !GENERIC_PLACE_WORDS.has(t));
      return tokens.some((t) => hay.includes(t));
    });
    if (hits.length) {
      score += 30;
      reasons.push(`Location match on ${hits.join(", ")} — project is in ${p.locality}, ${p.city}.`);
    } else {
      score -= 15;
      blockers.push(`Caller asked for ${args.locations.join("/")}; this one is in ${p.locality}, ${p.city}.`);
    }
  }

  if (args.propertyType && args.propertyType !== "unknown") {
    if (p.propertyType === args.propertyType) {
      score += 20;
      reasons.push(`Property type matches (${p.propertyType}).`);
    } else {
      score -= 30;
      blockers.push(`Caller wants a ${args.propertyType}; this is ${p.propertyType}.`);
    }
  }

  if (args.configurations?.length) {
    const wanted = args.configurations.map((c) => c.toUpperCase().replace(/\s/g, ""));
    const have = p.units.filter((u) => u.available && wanted.includes(u.configuration.toUpperCase()));
    if (have.length) {
      score += 25;
      reasons.push(
        `Has ${have.map((u) => `${u.configuration} (${u.saleableAreaSqft} sq ft, ${formatInr(u.priceMinInr)}+)`).join(", ")}.`,
      );
    } else {
      const soldOut = p.units.filter((u) => !u.available && wanted.includes(u.configuration.toUpperCase()));
      if (soldOut.length) blockers.push(`${soldOut.map((u) => u.configuration).join(", ")} is sold out here.`);
      else blockers.push(`No ${wanted.join("/")} inventory in this project.`);
      score -= 20;
    }
  }

  if (args.purpose && args.purpose !== "unknown" && p.bestFor.includes(args.purpose as never)) {
    score += 10;
    reasons.push(`Suits ${args.purpose.replace(/_/g, " ")} buyers.`);
  }

  return { score, reasons, blockers };
}

export function executeAgentTool(name: string, rawArgs: Record<string, unknown>): ToolExecutionResult {
  const args = rawArgs ?? {};

  switch (name) {
    case "update_lead_requirements": {
      // Strip undefined/empty so a partial update never wipes a known field.
      const patch: Partial<LeadRequirements> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined || v === null || v === "" || v === "unknown") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        (patch as Record<string, unknown>)[k] = v;
      }
      return {
        response: {
          ok: true,
          saved: Object.keys(patch),
          note: "Saved to CRM. Continue the conversation naturally — do not read this back to the caller.",
        },
        requirementsPatch: patch,
      };
    }

    case "search_projects": {
      const a = args as Parameters<typeof scoreProject>[1];
      const ranked = PROJECTS.map((p) => {
        const { score, reasons, blockers } = scoreProject(p, a);
        return { p, score, reasons, blockers };
      }).sort((x, y) => y.score - x.score);

      const matches = ranked.filter((r) => r.score > 0);
      const shown = (matches.length ? matches : ranked).slice(0, 3);

      return {
        response: {
          matchCount: matches.length,
          guidance: matches.length
            ? "Recommend the top match first with two or three concrete reasons. Quote real prices and possession dates."
            : "Nothing fits well. Say so honestly, offer the closest option, and take their requirement down for the team.",
          results: shown.map(({ p, score, reasons, blockers }) => ({
            projectId: p.id,
            name: p.name,
            locality: `${p.locality}, ${p.city}`,
            propertyType: p.propertyType,
            status: p.status,
            priceRange: p.priceRangeLabel,
            possession: p.possession,
            fitScore: score,
            whyItFits: reasons,
            caveats: blockers,
            availableUnits: p.units
              .filter((u) => u.available)
              .map((u) => `${u.configuration} · ${u.saleableAreaSqft} sq ft · ${formatInr(u.priceMinInr)}–${formatInr(u.priceMaxInr)}`),
            topAmenities: p.amenities.slice(0, 4),
            keyLocationAdvantage: p.locationAdvantages[0]
              ? `${p.locationAdvantages[0].label} — ${p.locationAdvantages[0].distance}`
              : undefined,
            pitchHinglish: p.pitchHinglish,
          })),
        },
        requirementsPatch: shown.length ? { interestedProjectIds: shown.slice(0, 1).map((s) => s.p.id) } : undefined,
      };
    }

    case "get_project_details": {
      const p = getProject(String(args.projectId ?? ""));
      if (!p) {
        return {
          response: {
            error: "No such project in the catalogue.",
            validIds: PROJECTS.map((x) => x.id),
            guidance: "Do not invent details. Tell the caller you'll confirm and get back to them.",
          },
        };
      }
      return {
        response: {
          projectId: p.id,
          name: p.name,
          developer: p.developer,
          tagline: p.tagline,
          address: `${p.locality}, ${p.city}`,
          microMarket: p.microMarket,
          status: p.status,
          reraId: p.reraId,
          reraNote: "Placeholder registration number for this demo — do not claim it has been verified.",
          possession: p.possession,
          priceRange: p.priceRangeLabel,
          bookingAmount: formatInr(p.bookingAmountInr),
          units: p.units.map((u) => ({
            configuration: u.configuration,
            carpetAreaSqft: u.carpetAreaSqft,
            saleableAreaSqft: u.saleableAreaSqft,
            price: `${formatInr(u.priceMinInr)} – ${formatInr(u.priceMaxInr)}`,
            available: u.available,
          })),
          amenities: p.amenities,
          locationAdvantages: p.locationAdvantages.map((l) => `${l.label} — ${l.distance}`),
          paymentPlans: p.paymentPlans,
          usps: p.usps,
          pitchHinglish: p.pitchHinglish,
          guidance:
            "Answer only what was asked — do not read this whole sheet out. Pick the two or three facts that matter to this caller.",
        },
        requirementsPatch: { interestedProjectIds: [p.id] },
      };
    }

    case "schedule_site_visit": {
      const p = getProject(String(args.projectId ?? ""));
      const when = String(args.preferredTime ?? "");
      return {
        response: {
          ok: true,
          confirmation: `Site visit noted for ${p?.name ?? "the project"} — ${when}.`,
          guidance:
            "Confirm the day and time back to the caller in one line, tell them the sales team will send the " +
            "location pin on WhatsApp, then move to closing.",
          // Flagged so nobody demoing this mistakes it for a real booking.
          simulated: true,
        },
        requirementsPatch: {
          siteVisitRequested: true,
          siteVisitPreference: when,
          name: args.name ? String(args.name) : undefined,
          phone: args.phone ? String(args.phone) : undefined,
          interestedProjectIds: p ? [p.id] : undefined,
        },
      };
    }

    case "end_call": {
      const outcome = String(args.outcome ?? "qualified_lead");
      const reason = args.reason ? String(args.reason) : undefined;
      return {
        response: { ok: true, note: "Call is ending." },
        requirementsPatch: reason ? { notes: reason } : undefined,
        endCall: { outcome, reason },
      };
    }

    default:
      return {
        response: { error: `Unknown tool "${name}".` },
      };
  }
}

/** Later values win, but a later `undefined` never clears an earlier value. */
export function mergeRequirements(
  base: LeadRequirements,
  patch: Partial<LeadRequirements> | undefined,
): LeadRequirements {
  if (!patch) return base;
  const next: LeadRequirements = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // Union for list fields — a caller can name several sectors across the call.
      const prev = (next as Record<string, unknown>)[k];
      const merged = Array.isArray(prev) ? Array.from(new Set([...prev, ...v])) : v;
      (next as Record<string, unknown>)[k] = merged;
      continue;
    }
    (next as Record<string, unknown>)[k] = v;
  }
  return next;
}
