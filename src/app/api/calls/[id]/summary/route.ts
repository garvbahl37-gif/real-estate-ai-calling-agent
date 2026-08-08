import { NextResponse } from "next/server";
import { RULES, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getCall, updateCall } from "@/lib/store";
import { runPostCallActions } from "@/lib/actions/runner";
import { checkGroundedness } from "@/lib/groundedness";
import { analyseSentiment } from "@/lib/sentiment";
import { summarizeCall } from "@/lib/summarize";
import { callIdSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One Flash call with thinking disabled — 60s is generous, but leaves room for
// a cold start on the free tier.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Generates (or regenerates) the post-call summary and persists it.
 * Called by the browser client when a call ends, and by the telephony bridge
 * once Twilio reports the call completed.
 */
export async function POST(req: Request, ctx: Ctx) {
  const limit = await checkRateLimit(req, RULES.summaryPerIp, RULES.summaryGlobal);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Summary generation is rate limited. Try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const { id: rawId } = await ctx.params;
  const id = callIdSchema.safeParse(rawId);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };

  const call = await getCall(id.data);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  if (call.summary && body.force !== true) {
    return NextResponse.json(
      { summary: call.summary, groundedness: call.groundedness, sentiment: call.sentiment, cached: true },
      { headers: rateLimitHeaders(limit) },
    );
  }

  // Summarising an empty transcript burns quota to produce nothing useful.
  const spoken = call.transcript.filter((t) => t.text.trim()).length;
  if (spoken === 0) {
    return NextResponse.json({ error: "Nothing was said on this call — no summary to generate." }, { status: 422 });
  }

  // Three independent passes over the same transcript, so they run together
  // rather than serially — the caller is staring at a spinner and none of them
  // depends on another's output.
  const [summary, groundedness, sentiment] = await Promise.all([
    summarizeCall(call),
    checkGroundedness(call),
    analyseSentiment(call),
  ]);

  const endedAt = call.endedAt ?? new Date().toISOString();
  const durationSec =
    call.durationSec ??
    Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000));

  // Actions run after the analysis, not alongside it: the CRM payload carries
  // the qualification score and the groundedness result, so it has to be built
  // from a call record that already has them.
  const enriched = { ...call, summary, groundedness, sentiment, endedAt, durationSec };
  const actions = await runPostCallActions(enriched);

  await updateCall(id.data, {
    summary,
    groundedness,
    sentiment,
    actions,
    status: "completed",
    endedAt,
    durationSec,
  });

  return NextResponse.json({ summary, groundedness, sentiment, cached: false }, { headers: rateLimitHeaders(limit) });
}
