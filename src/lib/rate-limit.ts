import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Rate limiting for the public demo.
 *
 * This matters more than it usually would: /api/live-token mints credentials
 * against a shared free-tier Gemini quota. Without a cap, one script pointed at
 * the demo URL exhausts the quota for the day and the live interview demo dies.
 *
 * Two layers:
 *  - per-IP, so one client can't monopolise it
 *  - a global daily ceiling, which is the one that actually protects the quota
 *
 * Backed by Postgres when DATABASE_URL is present. Vercel functions are
 * per-instance, so an in-memory counter leaks across cold starts and gives an
 * effective limit of (limit x instances); the DB counter is shared and honest.
 * In-memory is the local-dev fallback.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

export interface RateLimitRule {
  /** Logical bucket, e.g. "token" or "summary". */
  name: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSec: number;
  scope: "ip" | "global";
}

/* ------------------------------------------------------------------ */

const memory = (() => {
  const g = globalThis as unknown as { __rl?: Map<string, { count: number; expiresAt: number }> };
  if (!g.__rl) g.__rl = new Map();
  return g.__rl;
})();

let rlSchemaReady: Promise<void> | null = null;

function ensureRateLimitSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!rlSchemaReady) {
    rlSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket     TEXT PRIMARY KEY,
          count      INTEGER NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
    })().catch((e) => {
      rlSchemaReady = null;
      throw e;
    });
  }
  return rlSchemaReady;
}

async function hit(bucket: string, limit: number, windowSec: number): Promise<{ count: number; resetSec: number }> {
  if (sql) {
    await ensureRateLimitSchema();
    // Single statement so concurrent requests can't both read 0 and both write 1.
    // If the stored window has expired we reset count and start a new one.
    const rows = (await sql`
      INSERT INTO rate_limits (bucket, count, expires_at)
      VALUES (${bucket}, 1, NOW() + (${windowSec} || ' seconds')::interval)
      ON CONFLICT (bucket) DO UPDATE SET
        count = CASE WHEN rate_limits.expires_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
        expires_at = CASE
          WHEN rate_limits.expires_at < NOW() THEN NOW() + (${windowSec} || ' seconds')::interval
          ELSE rate_limits.expires_at
        END
      RETURNING count, EXTRACT(EPOCH FROM (expires_at - NOW()))::int AS reset_sec
    `) as unknown as { count: number; reset_sec: number }[];
    return { count: rows[0]?.count ?? 1, resetSec: Math.max(0, rows[0]?.reset_sec ?? windowSec) };
  }

  const now = Date.now();
  const entry = memory.get(bucket);
  if (!entry || entry.expiresAt < now) {
    memory.set(bucket, { count: 1, expiresAt: now + windowSec * 1000 });
    return { count: 1, resetSec: windowSec };
  }
  entry.count += 1;
  return { count: entry.count, resetSec: Math.ceil((entry.expiresAt - now) / 1000) };
}

/** Best-effort client IP. Vercel sets x-forwarded-for; the first entry is the client. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Checks the per-IP rule and, if given, a global rule. Returns the first
 * failure. Fails OPEN on a storage error — a broken rate limiter should not
 * take down the demo, and the global daily cap is a cost guard, not a security
 * boundary.
 */
/**
 * Off by default in development — the limits are sized to protect a public
 * deployment's shared quota, and tripping them while iterating locally just
 * costs you ten minutes. Set RATE_LIMIT_DISABLED=false to exercise them.
 */
const DISABLED =
  process.env.RATE_LIMIT_DISABLED === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_DISABLED !== "false");

export async function checkRateLimit(
  req: Request,
  perIp: RateLimitRule,
  global?: RateLimitRule,
): Promise<RateLimitResult> {
  if (DISABLED) {
    return { ok: true, remaining: perIp.limit, limit: perIp.limit, resetSec: perIp.windowSec, scope: "ip" };
  }

  try {
    if (global) {
      const day = new Date().toISOString().slice(0, 10);
      const g = await hit(`global:${global.name}:${day}`, global.limit, global.windowSec);
      if (g.count > global.limit) {
        return { ok: false, remaining: 0, limit: global.limit, resetSec: g.resetSec, scope: "global" };
      }
    }

    const ip = clientIp(req);
    const r = await hit(`ip:${perIp.name}:${ip}`, perIp.limit, perIp.windowSec);
    return {
      ok: r.count <= perIp.limit,
      remaining: Math.max(0, perIp.limit - r.count),
      limit: perIp.limit,
      resetSec: r.resetSec,
      scope: "ip",
    };
  } catch {
    return { ok: true, remaining: perIp.limit, limit: perIp.limit, resetSec: perIp.windowSec, scope: "ip" };
  }
}

/** Tuned for a demo that has to survive an interview, not for production traffic. */
export const RULES = {
  // A real conversation is one token. Six starts in ten minutes is generous
  // for someone testing, and nowhere near enough to drain a daily quota.
  tokenPerIp: { name: "token", limit: 6, windowSec: 600 } as RateLimitRule,
  tokenGlobal: { name: "token", limit: 400, windowSec: 86_400 } as RateLimitRule,
  summaryPerIp: { name: "summary", limit: 30, windowSec: 3600 } as RateLimitRule,
  summaryGlobal: { name: "summary", limit: 600, windowSec: 86_400 } as RateLimitRule,
  writePerIp: { name: "write", limit: 600, windowSec: 3600 } as RateLimitRule,
  // Throttles guessing at OPS_ADMIN_TOKEN. The comparison is timing-safe, but
  // that only stops one class of attack — nothing else caps how many guesses
  // an attacker gets, and these routes can dial phones and read personal data.
  opsPerIp: { name: "ops", limit: 60, windowSec: 600 } as RateLimitRule,
} as const;

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetSec),
    ...(r.ok ? {} : { "Retry-After": String(r.resetSec) }),
  };
}
