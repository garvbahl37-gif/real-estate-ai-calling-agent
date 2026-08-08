/**
 * Not marked `server-only`: this module is shared between the API routes and
 * the eval CLI, and that guard throws under a plain Node runner. Nothing here
 * holds a secret directly — credentials come from ./config, which is only ever
 * reached from server code.
 */
import { GoogleGenAI, Type, type LiveServerMessage, type Session } from "@google/genai";
import { mergeRequirements, runAgentTool } from "../agent-tools";
import { GEMINI_API_KEYS, LIVE_MODEL, TEXT_MODEL_FALLBACKS, isQuotaError } from "../config";
import { checkGroundedness } from "../groundedness";
import { buildLiveConfig } from "../live-config";
import type { CallRecord, LeadRequirements, ToolInvocation, TranscriptTurn } from "../types";
import type { Persona } from "./personas";
import { RUBRIC, type EvalCallResult, type ExpectationResult, type RubricScore } from "./types";

/**
 * Runs one persona against the real agent, then scores the result.
 *
 * The caller is played by a text model rather than a fixed script. A script
 * only tests the path it was written for and cannot punish the agent for
 * mishandling the previous turn — if she ignores the budget change, a script
 * carries on regardless. A persona that reads the conversation and reacts will
 * push back, repeat itself, or get annoyed, which is the behaviour that
 * actually finds regressions.
 *
 * The agent under test is the real thing: the shipped system instruction, the
 * shipped tools, the shipped voice model. Only the transport differs — caller
 * turns go in as text, which bypasses speech recognition but exercises every
 * other layer. Speech quality is judged separately, by ear.
 */

const MAX_SILENCE_MS = 45_000;

function pickKey(attempt = 0): string {
  return GEMINI_API_KEYS[attempt % Math.max(1, GEMINI_API_KEYS.length)] ?? "";
}

/* ------------------------------------------------------------------ */
/* The caller                                                          */
/* ------------------------------------------------------------------ */

async function personaReply(persona: Persona, transcript: TranscriptTurn[]): Promise<string | null> {
  const history = transcript
    .filter((t) => t.text.trim())
    .map((t) => `${t.role === "agent" ? "AGENT" : "YOU"}: ${t.text.trim()}`)
    .join("\n");

  const prompt = `${persona.brief}

You are on a phone call with a real-estate sales agent. Below is the conversation so far.
Reply with ONLY your next spoken line — no narration, no quotes, no stage directions, nothing else.
Keep it to one or two sentences, the way someone actually speaks on the phone.

If the conversation has reached a natural end — you have agreed a next step, or you have made clear
you are not interested and she has accepted it — reply with exactly: [HANG UP]

## Conversation so far
${history || "(the agent has not spoken yet)"}`;

  for (const model of TEXT_MODEL_FALLBACKS) {
    for (const apiKey of GEMINI_API_KEYS) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          // Some warmth so the persona does not answer identically every run.
          config: { temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
        });
        const text = res.text?.trim();
        if (!text) continue;
        if (/\[HANG ?UP\]/i.test(text)) return null;
        return text.replace(/^["']|["']$/g, "").slice(0, 500);
      } catch (err) {
        if (!isQuotaError(err instanceof Error ? err.message : String(err))) return null;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The conversation                                                    */
/* ------------------------------------------------------------------ */

interface ConversationOutcome {
  transcript: TranscriptTurn[];
  toolCalls: ToolInvocation[];
  requirements: LeadRequirements;
  endedByAgent: boolean;
  durationMs: number;
  error?: string;
}

async function runConversation(persona: Persona): Promise<ConversationOutcome> {
  const startedAt = Date.now();
  const transcript: TranscriptTurn[] = [];
  const toolCalls: ToolInvocation[] = [];
  let requirements: LeadRequirements = {};
  let endedByAgent = false;
  let session: Session | undefined;
  let openAgentTurn: TranscriptTurn | undefined;
  let seq = 0;

  const ai = new GoogleGenAI({ apiKey: pickKey() });

  /** Resolves when the agent finishes speaking, or the socket dies. */
  let turnDone: (() => void) | undefined;
  const waitForTurn = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, MAX_SILENCE_MS);
      turnDone = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  try {
    session = await ai.live.connect({
      model: LIVE_MODEL,
      config: buildLiveConfig({ openingLanguage: "hinglish" }),
      callbacks: {
        onopen: () => {},
        onmessage: (m: LiveServerMessage) => {
          if (m.toolCall?.functionCalls?.length) {
            // One tool embeds the caller's words, so this is async. The reply
            // is fired and forgotten rather than awaited by the caller — the
            // model simply waits for the tool response to arrive.
            void Promise.all(
              m.toolCall.functionCalls.map(async (fc) => {
                const name = fc.name ?? "";
                const args = (fc.args ?? {}) as Record<string, unknown>;
                const result = await runAgentTool(name, args);
                if (result.requirementsPatch) requirements = mergeRequirements(requirements, result.requirementsPatch);
                toolCalls.push({
                  id: fc.id ?? `t${++seq}`,
                  name,
                  args,
                  result: result.response,
                  at: Date.now() - startedAt,
                });
                if (result.endCall) endedByAgent = true;
                return { id: fc.id, name: fc.name, response: result.response };
              }),
            ).then((functionResponses) => {
              try {
                session?.sendToolResponse({ functionResponses });
              } catch {
                /* socket gone */
              }
            });
          }

          const sc = m.serverContent;
          if (!sc) return;

          if (sc.outputTranscription?.text) {
            if (!openAgentTurn) {
              openAgentTurn = { id: `a${++seq}`, role: "agent", text: "", at: Date.now() - startedAt };
              transcript.push(openAgentTurn);
            }
            openAgentTurn.text += sc.outputTranscription.text;
          }

          if (sc.turnComplete) {
            openAgentTurn = undefined;
            turnDone?.();
          }
        },
        onerror: () => turnDone?.(),
        onclose: () => turnDone?.(),
      },
    });

    // Same nudge the product uses — the Live API will not speak first.
    const first = waitForTurn();
    session.sendRealtimeInput({
      text: "[SYSTEM: The call has just connected and the customer is on the line. Deliver your opening line now.]",
    });
    await first;

    for (let turn = 0; turn < persona.maxTurns && !endedByAgent; turn++) {
      const reply = await personaReply(persona, transcript);
      if (reply === null) break;

      transcript.push({ id: `c${++seq}`, role: "customer", text: reply, at: Date.now() - startedAt });
      const done = waitForTurn();
      try {
        session.sendRealtimeInput({ text: reply });
      } catch {
        break;
      }
      await done;
    }
  } catch (err) {
    return {
      transcript,
      toolCalls,
      requirements,
      endedByAgent,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      session?.close();
    } catch {
      /* already gone */
    }
  }

  return { transcript, toolCalls, requirements, endedByAgent, durationMs: Date.now() - startedAt };
}

/* ------------------------------------------------------------------ */
/* The judge                                                           */
/* ------------------------------------------------------------------ */

const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, enum: RUBRIC.map((r) => r.key) },
          score: { type: Type.NUMBER, description: "1-5 integer." },
          reason: { type: Type.STRING, description: "One sentence, citing a specific moment." },
        },
        required: ["key", "score", "reason"],
      },
    },
    expectations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          expectation: { type: Type.STRING },
          met: { type: Type.BOOLEAN },
          evidence: { type: Type.STRING, description: "Quote the line that settles it, or say what was missing." },
        },
        required: ["expectation", "met", "evidence"],
      },
    },
    notes: { type: Type.STRING, description: "Two sentences: the single biggest problem, and what would fix it." },
  },
  required: ["scores", "expectations", "notes"],
};

