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

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

/**
 * Dev escape hatch. Ephemeral tokens are the correct way to drive the Live API
 * from a browser — the raw key never leaves the server. If token minting is
 * ever unavailable on an account, setting this to "true" hands the browser the
 * API key directly. Only do that with a throwaway free-tier key, and never on a
 * deployment you care about.
 */
export const ALLOW_DIRECT_KEY_FALLBACK = process.env.ALLOW_DIRECT_KEY_FALLBACK === "true";

export const hasGeminiKey = () => GEMINI_API_KEY.length > 0;
