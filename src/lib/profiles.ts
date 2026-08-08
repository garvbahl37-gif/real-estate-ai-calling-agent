import { PROJECTS } from "./projects";
import type { AgentProfile } from "./types";

/**
 * Agent profiles — who the agent is on a given call.
 *
 * A profile is not a skin. It fixes four things at once, and the fourth is the
 * one that makes it real:
 *
 *   1. identity   — the name and company she introduces herself as
 *   2. voice      — which prebuilt voice speaks
 *   3. language   — where the conversation opens
 *   4. inventory  — which projects she may sell, quote, or recommend
 *
 * Without (4) a profile is cosmetic: a "commercial desk" agent would still
 * happily pitch apartments because the tools search the whole catalogue
 * regardless of who is speaking. So the profile's project list is threaded
 * into the tool executor and the prompt's catalogue section, and the markets
 * she claims to operate in are *derived* from that list rather than configured
 * separately — otherwise a profile restricted to Noida could still tell a
 * caller the developer operates on the Yamuna Expressway.
 *
 * In a real deployment these come from a database, one row per client. Here
 * they are code, because the point is the mechanism.
 */

export const DEFAULT_PROFILE_ID = "priya-residential";

const ALL_PROJECT_IDS = PROJECTS.map((p) => p.id);

const idsWhere = (fn: (p: (typeof PROJECTS)[number]) => boolean) => PROJECTS.filter(fn).map((p) => p.id);

export const PROFILES: AgentProfile[] = [
  {
    id: DEFAULT_PROFILE_ID,
    agentName: "Priya",
    companyName: "Aarambh Realty",
    markets: [],
    voice: "Aoede",
    defaultLanguage: "hinglish",
    projectIds: ALL_PROJECT_IDS,
  },
  {
    id: "rohan-commercial",
    agentName: "Rohan",
    companyName: "Aarambh Realty",
    markets: [],
    voice: "Charon",
    defaultLanguage: "english",
    projectIds: idsWhere((p) => p.propertyType === "commercial" || p.propertyType === "plot"),
    personaNote:
      "You handle the commercial and land desk. Callers are business buyers and investors, so lead " +
      "with yield, land use, road width, power load and approvals rather than lifestyle amenities. " +
      "Be brisk and concrete; these callers dislike being sold to.",
  },
  {
    id: "meera-hindi",
    agentName: "Meera",
    companyName: "Aarambh Realty",
    markets: [],
    voice: "Kore",
    defaultLanguage: "hindi",
    projectIds: idsWhere((p) => p.propertyType === "apartment" || p.propertyType === "villa"),
    personaNote:
      "आप हिंदी-भाषी ग्राहकों के लिए हैं। सरल, बोलचाल की हिंदी में बात करें — किताबी हिंदी नहीं। " +
      "अंग्रेज़ी के वही शब्द इस्तेमाल करें जो आम बोलचाल में आते हैं (budget, sector, possession).",
  },
];

export function getProfile(id?: string): AgentProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

/**
 * The project ids a profile may sell.
 *
 * An empty or unrecognised list falls back to the whole catalogue rather than
 * to nothing. A profile misconfiguration should degrade to "sells everything",
 * which is visibly wrong in a demo, rather than to "sells nothing", which looks
 * like the agent is broken and is much harder to diagnose from a transcript.
 */
export function profileProjectIds(profile: AgentProfile): string[] {
  const valid = profile.projectIds?.filter((id) => ALL_PROJECT_IDS.includes(id)) ?? [];
  return valid.length ? valid : ALL_PROJECT_IDS;
}

export function isFullCatalogue(profile: AgentProfile): boolean {
  return profileProjectIds(profile).length === ALL_PROJECT_IDS.length;
}
