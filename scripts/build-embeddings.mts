/**
 * Embeds the catalogue and writes src/lib/catalogue-embeddings.json.
 *
 *   pnpm embeddings
 *
 * Run whenever a project is added or its copy changes. The output is committed
 * so a cold serverless invocation never pays to rebuild the index, and so the
 * vectors a deployment used are reviewable in the diff.
 */
import "./load-env.mts";

import { writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEYS, isQuotaError } from "../src/lib/config";
import { PROJECTS } from "../src/lib/projects";
import { projectDocument } from "../src/lib/retrieval";

const MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

/** Cosine on unit vectors is a dot product, so normalise once here. */
function normalise(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((n, x) => n + x * x, 0)) || 1;
  return v.map((x) => Number((x / mag).toFixed(6)));
}

async function embed(text: string): Promise<number[] | null> {
  for (const apiKey of GEMINI_API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.embedContent({
        model: MODEL,
        contents: text,
        // Asymmetric task types: documents and queries are embedded
        // differently, and mixing them measurably degrades retrieval.
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
      });
      const values = res.embeddings?.[0]?.values;
      if (values?.length) return normalise(values);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isQuotaError(msg)) {
        console.error("  embed failed:", msg.slice(0, 120));
        return null;
      }
    }
  }
  return null;
}

console.log(`Embedding ${PROJECTS.length} projects with ${MODEL}\n`);
const out: { id: string; document: string; vector: number[] }[] = [];

for (const p of PROJECTS) {
  const document = projectDocument(p);
  const vector = await embed(document);
  if (!vector) {
    console.error(`  ✗ ${p.id}`);
    continue;
  }
  out.push({ id: p.id, document, vector });
  console.log(`  ✓ ${p.id.padEnd(26)} ${vector.length}d`);
}

if (out.length !== PROJECTS.length) {
  console.error(`\nOnly ${out.length}/${PROJECTS.length} embedded — not writing a partial index.`);
  process.exit(1);
}

writeFileSync(
  "src/lib/catalogue-embeddings.json",
  JSON.stringify({ model: MODEL, builtAt: new Date().toISOString(), projects: out }),
);
console.log(`\n→ src/lib/catalogue-embeddings.json (${out.length} projects, ${out[0].vector.length} dimensions)`);
process.exit(0);
