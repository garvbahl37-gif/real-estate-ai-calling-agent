/**
 * Not marked `server-only`: this module is shared between the API routes and
 * the eval CLI, and that guard throws under a plain Node runner. Nothing here
 * holds a secret directly — credentials come from ./config, which is only ever
 * reached from server code.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEYS, TEXT_MODEL_FALLBACKS, isQuotaError } from "./config";
import type { CallRecord, SentimentLabel, SentimentTrajectory } from "./types";

/**
 * How the caller's engagement moved across the call.
 *
 * A single end-of-call sentiment label is nearly useless — everyone is polite
 * at the end. What a sales manager can act on is the *shape*: warm opening that
 * cooled at the price, or a sceptical start that turned once possession was
 * explained. That tells you what to change on the next call.
 */

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    points: {
      type: Type.ARRAY,
      description: "One reading per caller turn, in order.",
      items: {
        type: Type.OBJECT,
        properties: {
          turnIndex: { type: Type.NUMBER, description: "Index of the caller turn, starting at 0." },
          label: { type: Type.STRING, enum: ["engaged", "neutral", "hesitant", "annoyed", "disengaged"] },
          score: { type: Type.NUMBER, description: "-1 (cold) to +1 (warm)." },
        },
        required: ["turnIndex", "label", "score"],
      },
    },
    note: {
      type: Type.STRING,
      description:
        "One sentence a sales manager can act on: where the call turned and why. Cite the moment.",
    },
  },
  required: ["points", "note"],
};

export async function analyseSentiment(call: CallRecord): Promise<SentimentTrajectory | undefined> {
  const callerTurns = call.transcript.filter((t) => t.role === "customer" && t.text.trim());
  // Two turns is not a trajectory.
  if (callerTurns.length < 3 || !GEMINI_API_KEYS.length) return undefined;

  const dialogue = call.transcript
    .filter((t) => t.text.trim())
    .map((t) => `${t.role === "agent" ? "AGENT" : "CALLER"}: ${t.text.trim()}`)
    .join("\n");

  const prompt = `Read this real-estate sales call and rate the CALLER's engagement at each of their
turns. The call may be in Hindi, Hinglish or English.

Judge engagement, not politeness. Indian callers stay courteous even when they have lost interest —
"haan haan theek hai", short flat answers, and stalling ("main sochta hoon", "baad mein baat karte
hain") are disengagement however warmly they are said. Genuine engagement looks like asking
unprompted questions, volunteering detail, negotiating, or committing to a next step.

## Call
${dialogue}`;

  for (const model of TEXT_MODEL_FALLBACKS) {
    for (const apiKey of GEMINI_API_KEYS) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        if (!res.text) continue;
        const parsed = JSON.parse(res.text) as { points: SentimentTrajectory["points"]; note: string };
        const points = (parsed.points ?? [])
          .map((p) => ({ ...p, score: Math.max(-1, Math.min(1, p.score)) }))
          .sort((a, b) => a.turnIndex - b.turnIndex);
        if (!points.length) return undefined;

        const first = points[0];
        const last = points[points.length - 1];
        return {
          points,
          drift: Number((last.score - first.score).toFixed(2)),
          opening: first.label as SentimentLabel,
          closing: last.label as SentimentLabel,
          note: parsed.note ?? "",
        };
      } catch (err) {
        if (!isQuotaError(err instanceof Error ? err.message : String(err))) return undefined;
      }
    }
  }
  return undefined;
}
