import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Authorisation for anything that can dial a real phone number.
 *
 * This matters more here than the rest of the app's rate limiting. The browser
 * demo spends the owner's Gemini quota if abused, which is annoying. The
 * campaign engine dials arbitrary numbers from a verified business line — an
 * unauthenticated version of it, deployed publicly, is an open robocall relay
 * that would get the number blocked and the account terminated, and would put
 * unsolicited calls on real people's phones.
 *
 * So the campaign write path is closed by default and has to be deliberately
 * opened, twice over:
 *
 *   OPS_ADMIN_TOKEN   — who may create, start or pause a campaign
 *   CAMPAIGNS_ENABLED — whether a real call may be placed at all
 *
 * Separating them means the ops UI stays browsable and the queue stays
 * exercisable in dry-run without a single call going out, which is exactly the
 * state this project ships in.
 */

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export type OpsAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Guards every route that can mutate a campaign. */
export function requireOpsAuth(req: Request): OpsAuthResult {
  const expected = process.env.OPS_ADMIN_TOKEN ?? "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error:
        "Campaign management is disabled: OPS_ADMIN_TOKEN is not set. This route can place real " +
        "phone calls, so it stays closed until an operator token is configured.",
    };
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.headers.get("x-ops-token") ?? "");
  if (!token || !safeEqual(token, expected)) {
    return { ok: false, status: 401, error: "Not authorised." };
  }
  return { ok: true };
}

/** Vercel cron sends `Authorization: Bearer $CRON_SECRET`. */
export function requireCronAuth(req: Request): OpsAuthResult {
  const expected = process.env.CRON_SECRET ?? process.env.OPS_ADMIN_TOKEN ?? "";
  if (!expected) {
    return { ok: false, status: 503, error: "Dispatcher is disabled: neither CRON_SECRET nor OPS_ADMIN_TOKEN is set." };
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, expected)) return { ok: false, status: 401, error: "Not authorised." };
  return { ok: true };
}

/**
 * Whether the dispatcher may place a real call.
 *
 * Off by default. When off the queue still runs end to end — claiming,
 * retrying, backing off, respecting the window — and simply records that
 * dialling was suppressed, so the mechanism is observable without anyone's
 * phone ringing.
 */
export function callingEnabled(): boolean {
  return process.env.CAMPAIGNS_ENABLED === "true";
}
