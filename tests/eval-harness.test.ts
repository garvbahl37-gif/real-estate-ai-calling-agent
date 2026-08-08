/**
 * The eval harness itself.
 *
 * A measurement tool needs its own tests more than most code does, because a
 * broken one does not fail loudly — it reports a number, and you act on it.
 * Both cases here are bugs that a full run actually exhibited.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemInstruction } from "../src/lib/agent-prompt";
import { PERSONAS, getPersona } from "../src/lib/eval/personas";
import { aggregate, scoredResults, type EvalRun } from "../src/lib/eval/types";

describe("persona opening language", () => {
  it("declares a language for every persona that tests one", () => {
    // She speaks first, before hearing anything, so she cannot mirror a
    // language she has not heard. The harness used to force Hinglish, which
    // marked the English-only and Hindi-only personas down for a greeting the
    // harness itself had produced.
    assert.equal(getPersona("pure-english")!.openingLanguage, "english");
    assert.equal(getPersona("pure-hindi")!.openingLanguage, "hindi");
    assert.equal(getPersona("language-switcher")!.openingLanguage, "english");
  });

  it("leaves Hinglish personas on the default", () => {
    assert.equal(getPersona("straightforward-hinglish")!.openingLanguage, undefined);
  });

  it("produces an instruction that matches the persona's language", () => {
    const forPersona = (id: string) =>
      buildSystemInstruction({ openingLanguage: getPersona(id)!.openingLanguage ?? "hinglish" });
    assert.match(forPersona("pure-english"), /Open the call in Indian English/);
    assert.match(forPersona("pure-hindi"), /Open the call in Hindi/);
    assert.match(forPersona("straightforward-hinglish"), /Open the call in Hinglish/);
  });

  it("keeps every persona's expectations consistent with its language", () => {
    // A persona expecting an English-only call must not open in Hindi.
    for (const p of PERSONAS) {
      const wantsEnglishOnly = p.expectations.some((e) => /English for the entire call/i.test(e));
      if (wantsEnglishOnly) assert.equal(p.openingLanguage, "english", `${p.id} expects English but opens elsewhere`);
      const wantsHindiOnly = p.expectations.some((e) => /Hindi throughout/i.test(e));
      if (wantsHindiOnly) assert.equal(p.openingLanguage, "hindi", `${p.id} expects Hindi but opens elsewhere`);
    }
  });
});

describe("unscored runs", () => {
  const run = (over: Partial<EvalRun["results"][number]>[]): EvalRun => ({
    id: "r",
    startedAt: "",
    finishedAt: "",
    model: "m",
    meanScore: 0,
    expectationPassRate: 0,
    results: over.map((o, i) => ({
      personaId: `p${i}`,
      personaLabel: `P${i}`,
      transcript: [],
      toolCalls: [],
      requirements: {},
      turnCount: 0,
      endedByAgent: false,
      durationMs: 0,
      scores: [],
      expectations: [],
      overall: 0,
      judgeNotes: "",
      ...o,
    })),
  });

  it("excludes a run the judge could not score", () => {
    // Otherwise an unreachable judge reads as an agent that failed
    // catastrophically, and you go debugging an agent that is fine.
    const r = run([
      { scores: [{ key: "naturalness", score: 5, reason: "" }], overall: 5 },
      { scores: [], overall: 0, error: "judge unreachable" },
    ]);
    assert.equal(scoredResults(r).length, 1);
  });

  it("does not let an unscored run drag a dimension mean to zero", () => {
    const r = run([
      { scores: [{ key: "naturalness", score: 4, reason: "" }], overall: 4 },
      { scores: [], overall: 0, error: "judge unreachable" },
    ]);
    const naturalness = aggregate(r).find((d) => d.key === "naturalness")!;
    assert.equal(naturalness.mean, 4, "an unscored run was averaged in as a zero");
  });
});
