import { PROJECTS, getProject } from "./projects";
import type { LeadRequirements, Project } from "./types";

/**
 * Display-only facts for the redesigned pages: which photograph a project gets,
 * how far along construction is drawn, where it sits on the map.
 *
 * None of this is in the agent's catalogue and none of it reaches her prompt,
 * which is deliberate — she sells from `projects.ts` alone. Like the catalogue
 * itself it is fictional, and the photographs are representative stock
 * (Unsplash), not the projects.
 */

export interface Photo {
  src: string;
  alt: string;
}

export const PHOTOS = {
  heroTower: {
    src: "/images/hero-tower-dusk.jpg",
    alt: "Representative image: the glass-and-louvre facade of a residential tower against an evening sky",
  },
  tower: { src: "/images/exterior-tower.jpg", alt: "Representative image: a white apartment tower with balconies" },
  tower2: { src: "/images/exterior-tower2.jpg", alt: "Representative image: a modern apartment block with dark window frames" },
  tower3: { src: "/images/exterior-tower3.jpg", alt: "Representative image: an apartment building with timber-clad upper floors" },
  villa: { src: "/images/exterior-villa.jpg", alt: "Representative image: a white villa with a pool and lawn" },
  office: { src: "/images/exterior-office.jpg", alt: "Representative image: a curved glass office building" },
  office2: { src: "/images/exterior-office2.jpg", alt: "Representative image: a stone and glass office building" },
  bedroom: { src: "/images/interior-bedroom.jpg", alt: "Representative interior: bedroom" },
  living: { src: "/images/interior-living.jpg", alt: "Representative interior: living room" },
  kitchen: { src: "/images/interior-kitchen.jpg", alt: "Representative interior: kitchen" },
} satisfies Record<string, Photo>;

/** Stable per project, so a project keeps its picture and neighbours in a grid differ. */
function pick<T>(id: string, from: T[]): T {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return from[h % from.length];
}

/** Plots get no photograph — a picture of a house would be selling something that is not there. */
export function exteriorFor(p: Project): Photo | null {
  if (p.propertyType === "villa") return PHOTOS.villa;
  if (p.propertyType === "commercial") return pick(p.id, [PHOTOS.office, PHOTOS.office2]);
  if (p.propertyType === "plot") return null;
  // The flagship keeps the tower the catalogue hero is built around.
  if (p.id === "skyline-greens") return PHOTOS.tower;
  return pick(p.id, [PHOTOS.tower, PHOTOS.tower2, PHOTOS.tower3]);
}

export const INTERIORS: Photo[] = [PHOTOS.bedroom, PHOTOS.living, PHOTOS.kitchen];

/* ------------------------------------------------------------------ */
/* Construction ring                                                   */
/* ------------------------------------------------------------------ */

/** Illustrative, like the projects. Only the under-construction ones need a number. */
const CONSTRUCTION_PCT: Record<string, number> = {
  "skyline-greens": 58,
  "villa-grande": 64,
  meadows: 41,
  "sports-city": 33,
};

