import { NextResponse } from "next/server";
import { GEMINI_API_KEY, LIVE_MODEL, TEXT_MODEL } from "@/lib/config";
import { listCalls, storageBackend } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One request that answers "is the demo actually going to work right now".
 *
 * Written for the two minutes before a live demo: it reports which pieces are
 * configured without ever echoing a secret, and it genuinely touches the
 * database rather than just checking that an env var is present.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  checks.geminiKey = {
    ok: GEMINI_API_KEY.length > 0,
    detail: GEMINI_API_KEY.length > 0 ? `configured (${GEMINI_API_KEY.length} chars)` : "GEMINI_API_KEY missing",
  };

  const backend = storageBackend();
  try {
    const calls = await listCalls(1);
    checks.storage = {
      ok: true,
      detail:
        backend === "postgres"
          ? `Postgres reachable${calls.length ? "" : " (no calls recorded yet)"}`
          : "In-memory store — calls will not survive a restart or a second serverless instance. Set DATABASE_URL for persistence.",
    };
  } catch (err) {
    checks.storage = { ok: false, detail: `${backend} error: ${err instanceof Error ? err.message : String(err)}` };
  }

  checks.telephony = {
    ok: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    detail: process.env.TWILIO_ACCOUNT_SID
      ? `Twilio configured${process.env.TWILIO_PHONE_NUMBER ? ` on ${process.env.TWILIO_PHONE_NUMBER}` : ""}`
      : "Twilio not configured — browser voice demo only",
  };

  const critical = checks.geminiKey.ok && checks.storage.ok;

  return NextResponse.json(
    {
      status: critical ? "ok" : "degraded",
      models: { live: LIVE_MODEL, text: TEXT_MODEL },
      storage: backend,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: critical ? 200 : 503 },
  );
}
