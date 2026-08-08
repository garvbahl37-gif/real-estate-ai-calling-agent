import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEYS, TEXT_MODEL_FALLBACKS, isQuotaError } from "./config";
import { PROJECTS, formatInr, getProject } from "./projects";
import type { CallRecord, ClaimVerdict, FactClaim, GroundednessReport } from "./types";

/**
 * Checks what the agent actually said against what the catalogue actually says.
 *
 * The split matters. A model is good at *finding* assertions in a transcript
 * and bad at adjudicating them — asking "is this true?" just gets you a second
 * opinion with the same blind spots. So extraction is the only part delegated:
 * the model returns quoted claims with a normalised value, and the verdict is
 * computed here against the real data.
 *
 * This is not a nicety in Indian real estate. A misquoted possession date or a
 * fabricated RERA registration is a regulatory problem, not a typo, and the
 * agent's guardrails against it are prompt instructions — which are guidance,
 * not enforcement. This is the part that can actually catch a breach.
 */

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      description: "Every checkable factual assertion the AGENT made. Ignore anything the caller said.",
      items: {
        type: Type.OBJECT,
        properties: {
          quote: { type: Type.STRING, description: "Her exact words, trimmed to the assertion." },
          claim: { type: Type.STRING, description: "The assertion in plain English." },
          kind: {
            type: Type.STRING,
            enum: ["price", "possession", "distance", "amenity", "rera", "availability", "other"],
          },
          projectId: {
            type: Type.STRING,
            description: "Catalogue id the claim is about, if identifiable. Omit if she named no project.",
          },
          /** Parsed so the verdict can be computed rather than guessed. */
          numericValueInr: {
            type: Type.NUMBER,
            description: "For price claims only: the figure in RUPEES. 1.5 crore = 15000000.",
          },
          subject: {
            type: Type.STRING,
            description:
              "For price claims, the configuration quoted (e.g. '3BHK'). For amenity or distance claims, the " +
              "thing named (e.g. 'clubhouse', 'Jewar Airport').",
          },
        },
        required: ["quote", "claim", "kind"],
      },
    },
  },
  required: ["claims"],
};

interface ExtractedClaim {
  quote: string;
  claim: string;
  kind: FactClaim["kind"];
  projectId?: string;
  numericValueInr?: number;
  subject?: string;
}

/* ------------------------------------------------------------------ */
/* Deterministic verification                                          */
/* ------------------------------------------------------------------ */

/** Prices are quoted approximately on a call; this is the tolerance. */
const PRICE_TOLERANCE = 0.06;

function verify(c: ExtractedClaim): { verdict: ClaimVerdict; evidence?: string; note?: string } {
  const project = c.projectId ? getProject(c.projectId) : undefined;

  if (c.projectId && !project) {
    return {
      verdict: "contradicted",
      note: `No project "${c.projectId}" exists in the catalogue.`,
    };
  }

  switch (c.kind) {
    case "price": {
      if (!project || c.numericValueInr == null) return { verdict: "unverifiable" };
      const wanted = c.subject?.toUpperCase().replace(/\s/g, "");
      const units = wanted
        ? project.units.filter((u) => u.configuration.toUpperCase() === wanted)
        : project.units;
      if (!units.length) {
        return {
          verdict: "contradicted",
          evidence: `${project.name} has no ${c.subject}`,
          note: "Quoted a configuration this project does not offer.",
        };
      }
      // A quoted figure should sit inside some unit's band, within tolerance.
      const ok = units.some(
        (u) =>
          c.numericValueInr! >= u.priceMinInr * (1 - PRICE_TOLERANCE) &&
          c.numericValueInr! <= u.priceMaxInr * (1 + PRICE_TOLERANCE),
      );
      const bands = units.map((u) => `${u.configuration} ${formatInr(u.priceMinInr)}–${formatInr(u.priceMaxInr)}`);
      return ok
        ? { verdict: "grounded", evidence: bands.join(", ") }
        : {
            verdict: "contradicted",
            evidence: bands.join(", "),
            note: `Quoted ${formatInr(c.numericValueInr)}, outside every band for this configuration.`,
          };
    }

    case "possession": {
      if (!project) return { verdict: "unverifiable" };
      // Compare the years and months named against the catalogue string.
      const said = c.claim.toLowerCase() + " " + c.quote.toLowerCase();
      const catalogue = project.possession.toLowerCase();
      const years = [...said.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]);
      const readyClaim = /ready.to.move|immediate|possession mil chuk|oc (aa|received)/.test(said);
      if (readyClaim) {
        return project.status === "ready_to_move"
          ? { verdict: "grounded", evidence: project.possession }
          : { verdict: "contradicted", evidence: project.possession, note: "Called an under-construction project ready to move." };
      }
      if (!years.length) return { verdict: "unverifiable", evidence: project.possession };
      const allPresent = years.every((y) => catalogue.includes(y));
      return allPresent
        ? { verdict: "grounded", evidence: project.possession }
        : { verdict: "contradicted", evidence: project.possession, note: `Named ${years.join(", ")}.` };
    }

    case "rera": {
      if (!project) return { verdict: "unverifiable" };
      // The agent may say a project is registered — true in the catalogue — but
      // must never claim to have verified the number itself.
      const overclaims = /verified|confirm(ed)? (the )?rera|checked (the )?rera/i.test(c.quote);
      return overclaims
        ? {
            verdict: "unsupported",
            evidence: project.reraId,
            note: "Claimed the registration was verified. The number is a placeholder in this demo.",
          }
        : { verdict: "grounded", evidence: project.reraId };
    }

    case "amenity": {
      if (!project || !c.subject) return { verdict: "unverifiable" };
      const needle = c.subject.toLowerCase();
      const hit = project.amenities.find((a) => a.toLowerCase().includes(needle) || needle.includes(a.toLowerCase()));
      return hit
        ? { verdict: "grounded", evidence: hit }
        : {
            verdict: "unsupported",
            evidence: project.amenities.slice(0, 5).join(", ") + "…",
            note: `"${c.subject}" is not in this project's amenity list.`,
          };
    }

    case "distance": {
      if (!project || !c.subject) return { verdict: "unverifiable" };
      const needle = c.subject.toLowerCase();
      const hit = project.locationAdvantages.find(
        (l) => l.label.toLowerCase().includes(needle) || needle.includes(l.label.toLowerCase().split(" ")[0]),
      );
      return hit
        ? { verdict: "grounded", evidence: `${hit.label} — ${hit.distance}` }
        : {
            verdict: "unsupported",
            evidence: project.locationAdvantages.map((l) => l.label).join(", "),
            note: `No recorded distance to "${c.subject}".`,
          };
    }

    case "availability": {
      if (!project || !c.subject) return { verdict: "unverifiable" };
      const wanted = c.subject.toUpperCase().replace(/\s/g, "");
      const unit = project.units.find((u) => u.configuration.toUpperCase() === wanted);
      if (!unit) {
        return { verdict: "contradicted", note: `${project.name} has no ${c.subject}.` };
      }
      return unit.available
        ? { verdict: "grounded", evidence: `${unit.configuration} is available` }
        : { verdict: "contradicted", evidence: `${unit.configuration} is sold out`, note: "Offered sold-out inventory." };
    }

    default:
      return { verdict: "unverifiable" };
  }
}

