import { NextResponse } from "next/server";
import { tickAll } from "@/lib/campaigns/dispatcher";
import { callingEnabled, requireCronAuth } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A tick places calls sequentially; the default 300s is ample but not free. */
export const maxDuration = 120;

/**
 * Advances every running campaign by one tick.
 *
 * Driven by a Vercel cron rather than a loop, because there is no long-lived
 * process to run a loop in. Ticks are idempotent and claim work atomically, so
 * an overlapping run is safe rather than something the schedule has to avoid.
 *
 * GET because that is what Vercel cron sends.
 */
export async function GET(req: Request) {
  const auth = requireCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const results = await tickAll();
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      callingEnabled: callingEnabled(),
      campaigns: results.length,
      placed: results.reduce((n, r) => n + r.placed, 0),
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