export function construction(p: Project): { pct: number; label: string } {
  if (p.status === "ready_to_move") return { pct: 100, label: "Completed" };
  if (p.status === "new_launch") return { pct: 4, label: "New launch" };
  return { pct: CONSTRUCTION_PCT[p.id] ?? 50, label: "Construction" };
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

/** The first "Month YYYY" in the possession line — phase 1 where there are phases. */
export function possessionDate(p: Project): string | null {
  const m = p.possession.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{4})\\b`));
  return m ? `${m[1]} ${m[2]}` : null;
}

export function possessionShort(p: Project): string {
  if (p.status === "ready_to_move") return "Ready to move";
  const d = possessionDate(p);
  return d ? `Possession ${d.slice(0, 3)} ${d.slice(-4)}` : "Possession on request";
}

/** A short line in her voice, built from the same possession field she quotes on a call. */
export function priyaLine(p: Project): string {
  if (p.status === "ready_to_move") return "Ready to move hai — OC aa chuka hai.";
  const d = possessionDate(p);
  return d ? `Possession ${d} hai.` : "Possession date main confirm karke bataungi.";
}

/** ₹1.35 Cr, ₹95 L — the short form a price takes on a card. */
function compact(n: number): { v: string; unit: "Cr" | "L" } {
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
  return n >= 10_000_000 ? { v: trim(n / 10_000_000), unit: "Cr" } : { v: trim(n / 100_000), unit: "L" };
}

/** "₹1.35–1.65 Cr", or "₹95 L–1.15 Cr" when the ends sit in different units. */
export function compactRange(min: number, max: number): string {
  const a = compact(min);
  const b = compact(max);
  if (min === max) return `₹${a.v} ${a.unit}`;
  return a.unit === b.unit ? `₹${a.v}–${b.v} ${b.unit}` : `₹${a.v} ${a.unit}–${b.v} ${b.unit}`;
}

export function configurations(p: Project): string[] {
  return Array.from(new Set(p.units.filter((u) => u.available).map((u) => u.configuration)));
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

/** Approximate centres of each project's sector. Good to a few hundred metres, which is all a dot map needs. */
export const PROJECT_COORDS: Record<string, [lat: number, lng: number]> = {
  "skyline-greens": [28.431, 77.479],
  "riverfront-residences": [28.517, 77.355],
  "villa-grande": [28.421, 77.492],
  "studio-one": [28.502, 77.41],
  "corporate-square": [28.627, 77.364],
  pinnacle: [28.548, 77.323],
  meadows: [28.499, 77.423],
  urbania: [28.596, 77.442],
  "sunrise-heights": [28.606, 77.452],
  "sports-city": [28.357, 77.543],
  "knowledge-park-residency": [28.576, 77.471],
  "green-acres": [28.351, 77.552],
  aerocity: [28.343, 77.561],
  "industrial-park": [28.318, 77.583],
  "riverside-indirapuram": [28.641, 77.371],
};

export const MARKET_CENTRES: { match: RegExp; label: string; at: [number, number] }[] = [
  { match: /indirapuram/i, label: "Indirapuram", at: [28.641, 77.371] },
  { match: /ghaziabad/i, label: "Ghaziabad", at: [28.668, 77.45] },
  { match: /noida extension|greater noida west|gr\.? noida west/i, label: "Greater Noida West", at: [28.598, 77.445] },
  { match: /yamuna|yeida|jewar/i, label: "Yamuna Expressway", at: [28.345, 77.555] },
  { match: /greater noida|gr\.? noida/i, label: "Greater Noida", at: [28.468, 77.512] },
  { match: /expressway/i, label: "Noida Expressway", at: [28.49, 77.41] },
  { match: /noida/i, label: "Noida", at: [28.57, 77.33] },
];

/**
 * Where to drop a lead's pin: the project they were matched to, else the first
 * place they named that we can resolve, else nowhere. Never a guess.
 */
export function leadLocation(req: LeadRequirements): [number, number] | null {
  const pid = req.interestedProjectIds?.find((id) => PROJECT_COORDS[id]);
  if (pid) return PROJECT_COORDS[pid];
  for (const place of req.preferredLocations ?? []) {
    const sector = place.match(/sector\s*(\d+[a-z]?)/i)?.[1]?.toLowerCase();
    if (sector) {
      const hit = PROJECTS.find((p) => p.locality.toLowerCase().includes(`sector ${sector}`));
      if (hit && PROJECT_COORDS[hit.id]) return PROJECT_COORDS[hit.id];
    }
    const byName = PROJECTS.find((p) => place.toLowerCase().includes(p.locality.toLowerCase()));
    if (byName && PROJECT_COORDS[byName.id]) return PROJECT_COORDS[byName.id];
    const market = MARKET_CENTRES.find((m) => m.match.test(place));
    if (market) return market.at;
  }
  return null;
}

export function projectFromToolArgs(args: Record<string, unknown>): Project | undefined {
  const id = typeof args.projectId === "string" ? args.projectId : undefined;
  return id ? getProject(id) : undefined;
}
