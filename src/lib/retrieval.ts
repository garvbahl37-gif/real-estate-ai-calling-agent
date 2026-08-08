/**
 * Semantic search over the catalogue.
 *
 * The deterministic scorer in agent-tools handles what it is good at — budget
 * bands, configurations, property type. Those are numeric constraints and a
 * vector search would only make them fuzzy. What it cannot do is understand a
 * requirement expressed in prose: "somewhere quiet for my parents", "close to
 * the new airport", "good rental demand from students". Those are semantic, and
 * substring matching on a locality name will never find them.
 *
 * So the two are combined rather than swapped: embeddings retrieve on meaning,
 * the scorer enforces the hard constraints, and neither is asked to do the
 * other's job.
 *
 * Vectors are precomputed at build time (pnpm embeddings) and committed, so a
 * cold serverless invocation does not pay to re-embed fifteen documents.
 */
import embeddings from "./catalogue-embeddings.json";

export interface EmbeddedProject {
  id: string;
  /** The text that was embedded, kept so the index can be audited. */
  document: string;
  vector: number[];
}

export interface SemanticHit {
  projectId: string;
  similarity: number;
}

const INDEX = embeddings as unknown as { model: string; builtAt: string; projects: EmbeddedProject[] };

export function indexInfo() {
  return { model: INDEX.model, builtAt: INDEX.builtAt, count: INDEX.projects.length };
}

export function hasIndex(): boolean {
  return INDEX.projects.length > 0;
}

/** Vectors are unit-normalised at build time, so this is just a dot product. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export function searchByVector(queryVector: number[], topK = 5): SemanticHit[] {
  return INDEX.projects
    .map((p) => ({ projectId: p.id, similarity: Number(cosine(queryVector, p.vector).toFixed(4)) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * The text each project is embedded as.
 *
 * Deliberately prose rather than a field dump: the queries this has to match
 * are prose too, and "45,000 sq ft clubhouse, Olympic pool, football turf"
 * embeds closer to "somewhere with good facilities for kids" than a JSON blob
 * of the same facts does.
 */
export function projectDocument(p: {
  name: string;
  tagline: string;
  locality: string;
  city: string;
  microMarket: string;
  propertyType: string;
  status: string;
  priceRangeLabel: string;
  possession: string;
  amenities: string[];
  locationAdvantages: { label: string; distance: string }[];
  usps: string[];
  bestFor: string[];
}): string {
  return [
    `${p.name} is a ${p.propertyType} project in ${p.locality}, ${p.city} (${p.microMarket}).`,
    p.tagline,
    `Price band ${p.priceRangeLabel}. Status: ${p.status.replace(/_/g, " ")}. Possession: ${p.possession}.`,
    `Suited to: ${p.bestFor.join(", ").replace(/_/g, " ")} buyers.`,
    `Amenities include ${p.amenities.join(", ")}.`,
    `Nearby: ${p.locationAdvantages.map((l) => `${l.label} (${l.distance})`).join(", ")}.`,
    `Why buyers choose it: ${p.usps.join(" ")}`,
  ].join(" ");
}
