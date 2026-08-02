import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEY, TEXT_MODEL } from "./config";
import { PROJECTS, formatInr } from "./projects";
import type { CallRecord, CallSummary, LeadRequirements } from "./types";

/**
 * Post-call analysis.
 *
 * The Live model already captured structured requirements through tool calls
 * during the conversation, so this pass is not re-extracting from scratch — it
 * reconciles those tool-captured fields against what was actually said, fills
 * gaps the agent forgot to record, and produces the human-readable summary and
 * qualification score a sales manager would want in the CRM.
 *
 * Structured output (responseSchema) is used rather than parsing free text —
 * the dashboard renders these fields directly and a malformed response would
 * break it.
 */

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "One line a sales manager could read in a list view. e.g. '3BHK Sector 150, ~1.5Cr, self-use, buying in 3 months'.",
    },
    summary: {
      type: Type.STRING,
      description:
        "4-6 sentences covering what the caller wants, what was pitched, how they reacted, and what was agreed. Write in English regardless of the call language.",
    },
    languagesUsed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Which of "Hindi", "Hinglish", "English" actually appeared in the call.',
    },
    qualification: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER, description: "0-100 likelihood this becomes a real deal." },
        band: { type: Type.STRING, enum: ["hot", "warm", "cold"] },
        reasoning: { type: Type.STRING, description: "Two sentences justifying the score, citing what they said." },
      },
      required: ["score", "band", "reasoning"],
    },
    requirements: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        phone: { type: Type.STRING },
        email: { type: Type.STRING },
        intent: { type: Type.STRING, enum: ["buy", "invest", "rent", "just_browsing", "not_interested", "unknown"] },
        preferredLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
        propertyType: { type: Type.STRING, enum: ["apartment", "villa", "plot", "commercial", "unknown"] },
        configurations: { type: Type.ARRAY, items: { type: Type.STRING } },
        budgetMinInr: { type: Type.NUMBER, description: "In rupees." },
        budgetMaxInr: { type: Type.NUMBER, description: "In rupees." },
        purpose: { type: Type.STRING, enum: ["self_use", "investment", "both", "unknown"] },
        timeline: {
          type: Type.STRING,
          enum: ["immediate", "1_3_months", "3_6_months", "6_12_months", "beyond_12_months", "unknown"],
        },
        financing: { type: Type.STRING, enum: ["loan", "self_funded", "unknown"] },
        interestedProjectIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        siteVisitRequested: { type: Type.BOOLEAN },
        siteVisitPreference: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
    },
    objections: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Concerns the caller raised — price, possession date, location, builder trust, loan. Empty if none.",
    },
    nextAction: {
      type: Type.STRING,
      description: "The single concrete next step for the human sales team, with a timeframe.",
    },
    agentNotes: {
      type: Type.STRING,
      description: "Anything useful that doesn't fit the structured fields — tone, urgency, family situation, red flags.",
    },
  },
  required: ["headline", "summary", "languagesUsed", "qualification", "requirements", "objections", "nextAction", "agentNotes"],
};

function renderTranscript(call: CallRecord): string {
  if (!call.transcript.length) return "(no speech was transcribed)";
  return call.transcript
    .filter((t) => t.text.trim())
    .map((t) => {
      const who = t.role === "agent" ? "AGENT (Priya)" : t.role === "customer" ? "CUSTOMER" : "SYSTEM";
      const ts = new Date(t.at).toISOString().slice(14, 19);
      return `[${ts}] ${who}: ${t.text.trim()}`;
    })
    .join("\n");
}

function renderToolCalls(call: CallRecord): string {
  if (!call.toolCalls.length) return "(none)";
  return call.toolCalls
    .map((t) => `- ${t.name}(${JSON.stringify(t.args)})`)
    .join("\n");
}

function renderKnownRequirements(req: LeadRequirements): string {
  const entries = Object.entries(req).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "(nothing captured during the call)";
  return entries
    .map(([k, v]) => {
      if ((k === "budgetMinInr" || k === "budgetMaxInr") && typeof v === "number") {
        return `- ${k}: ${v} (${formatInr(v)})`;
      }
      return `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`;
    })
    .join("\n");
}

const FALLBACK: CallSummary = {
  headline: "Call summary unavailable",
  summary:
    "The automatic summary could not be generated. The full transcript and the requirements captured during the call are still available below.",
  languagesUsed: [],
  qualification: { score: 0, band: "cold", reasoning: "Not scored — summarisation failed." },
  requirements: {},
  objections: [],
  nextAction: "Review the transcript manually.",
  agentNotes: "",
};

export async function summarizeCall(call: CallRecord): Promise<CallSummary> {
  if (!GEMINI_API_KEY) return { ...FALLBACK, summary: "GEMINI_API_KEY is not configured on the server." };

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `You are a sales operations analyst at Aarambh Realty. Below is a completed call
between our AI calling agent "Priya" and a prospective buyer. Produce the CRM record for it.

The call may be in Hindi, Hinglish or English. **Write all of your output in English**, but quote
the caller's own words where a phrase matters.

## Transcript
${renderTranscript(call)}

## Tool calls the agent made during the conversation
${renderToolCalls(call)}

## Requirements the agent captured live
${renderKnownRequirements(call.requirements)}

## Our project catalogue (for resolving interestedProjectIds)
${PROJECTS.map((p) => `- ${p.id}: ${p.name}, ${p.locality} ${p.city}, ${p.priceRangeLabel}, ${p.propertyType}`).join("\n")}

## How to fill it in

- Start from the live-captured requirements above; correct them against the transcript and fill
  anything the agent missed. If the caller changed their mind mid-call, record the FINAL answer.
- Budgets go in **rupees**: 1 crore = 10000000, 75 lakh = 7500000.
- Leave a field out entirely if it genuinely was not established. Do not guess a budget or a
  timeline that was never discussed, and never invent a phone number.
- Score the lead honestly:
    hot (70-100)  — clear budget, clear location, buying within 3 months, gave contact details,
                    or booked a site visit
    warm (35-69)  — real interest but a soft timeline, a vague budget, or missing contact details
    cold (0-34)   — browsing, not interested, wrong number, or the call ended before qualifying
- \`objections\` should quote the actual concern, not a category. "Possession December 2027 is too
  far out, wants ready-to-move" beats "possession concern".
- \`nextAction\` must be something a human can execute tomorrow morning.`;

  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SUMMARY_SCHEMA,
        temperature: 0.3,
        // 2.5 Flash thinks by default; this is a short structured extraction and
        // the latency isn't worth it.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = res.text;
    if (!text) return FALLBACK;

    const parsed = JSON.parse(text) as CallSummary;

    // Never let the model's version of a field overwrite something the agent
    // explicitly captured via a tool call during the conversation.
    parsed.requirements = { ...parsed.requirements, ...stripEmpty(call.requirements) };
    parsed.qualification.score = Math.max(0, Math.min(100, Math.round(parsed.qualification.score ?? 0)));
    return parsed;
  } catch (err) {
    return {
      ...FALLBACK,
      summary: `Summarisation failed: ${err instanceof Error ? err.message : String(err)}`,
      requirements: call.requirements,
    };
  }
}

function stripEmpty(req: LeadRequirements): LeadRequirements {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(req)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as LeadRequirements;
}
