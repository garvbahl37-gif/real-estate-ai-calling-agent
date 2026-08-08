import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { DEFAULT_VOICE, VOICES } from "@/lib/agent-prompt";
import {
  ALLOW_DIRECT_KEY_FALLBACK,
  GEMINI_API_KEY,
  GEMINI_API_KEYS,
  LIVE_MODEL,
  hasGeminiKey,
  isKnownLiveModel,
  isQuotaError,
} from "@/lib/config";
import { buildLiveConfig } from "@/lib/live-config";
import { getProfile } from "@/lib/profiles";
import { RULES, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { formatZodError, tokenRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_VOICES = new Set<string>(VOICES.map((v) => v.id));

/**
 * Mints a short-lived, single-use token that the browser uses to open its own
 * WebSocket straight to the Live API.
 *
 * Two things are going on here.
 *
 * 1. The audio path is browser <-> Google, with no proxy. Relaying 16 kHz PCM
 *    through a serverless function would add a hop in each direction on every
 *    128 ms chunk, and a Vercel function's lifetime is a poor fit for a socket
 *    held open for the length of a sales call. The server only handles this one
 *    short request.
 *
 * 2. The entire session config — system prompt, tool list, voice, VAD tuning —
 *    is baked into the token's `liveConnectConstraints`, which the Live API
 *    treats as authoritative. Config sent by the client is discarded. So the
 *    browser receives a credential scoped to exactly one conversation with
 *    exactly this agent, and cannot rewrite the prompt or the guardrails.
 */
export async function POST(req: Request) {
  const limit = await checkRateLimit(req, RULES.tokenPerIp, RULES.tokenGlobal);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.scope === "global"
            ? "This demo has hit its daily call ceiling. It resets at midnight UTC."
            : `Too many calls started from this address. Try again in ${Math.ceil(limit.resetSec / 60)} minute(s).`,
      },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  if (!hasGeminiKey()) {
    return NextResponse.json(
      {
        error: "GEMINI_API_KEY is not set on the server.",
        hint: "Create a free key at https://aistudio.google.com/apikey and add it to .env.local (or Vercel env vars).",
      },
      { status: 503 },
    );
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = tokenRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const model = parsed.data.model && isKnownLiveModel(parsed.data.model) ? parsed.data.model : LIVE_MODEL;

  // The profile is resolved server-side and baked into the ephemeral token's
  // config. A client cannot ask for one identity and then talk as another,
  // which is the whole reason the config is locked at mint time.
  const profile = getProfile(parsed.data.profileId);
  const voice =
    parsed.data.voice && VALID_VOICES.has(parsed.data.voice) ? parsed.data.voice : (profile.voice ?? DEFAULT_VOICE);

  const liveConfig = buildLiveConfig({
    profile,
    voice,
    customerName: parsed.data.customerName,
    openingLanguage: parsed.data.openingLanguage,
    scenarioOverride: parsed.data.scenarioOverride,
    resumeHandle: parsed.data.resumeHandle,
    channel: "browser",
  });

  // Try each configured key in turn. Free-tier Live quota is per project, so a
  // spent primary key must not mean "no demo" — that failure would land as the
  // call simply refusing to start.
  let message = "no API key configured";
  for (const apiKey of GEMINI_API_KEYS) {
    const ai = new GoogleGenAI({ apiKey });
    try {
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          // One session per token — a leaked token can't be replayed into a second call.
          uses: 1,
          // Ceiling on how long the resulting session may run.
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          // The token must be *used* within two minutes of being minted.
          newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
          liveConnectConstraints: { model, config: liveConfig },
        },
      });

      if (!token.name) throw new Error("Token response contained no name");

      return NextResponse.json(
        { mode: "ephemeral", token: token.name, model, voice, profileId: profile.id },
        { headers: rateLimitHeaders(limit) },
      );
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      // Quota is worth retrying on another key; a bad request is not.
      if (!isQuotaError(message)) break;
    }
  }

  // Every key is spent or rejected.
  if (ALLOW_DIRECT_KEY_FALLBACK) {
    // Without a token there is nothing to lock the config to, so the client
    // has to send it — which is exactly why this path is dev-only.
    return NextResponse.json(
      {
        mode: "direct",
        token: GEMINI_API_KEY,
        model,
        voice,
        liveConfig,
        warning:
          "Ephemeral token minting failed; falling back to the raw API key in the browser. " +
          "Development only — unset ALLOW_DIRECT_KEY_FALLBACK before deploying.",
      },
      { headers: rateLimitHeaders(limit) },
    );
  }

  const quota = isQuotaError(message);
  return NextResponse.json(
    {
      error: quota
        ? `All ${GEMINI_API_KEYS.length} Gemini key(s) are out of quota. The free tier resets daily.`
        : `Could not mint an ephemeral token: ${message}`,
      hint: quota
        ? "Add another key as GEMINI_API_KEY_2 (or a comma-separated GEMINI_API_KEYS) — each project has its own quota."
        : "Check that the key is valid and that the Live API is available for it.",
    },
    { status: quota ? 429 : 502 },
  );
}
