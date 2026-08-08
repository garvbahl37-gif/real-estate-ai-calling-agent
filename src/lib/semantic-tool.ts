/**
 * The one tool that has to touch the network.
 *
 * Everything else in the executor is pure and instant, deliberately — a
 * database round-trip inside a tool call is audible on a voice call as a stall.
 * This one embeds the caller's own words, which cannot be precomputed, so it
 * pays ~150 ms once. That is worth it for the queries structured filters cannot
 * express: "somewhere quiet for my parents", "good rental demand", "close to
 * the new airport".
 *
 * Results are capped and cached. A caller rarely phrases the same requirement
 * twice in one call, but personas in the eval suite do, and re-embedding the
 * identical string is pure waste.
 */
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEYS, isQuotaError } from "./config";
import { formatInr, getProject, operatingMarkets, unservedPlaceIn } from "./projects";
import { hasIndex, indexInfo, searchByVector } from "./retrieval";

const MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const cache = new Map<string, number[]>();

function normalise(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((n, x) => n + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}

async function embedQuery(text: string): Promise<number[] | null> {
  const key = text.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  for (const apiKey of GEMINI_API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.embedContent({
        model: MODEL,
        contents: text,
        // Must match how documents were embedded, minus the asymmetry: queries
        // use RETRIEVAL_QUERY against RETRIEVAL_DOCUMENT vectors.
        config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 },
      });
      const values = res.embeddings?.[0]?.values;
      if (values?.length) {
        const v = normalise(values);
        if (cache.size > 200) cache.clear();
        cache.set(key, v);
        return v;
      }
    } catch (err) {
      if (!isQuotaError(err instanceof Error ? err.message : String(err))) return null;
    }
  }
  return null;
}

/**
 * Below this the "match" is noise. Measured, not guessed: across a probe set of
 * relevant and irrelevant queries the relevant ones bottomed out at 0.590
 * ("somewhere quiet and green for my elderly parents") while off-topic ones —
 * a dentist appointment, the weather, a ski chalet — topped out at 0.540.
 *
 * The floor cannot do the whole job, and it is worth being precise about why.
 * Similarity does NOT separate wrong-geography queries: "office space in
 * Bangalore Koramangala" scores 0.628, above every genuinely relevant query in
 * the probe set, because a Noida commercial project really is about office
 * space — the only thing wrong is the city, which is not a semantic property.
 * No threshold, absolute or z-scored, can fix that. So geography is gated
 * deterministically below, and this floor only has to catch true off-topic.
 */
const MIN_SIMILARITY = 0.56;

export async function findProjectsByDescription(description: string) {
  if (!hasIndex()) {
    return {
      error: "The semantic index has not been built. Run `pnpm embeddings`.",
      guidance: "Use search_projects with structured filters instead.",
    };
  }

  // Geography first. Embeddings rank a Noida office park highly for "office
  // space in Bangalore" — correctly, on meaning — and offering it would read as
  // the agent inventing coverage she does not have.
  const unserved = unservedPlaceIn(description);
  if (unserved) {
    return {
      matchCount: 0,
      outOfArea: unserved,
      guidance:
        `The caller named ${unserved}, where this developer has no projects. Say so plainly, do not ` +
        `offer anything as a substitute for it, and mention that the markets served are ` +
        `${operatingMarkets().join(", ")}.`,
      results: [],
    };
  }

  const vector = await embedQuery(description);
  if (!vector) {
    return {
      error: "Could not embed the query.",
      guidance: "Fall back to search_projects with whatever structured filters you have.",
    };
  }

  const hits = searchByVector(vector, 4).filter((h) => h.similarity >= MIN_SIMILARITY);
  if (!hits.length) {
    return {
      matchCount: 0,
      guidance:
        "Nothing in the catalogue matches that description well. Say so honestly and ask a more " +
        "concrete question — budget, location or configuration — rather than guessing.",
      results: [],
    };
  }

  return {
    matchCount: hits.length,
    index: indexInfo(),
    guidance:
      "These matched on meaning, not on filters, so confirm the budget and configuration before " +
      "recommending one. Quote only the numbers returned here.",
    results: hits.map((h) => {
      const p = getProject(h.projectId)!;
      return {
        projectId: p.id,
        name: p.name,
        similarity: h.similarity,
        locality: `${p.locality}, ${p.city}`,
        propertyType: p.propertyType,
        priceRange: p.priceRangeLabel,
        possession: p.possession,
        whyItMightFit: p.usps[0],
        availableUnits: p.units
          .filter((u) => u.available)
          .map((u) => `${u.configuration} · ${formatInr(u.priceMinInr)}–${formatInr(u.priceMaxInr)}`),
      };
    }),
  };
}
