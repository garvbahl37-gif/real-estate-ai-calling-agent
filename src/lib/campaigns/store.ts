import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Campaign, CampaignContact, ContactStatus } from "../types";
import type { ParsedContact } from "./contacts";

/**
 * Campaign and contact persistence.
 *
 * Same two-backend shape as ../store.ts: Postgres when DATABASE_URL is set,
 * an in-memory map otherwise so the project clones and runs.
 *
 * The important difference is that this table is a *queue*, not a record store.
 * Contacts are claimed by concurrent dispatcher ticks, which on Vercel may
 * overlap — a cron firing while the previous tick is still placing calls is
 * normal, not exceptional. Claiming is therefore done with SELECT … FOR UPDATE
 * SKIP LOCKED (see claimDueContacts), which is the difference between "a lead
 * gets called once" and "a lead gets called three times by three workers".
 */

const DATABASE_URL = process.env.DATABASE_URL;
const usingPostgres = Boolean(DATABASE_URL);
const sql = usingPostgres ? neon(DATABASE_URL!) : null;

/* ------------------------------------------------------------------ */
/* In-memory fallback                                                  */
/* ------------------------------------------------------------------ */

interface MemoryDb {
  campaigns: Map<string, Campaign>;
  contacts: Map<string, CampaignContact>;
}

const memory: MemoryDb = (() => {
  const g = globalThis as unknown as { __campaignStore?: MemoryDb };
  if (!g.__campaignStore) g.__campaignStore = { campaigns: new Map(), contacts: new Map() };
  return g.__campaignStore;
})();

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let schemaReady: Promise<void> | null = null;

export function ensureCampaignSchema(): Promise<void> {
  if (!usingPostgres) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql!`
        CREATE TABLE IF NOT EXISTS campaigns (
          id                     TEXT PRIMARY KEY,
          name                   TEXT NOT NULL,
          profile_id             TEXT NOT NULL DEFAULT 'default',
          status                 TEXT NOT NULL DEFAULT 'draft',
          created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          max_concurrent         INTEGER NOT NULL DEFAULT 2,
          max_attempts           INTEGER NOT NULL DEFAULT 3,
          call_window_start_hour INTEGER NOT NULL DEFAULT 9,
          call_window_end_hour   INTEGER NOT NULL DEFAULT 21
        )
      `;
      await sql!`
        CREATE TABLE IF NOT EXISTS campaign_contacts (
          id              TEXT PRIMARY KEY,
          campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          name            TEXT,
          phone           TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'queued',
          attempts        INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TIMESTAMPTZ,
          next_attempt_at TIMESTAMPTZ,
          call_id         TEXT,
          failure_reason  TEXT
        )
      `;
      // One row per number per campaign. The parser already dedupes an upload;
      // this stops a second upload of an overlapping list from double-dialling.
      await sql!`
        CREATE UNIQUE INDEX IF NOT EXISTS campaign_contacts_unique
        ON campaign_contacts (campaign_id, phone)
      `;
      // The dispatcher's hot query: due contacts for a campaign, oldest first.
      await sql!`
        CREATE INDEX IF NOT EXISTS campaign_contacts_due
        ON campaign_contacts (campaign_id, status, next_attempt_at)
      `;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

type CampaignRow = {
  id: string;
  name: string;
  profile_id: string;
  status: string;
  created_at: string | Date;
  max_concurrent: number;
  max_attempts: number;
  call_window_start_hour: number;
  call_window_end_hour: number;
};

const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id,
  name: r.name,
  profileId: r.profile_id,
  status: r.status as Campaign["status"],
  createdAt: new Date(r.created_at).toISOString(),
  maxConcurrent: r.max_concurrent,
  maxAttempts: r.max_attempts,
  callWindowStartHour: r.call_window_start_hour,
  callWindowEndHour: r.call_window_end_hour,
});

type ContactRow = {
  id: string;
  campaign_id: string;
  name: string | null;
  phone: string;
  status: string;
  attempts: number;
  last_attempt_at: string | Date | null;
  next_attempt_at: string | Date | null;
  call_id: string | null;
  failure_reason: string | null;
};