/* ------------------------------------------------------------------ */

function agentSpeech(call: CallRecord): string {
  return call.transcript
    .filter((t) => t.role === "agent" && t.text.trim())
    .map((t, i) => `${i + 1}. ${t.text.trim()}`)
    .join("\n");
}

export async function checkGroundedness(call: CallRecord): Promise<GroundednessReport | undefined> {
  const speech = agentSpeech(call);
  if (!speech || !GEMINI_API_KEYS.length) return undefined;

  const prompt = `Below is everything an AI real-estate agent said on a call. Extract every
**checkable factual assertion she made** — a price, a possession date, a distance, an amenity, a
RERA status, or whether something is available.

Do NOT extract:
- anything the caller said
- questions she asked
- pleasantries, opinions or sales language ("bahut badhiya area hai", "ye achha option hai")
- vague statements with no checkable value ("prices have been rising")

The call may be in Hindi, Hinglish or English. Quote her words as spoken; write the \`claim\` in
English. For prices, convert to rupees: 1.5 crore = 15000000, 95 lakh = 9500000.

Catalogue ids you may attribute claims to:
${PROJECTS.map((p) => `- ${p.id}: ${p.name}, ${p.locality}`).join("\n")}

## What she said
${speech}`;

  let extracted: ExtractedClaim[] | undefined;

  outer: for (const model of TEXT_MODEL_FALLBACKS) {
    for (const apiKey of GEMINI_API_KEYS) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: EXTRACTION_SCHEMA,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        if (!res.text) continue;
        extracted = (JSON.parse(res.text) as { claims: ExtractedClaim[] }).claims ?? [];
        break outer;
      } catch (err) {
        if (!isQuotaError(err instanceof Error ? err.message : String(err))) break outer;
      }
    }
  }

  if (!extracted) return undefined;

  const claims: FactClaim[] = extracted.map((c) => {
    const { verdict, evidence, note } = verify(c);
    return { quote: c.quote, claim: c.claim, kind: c.kind, projectId: c.projectId, verdict, evidence, note };
  });

  const grounded = claims.filter((c) => c.verdict === "grounded").length;
  const unsupported = claims.filter((c) => c.verdict === "unsupported").length;
  const contradicted = claims.filter((c) => c.verdict === "contradicted").length;
  const checkable = grounded + unsupported + contradicted;

  return {
    claims,
    grounded,
    unsupported,
    contradicted,
    // Unverifiable claims are excluded rather than counted against her — the
    // score should measure accuracy, not how much of the call was checkable.
    // A contradiction costs the full weight; an unsupported claim, half.
    score: checkable === 0 ? 100 : Math.round(((grounded + unsupported * 0.5) / checkable) * 100),
    checkedAt: new Date().toISOString(),
  };
}
