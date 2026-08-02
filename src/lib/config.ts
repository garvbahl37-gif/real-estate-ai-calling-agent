/** Server-side config: env-dependent values only. Model constants live in ./models. */

import { DEFAULT_LIVE_MODEL } from "./models";

export { DEFAULT_LIVE_MODEL, LIVE_MODELS, isKnownLiveModel, type LiveModelId } from "./models";

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;

/**
 * Text model for the post-call summary and lead scoring.
 *
 * Note: gemini-2.5-flash and 2.5-flash-lite now return 404 "no longer available
 * to new users" for freshly issued API keys, so the obvious default is a trap.
 * gemini-3.5-flash is the current free-tier model that handles responseSchema
 * (verified against a new key at ~1.4s for this workload).
 */
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";

/**
 * Summarisation falls down this list on a 429.
 *
 * Free-tier quotas are per-model and small — gemini-3.5-flash allows 20
 * requests a day — and they are easy to exhaust while iterating. Losing the
 * call summary because one model is spent is a bad failure for something that
 * has to work on demand in front of an interviewer, and these are independent
 * quota buckets, so the second attempt usually succeeds.
 */
export const TEXT_MODEL_FALLBACKS = [
  TEXT_MODEL,
  // Verified working while gemini-3.5-flash and 2.0-flash were quota-exhausted.
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash",
].filter((m, i, a) => a.indexOf(m) === i);

/**
 * Every Gemini key available, primary first.
 *
 * Free-tier quota is per *project*, not per model alone, so a second key issued
 * from a different project is a genuinely independent bucket. Exhausting one is
 * easy — gemini-3.5-flash allows 20 generate-content requests a day — and the
 * failure lands as a missing call summary or a call that will not start, which
 * is the worst possible moment for it.
 *
 * Accepts either a comma-separated GEMINI_API_KEYS or numbered
 * GEMINI_API_KEY_2 / _3 vars, so it works with whatever is easiest to set on
 * the host.
 */
export const GEMINI_API_KEYS: string[] = Array.from(
  new Set(
    [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_API_KEY,
      ...(process.env.GEMINI_API_KEYS ?? "").split(","),
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ]
      .map((k) => (k ?? "").trim())
      .filter(Boolean),
  ),
);

/** The primary key. Kept as a single export because most call sites want one. */
export const GEMINI_API_KEY = GEMINI_API_KEYS[0] ?? "";

/** True when the error is a quota/rate-limit rejection rather than a bad request. */
export function isQuotaError(message: string): boolean {
  return /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message);
}

/**
 * Dev escape hatch. Ephemeral tokens are the correct way to drive the Live API
 * from a browser — the raw key never leaves the server. If token minting is
 * ever unavailable on an account, setting this to "true" hands the browser the
 * API key directly. Only do that with a throwaway free-tier key, and never on a
 * deployment you care about.
 */
export const ALLOW_DIRECT_KEY_FALLBACK = process.env.ALLOW_DIRECT_KEY_FALLBACK === "true";

export const hasGeminiKey = () => GEMINI_API_KEY.length > 0;