const toContact = (r: ContactRow): CampaignContact => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name ?? undefined,
  phone: r.phone,
  status: r.status as ContactStatus,
  attempts: r.attempts,
  lastAttemptAt: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
  nextAttemptAt: r.next_attempt_at ? new Date(r.next_attempt_at).toISOString() : undefined,
  callId: r.call_id ?? undefined,
  failureReason: r.failure_reason ?? undefined,
});

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export async function createCampaign(c: Campaign): Promise<Campaign> {
  if (!usingPostgres) {
    memory.campaigns.set(c.id, c);
    return c;
  }
  await ensureCampaignSchema();
  await sql!`
    INSERT INTO campaigns (id, name, profile_id, status, created_at, max_concurrent, max_attempts,
                           call_window_start_hour, call_window_end_hour)
    VALUES (${c.id}, ${c.name}, ${c.profileId}, ${c.status}, ${c.createdAt}, ${c.maxConcurrent},
            ${c.maxAttempts}, ${c.callWindowStartHour}, ${c.callWindowEndHour})
  `;
  return c;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!usingPostgres) return memory.campaigns.get(id) ?? null;
  await ensureCampaignSchema();
  const rows = (await sql!`SELECT * FROM campaigns WHERE id = ${id}`) as CampaignRow[];
  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!usingPostgres) {
    return [...memory.campaigns.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await ensureCampaignSchema();
  const rows = (await sql!`SELECT * FROM campaigns ORDER BY created_at DESC`) as CampaignRow[];
  return rows.map(toCampaign);
}

export async function setCampaignStatus(id: string, status: Campaign["status"]): Promise<void> {
  if (!usingPostgres) {
    const c = memory.campaigns.get(id);
    if (c) c.status = status;
    return;
  }
  await ensureCampaignSchema();
  await sql!`UPDATE campaigns SET status = ${status} WHERE id = ${id}`;
}

/** Campaigns the dispatcher should consider this tick. */
export async function runningCampaigns(): Promise<Campaign[]> {
  return (await listCampaigns()).filter((c) => c.status === "running");
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

export async function addContacts(
  campaignId: string,
  contacts: ParsedContact[],
  idFor: (i: number) => string,
): Promise<number> {
  if (!contacts.length) return 0;

  if (!usingPostgres) {
    let added = 0;
    const existing = new Set(
      [...memory.contacts.values()].filter((c) => c.campaignId === campaignId).map((c) => c.phone),
    );
    contacts.forEach((c, i) => {
      if (existing.has(c.phone)) return;
      const id = idFor(i);
      memory.contacts.set(id, {
        id,
        campaignId,
        name: c.name,
        phone: c.phone,
        status: "queued",
        attempts: 0,
      });
      existing.add(c.phone);
      added++;
    });
    return added;
  }

  await ensureCampaignSchema();
  // One statement rather than a loop: a 400-row upload should not be 400 round
  // trips to a serverless Postgres. ON CONFLICT DO NOTHING makes re-uploading
  // an overlapping list a no-op instead of an error.
  const values = contacts.map((c, i) => [idFor(i), campaignId, c.name ?? null, c.phone]);
  const placeholders = values
    .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
    .join(", ");
  const result = (await sql!.query(
    `INSERT INTO campaign_contacts (id, campaign_id, name, phone) VALUES ${placeholders}
     ON CONFLICT (campaign_id, phone) DO NOTHING RETURNING id`,
    values.flat(),
  )) as { id: string }[];
  return result.length;
}

export async function listContacts(campaignId: string, limit = 500): Promise<CampaignContact[]> {
  if (!usingPostgres) {
    return [...memory.contacts.values()].filter((c) => c.campaignId === campaignId).slice(0, limit);
  }
  await ensureCampaignSchema();
  const rows = (await sql!`
    SELECT * FROM campaign_contacts WHERE campaign_id = ${campaignId}
    ORDER BY status, phone LIMIT ${limit}
  `) as ContactRow[];
  return rows.map(toContact);
}

export interface CampaignProgress {
  total: number;
  queued: number;
  calling: number;
  completed: number;
  failed: number;
  noAnswer: number;
  suppressed: number;
}

export async function campaignProgress(campaignId: string): Promise<CampaignProgress> {
  const counts: Record<string, number> = {};
  if (!usingPostgres) {
    for (const c of memory.contacts.values()) {
      if (c.campaignId === campaignId) counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
  } else {
    await ensureCampaignSchema();
    const rows = (await sql!`
      SELECT status, COUNT(*)::int AS n FROM campaign_contacts
      WHERE campaign_id = ${campaignId} GROUP BY status
    `) as { status: string; n: number }[];
    for (const r of rows) counts[r.status] = r.n;
  }
  const get = (s: ContactStatus) => counts[s] ?? 0;
  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    queued: get("queued"),
    calling: get("calling"),
    completed: get("completed"),
    failed: get("failed"),
    noAnswer: get("no_answer"),
    suppressed: get("suppressed"),
  };
}

/**
 * Progress for every campaign in one query.
 *
 * The obvious shape — list campaigns, then ask each for its progress — is an
 * N+1, and on a serverless Postgres each of those is a fresh HTTP round trip
 * rather than a cheap local call. The dashboard renders every campaign, so it
 * would pay that N times on every page view.
 */
export async function allCampaignProgress(): Promise<Map<string, CampaignProgress>> {
  const counts = new Map<string, Record<string, number>>();
  const bump = (id: string, status: string, n: number) => {
    const row = counts.get(id) ?? {};
    row[status] = (row[status] ?? 0) + n;
    counts.set(id, row);
  };

  if (!usingPostgres) {
    for (const c of memory.contacts.values()) bump(c.campaignId, c.status, 1);
  } else {
    await ensureCampaignSchema();
    const rows = (await sql!`
      SELECT campaign_id, status, COUNT(*)::int AS n FROM campaign_contacts
      GROUP BY campaign_id, status
    `) as { campaign_id: string; status: string; n: number }[];
    for (const r of rows) bump(r.campaign_id, r.status, r.n);
  }

  const out = new Map<string, CampaignProgress>();
  for (const [id, row] of counts) {
    const get = (s: ContactStatus) => row[s] ?? 0;
    out.set(id, {
      total: Object.values(row).reduce((a, b) => a + b, 0),
      queued: get("queued"),
      calling: get("calling"),
      completed: get("completed"),
      failed: get("failed"),
      noAnswer: get("no_answer"),
      suppressed: get("suppressed"),
    });
  }
  return out;
}

/**
 * Atomically claims up to `limit` contacts that are due, marking them `calling`
 * so no other worker can take them.
 *
 * FOR UPDATE SKIP LOCKED is the whole point. Two dispatcher ticks running at
 * once — routine when a cron fires while the previous tick is still placing
 * calls — would otherwise both read the same queued rows and both dial them.
 * SKIP LOCKED lets the second tick step over rows the first has claimed and
 * take the next ones instead, rather than blocking on them or duplicating them.
 *
 * The UPDATE and the SELECT are one statement so there is no window between
 * reading a row and owning it.
 */
export async function claimDueContacts(
  campaignId: string,
  limit: number,
  now = new Date(),
): Promise<CampaignContact[]> {
  if (limit <= 0) return [];

  if (!usingPostgres) {
    // Single-process, single-threaded: claiming cannot race with itself.
    const due = [...memory.contacts.values()]
      .filter(
        (c) =>
          c.campaignId === campaignId &&
          (c.status === "queued" || c.status === "no_answer") &&
          (!c.nextAttemptAt || new Date(c.nextAttemptAt) <= now),
      )
      .slice(0, limit);
    for (const c of due) {
      c.status = "calling";
      c.attempts++;
      c.lastAttemptAt = now.toISOString();
    }
    return due.map((c) => ({ ...c }));
  }

  await ensureCampaignSchema();
  const rows = (await sql!`
    UPDATE campaign_contacts SET
      status          = 'calling',
      attempts        = attempts + 1,
      last_attempt_at = ${now.toISOString()}
    WHERE id IN (
      SELECT id FROM campaign_contacts
      WHERE campaign_id = ${campaignId}
        AND status IN ('queued', 'no_answer')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now.toISOString()})
      ORDER BY next_attempt_at NULLS FIRST, phone
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `) as ContactRow[];
  return rows.map(toContact);
}

export interface ContactOutcome {
  status: ContactStatus;
  callId?: string;
  failureReason?: string;
  nextAttemptAt?: Date;
}

export async function settleContact(id: string, outcome: ContactOutcome): Promise<void> {
  if (!usingPostgres) {
    const c = memory.contacts.get(id);
    if (!c) return;
    c.status = outcome.status;
    c.callId = outcome.callId ?? c.callId;
    c.failureReason = outcome.failureReason;
    c.nextAttemptAt = outcome.nextAttemptAt?.toISOString();
    return;
  }
  await ensureCampaignSchema();
  await sql!`
    UPDATE campaign_contacts SET
      status          = ${outcome.status},
      call_id         = COALESCE(${outcome.callId ?? null}, call_id),
      failure_reason  = ${outcome.failureReason ?? null},
      next_attempt_at = ${outcome.nextAttemptAt?.toISOString() ?? null}
    WHERE id = ${id}
  `;
}

/**
 * Undoes a claim exactly — back to `queued`, attempt uncounted.
 *
 * A queue needs this independently of any one caller: a worker that claims work
 * and then discovers it cannot do it must be able to put it back as it found
 * it. Settling it as a failure instead would burn a retry for something that
 * was never attempted.
 */
export async function releaseContact(id: string): Promise<void> {
  if (!usingPostgres) {
    const c = memory.contacts.get(id);
    if (!c) return;
    c.status = "queued";
    c.attempts = Math.max(0, c.attempts - 1);
    c.lastAttemptAt = undefined;
    return;
  }
  await ensureCampaignSchema();
  await sql!`
    UPDATE campaign_contacts
    SET status = 'queued', attempts = GREATEST(0, attempts - 1), last_attempt_at = NULL
    WHERE id = ${id}
  `;
}

/**
 * Closes the loop from the other end: the telephony bridge knows a call has
 * finished and with what outcome, but knows the call id, not the contact id.
 *
 * A campaign contact is only `completed` once the call it belongs to has
 * actually ended. Marking it complete when the call is *placed* would count a
 * number that rang out as a successful contact.
 */
export async function settleContactByCallId(
  callId: string,
  status: ContactStatus,
  failureReason?: string,
): Promise<boolean> {
  if (!usingPostgres) {
    for (const c of memory.contacts.values()) {
      if (c.callId === callId) {
        c.status = status;
        c.failureReason = failureReason;
        return true;
      }
    }
    return false;
  }
  await ensureCampaignSchema();
  const rows = (await sql!`
    UPDATE campaign_contacts SET status = ${status}, failure_reason = ${failureReason ?? null}
    WHERE call_id = ${callId} RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

/**
 * Returns contacts stuck in `calling` past `staleAfterMs` to the queue.
 *
 * Without this the queue leaks. A dispatcher that claims a row and then dies —
 * a serverless function timing out mid-tick is the ordinary case, not a rare
 * one — leaves that contact marked `calling` forever, so it is never retried
 * and never counted as failed. It simply disappears.
 */
export async function reclaimStaleContacts(
  campaignId: string,
  staleAfterMs = 15 * 60_000,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - staleAfterMs);

  if (!usingPostgres) {
    let n = 0;
    for (const c of memory.contacts.values()) {
      if (c.campaignId !== campaignId || c.status !== "calling") continue;
      if (c.lastAttemptAt && new Date(c.lastAttemptAt) > cutoff) continue;
      c.status = "no_answer";
      c.failureReason = "Dispatcher did not report an outcome";
      n++;
    }
    return n;
  }

  await ensureCampaignSchema();
  const rows = (await sql!`
    UPDATE campaign_contacts
    SET status = 'no_answer', failure_reason = 'Dispatcher did not report an outcome'
    WHERE campaign_id = ${campaignId} AND status = 'calling'
      AND (last_attempt_at IS NULL OR last_attempt_at < ${cutoff.toISOString()})
    RETURNING id
  `) as { id: string }[];
  return rows.length;
}

/** Test seam — the in-memory backend is process-global and leaks between tests. */
export function __resetCampaignMemory() {
  memory.campaigns.clear();
  memory.contacts.clear();
}