async function judge(
  persona: Persona,
  outcome: ConversationOutcome,
): Promise<{ scores: RubricScore[]; expectations: ExpectationResult[]; notes: string } | null> {
  const dialogue = outcome.transcript
    .filter((t) => t.text.trim())
    .map((t) => `${t.role === "agent" ? "AGENT" : "CALLER"}: ${t.text.trim()}`)
    .join("\n");

  const prompt = `You are grading an AI real-estate sales agent on one call. Be strict: 3 means
acceptable, 5 means a good human rep would be pleased with it. Do not award 5 for merely avoiding
mistakes. Cite specific lines.

The caller was played by this persona, which was chosen to probe a known weakness:
${persona.brief}

**What this persona is testing:** ${persona.probes}

## Rubric
${RUBRIC.map((r) => `- ${r.key} (${r.label}): ${r.guidance}`).join("\n")}

## Specific expectations for this persona
${persona.expectations.map((e, i) => `${i + 1}. ${e}`).join("\n")}

## Facts about the run
- Tools the agent called: ${outcome.toolCalls.map((t) => t.name).join(", ") || "(none)"}
- The agent ended the call herself: ${outcome.endedByAgent ? "yes" : "no"}
- Requirements captured: ${JSON.stringify(outcome.requirements)}

## Transcript
${dialogue || "(the agent said nothing)"}`;

  for (const model of TEXT_MODEL_FALLBACKS) {
    for (const apiKey of GEMINI_API_KEYS) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: JUDGE_SCHEMA,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        if (!res.text) continue;
        const parsed = JSON.parse(res.text) as {
          scores: RubricScore[];
          expectations: ExpectationResult[];
          notes: string;
        };
        return {
          scores: (parsed.scores ?? []).map((s) => ({ ...s, score: Math.max(1, Math.min(5, Math.round(s.score))) })),
          expectations: parsed.expectations ?? [],
          notes: parsed.notes ?? "",
        };
      } catch (err) {
        if (!isQuotaError(err instanceof Error ? err.message : String(err))) return null;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

export async function evaluatePersona(persona: Persona): Promise<EvalCallResult> {
  const outcome = await runConversation(persona);

  const base: EvalCallResult = {
    personaId: persona.id,
    personaLabel: persona.label,
    transcript: outcome.transcript,
    toolCalls: outcome.toolCalls,
    requirements: outcome.requirements,
    turnCount: outcome.transcript.filter((t) => t.role === "customer").length,
    endedByAgent: outcome.endedByAgent,
    durationMs: outcome.durationMs,
    scores: [],
    expectations: [],
    overall: 0,
    judgeNotes: "",
    error: outcome.error,
  };

  if (!outcome.transcript.some((t) => t.role === "agent" && t.text.trim())) {
    return { ...base, error: base.error ?? "The agent never spoke." };
  }

  // Judging and groundedness are independent; run them together.
  const asCall: CallRecord = {
    id: `eval_${persona.id}`,
    channel: "browser",
    status: "completed",
    startedAt: new Date().toISOString(),
    transcript: outcome.transcript,
    toolCalls: outcome.toolCalls,
    requirements: outcome.requirements,
  };
  const [verdict, groundedness] = await Promise.all([judge(persona, outcome), checkGroundedness(asCall)]);

  const scores = verdict?.scores ?? [];
  return {
    ...base,
    scores,
    expectations: verdict?.expectations ?? [],
    overall: scores.length ? Number((scores.reduce((n, s) => n + s.score, 0) / scores.length).toFixed(2)) : 0,
    groundedness,
    judgeNotes: verdict?.notes ?? "",
  };
}
