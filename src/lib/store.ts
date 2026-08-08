import "server-only";
import { neon } from "@neondatabase/serverless";
import type { ActionResult } from "./actions/types";
import type {
  CallRecord,
  CallSummary,
  CallTelemetry,
  GroundednessReport,
  HandoffRequest,
  LeadRequirements,
  SentimentTrajectory,
  ToolInvocation,
  TranscriptTurn,
} from "./types";

/**
 * Call + lead persistence.
 *
 * Two backends behind one interface:
 *  - Postgres (Neon free tier) when DATABASE_URL is set — this is what the
 *    deployed demo uses, because Vercel functions are stateless and anything
 *    held in module scope disappears between invocations.
 *  - An in-memory map otherwise, so `pnpm dev` works with zero setup and the
 *    reviewer can clone-and-run without provisioning a database.
 *
 * The schema is deliberately document-ish (jsonb for transcript/requirements/
 * summary). The shape of a call record is driven by the model's tool calls and
 * changes often; normalising it would buy nothing here.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const usingPostgres = Boolean(DATABASE_URL);

const sql = usingPostgres ? neon(DATABASE_URL!) : null;

export function storageBackend(): "postgres" | "memory" {
  return usingPostgres ? "postgres" : "memory";
}

/* ------------------------------------------------------------------ */
/* In-memory fallback                                                  */
/* ------------------------------------------------------------------ */

// Survives HMR in dev by hanging off globalThis.
const memoryStore: Map<string, CallRecord> = (() => {
  const g = globalThis as unknown as { __callStore?: Map<string, CallRecord> };
  if (!g.__callStore) g.__callStore = new Map();
  return g.__callStore;
})();

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!usingPostgres) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql!`
        CREATE TABLE IF NOT EXISTS calls (
          id             TEXT PRIMARY KEY,
          channel        TEXT NOT NULL DEFAULT 'browser',
          status         TEXT NOT NULL DEFAULT 'in_progress',
          started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at       TIMESTAMPTZ,
          duration_sec   INTEGER,
          from_number    TEXT,
          transcript     JSONB NOT NULL DEFAULT '[]'::jsonb,
          tool_calls     JSONB NOT NULL DEFAULT '[]'::jsonb,
          requirements   JSONB NOT NULL DEFAULT '{}'::jsonb,
          summary        JSONB,
          telemetry      JSONB,
          groundedness   JSONB,
          sentiment      JSONB,
          handoff        JSONB,
          actions        JSONB,
          profile_id     TEXT,
          campaign_id    TEXT
        )
      `;
      await sql!`CREATE INDEX IF NOT EXISTS calls_started_at_idx ON calls (started_at DESC)`;
      // Added after the table shipped, so each is a separate idempotent step
      // rather than a change to the CREATE above — an existing deployment must
      // pick these up without a manual migration.
      for (const col of [
        "telemetry JSONB",
        "groundedness JSONB",
        "sentiment JSONB",
        "handoff JSONB",
        "actions JSONB",
        "profile_id TEXT",
        "campaign_id TEXT",
      ]) {
        await sql!.query(`ALTER TABLE calls ADD COLUMN IF NOT EXISTS ${col}`);
      }
      await sql!`CREATE INDEX IF NOT EXISTS calls_campaign_idx ON calls (campaign_id)`;
    })().catch((e) => {
      // Reset so a transient connection failure doesn't poison every later request.
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

type Row = {
  id: string;
  channel: string;
  status: string;
  started_at: string | Date;
  ended_at: string | Date | null;
  duration_sec: number | null;
  from_number: string | null;
  transcript: TranscriptTurn[];
  tool_calls: ToolInvocation[];
  requirements: LeadRequirements;
  summary: CallSummary | null;
  telemetry: CallTelemetry | null;
  groundedness: GroundednessReport | null;
  sentiment: SentimentTrajectory | null;
  handoff: HandoffRequest | null;
  actions: ActionResult[] | null;
  profile_id: string | null;
  campaign_id: string | null;
};

function rowToRecord(r: Row): CallRecord {
  return {
    id: r.id,
    channel: r.channel as CallRecord["channel"],
    status: r.status as CallRecord["status"],
    startedAt: new Date(r.started_at).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : undefined,
    durationSec: r.duration_sec ?? undefined,
    fromNumber: r.from_number ?? undefined,
    transcript: r.transcript ?? [],
    toolCalls: r.tool_calls ?? [],
    requirements: r.requirements ?? {},
    summary: r.summary ?? undefined,
    telemetry: r.telemetry ?? undefined,
    groundedness: r.groundedness ?? undefined,
    sentiment: r.sentiment ?? undefined,
    handoff: r.handoff ?? undefined,
    actions: r.actions ?? undefined,
    profileId: r.profile_id ?? undefined,
    campaignId: r.campaign_id ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export interface CreateCallInput {
  id: string;
  channel: CallRecord["channel"];
  fromNumber?: string;
}

export async function createCall(input: CreateCallInput): Promise<CallRecord> {
  const record: CallRecord = {
    id: input.id,
    channel: input.channel,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    fromNumber: input.fromNumber,
    transcript: [],
    toolCalls: [],
    requirements: {},
  };

  if (usingPostgres) {
    await ensureSchema();
    await sql!`
      INSERT INTO calls (id, channel, status, started_at, from_number)
      VALUES (${record.id}, ${record.channel}, 'in_progress', ${record.startedAt}, ${input.fromNumber ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  } else {
    memoryStore.set(record.id, record);
  }
  return record;
}

export interface UpdateCallInput {
  transcript?: TranscriptTurn[];
  toolCalls?: ToolInvocation[];
  requirements?: LeadRequirements;
  summary?: CallSummary;
  telemetry?: CallTelemetry;
  groundedness?: GroundednessReport;
  sentiment?: SentimentTrajectory;
  handoff?: HandoffRequest;
  actions?: ActionResult[];
  profileId?: string;
  campaignId?: string;
  status?: CallRecord["status"];
  endedAt?: string;
  durationSec?: number;
}

export async function updateCall(id: string, patch: UpdateCallInput): Promise<CallRecord | null> {
  if (usingPostgres) {
    await ensureSchema();
    // COALESCE keeps the existing value when a field isn't part of this patch,
    // so partial updates from the live client never clobber the summary.
    const rows = (await sql!`
      UPDATE calls SET
        transcript   = COALESCE(${patch.transcript ? JSON.stringify(patch.transcript) : null}::jsonb, transcript),
        tool_calls   = COALESCE(${patch.toolCalls ? JSON.stringify(patch.toolCalls) : null}::jsonb, tool_calls),
        requirements = COALESCE(${patch.requirements ? JSON.stringify(patch.requirements) : null}::jsonb, requirements),
        summary      = COALESCE(${patch.summary ? JSON.stringify(patch.summary) : null}::jsonb, summary),
        telemetry    = COALESCE(${patch.telemetry ? JSON.stringify(patch.telemetry) : null}::jsonb, telemetry),
        groundedness = COALESCE(${patch.groundedness ? JSON.stringify(patch.groundedness) : null}::jsonb, groundedness),
        sentiment    = COALESCE(${patch.sentiment ? JSON.stringify(patch.sentiment) : null}::jsonb, sentiment),
        handoff      = COALESCE(${patch.handoff ? JSON.stringify(patch.handoff) : null}::jsonb, handoff),
        actions      = COALESCE(${patch.actions ? JSON.stringify(patch.actions) : null}::jsonb, actions),
        profile_id   = COALESCE(${patch.profileId ?? null}, profile_id),
        campaign_id  = COALESCE(${patch.campaignId ?? null}, campaign_id),
        status       = COALESCE(${patch.status ?? null}, status),
        ended_at     = COALESCE(${patch.endedAt ?? null}::timestamptz, ended_at),
        duration_sec = COALESCE(${patch.durationSec ?? null}, duration_sec)
      WHERE id = ${id}
      RETURNING *
    `) as unknown as Row[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  const existing = memoryStore.get(id);
  if (!existing) return null;
  const next: CallRecord = {
    ...existing,
    transcript: patch.transcript ?? existing.transcript,
    toolCalls: patch.toolCalls ?? existing.toolCalls,
    requirements: patch.requirements ?? existing.requirements,
    summary: patch.summary ?? existing.summary,
    telemetry: patch.telemetry ?? existing.telemetry,
    groundedness: patch.groundedness ?? existing.groundedness,
    sentiment: patch.sentiment ?? existing.sentiment,
    handoff: patch.handoff ?? existing.handoff,
    actions: patch.actions ?? existing.actions,
    profileId: patch.profileId ?? existing.profileId,
    campaignId: patch.campaignId ?? existing.campaignId,
    status: patch.status ?? existing.status,
    endedAt: patch.endedAt ?? existing.endedAt,
    durationSec: patch.durationSec ?? existing.durationSec,
  };
  memoryStore.set(id, next);
  return next;
}

export async function getCall(id: string): Promise<CallRecord | null> {
  if (usingPostgres) {
    await ensureSchema();
    const rows = (await sql!`SELECT * FROM calls WHERE id = ${id}`) as unknown as Row[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }
  return memoryStore.get(id) ?? null;
}

export async function listCalls(limit = 100): Promise<CallRecord[]> {
  if (usingPostgres) {
    await ensureSchema();
    const rows = (await sql!`SELECT * FROM calls ORDER BY started_at DESC LIMIT ${limit}`) as unknown as Row[];
    return rows.map(rowToRecord);
  }
  return Array.from(memoryStore.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

/**
 * Just the columns the ops dashboard aggregates over.
 *
 * `listCalls` returns whole records — transcript, tool calls, summary, all
 * jsonb. Computing a latency percentile from that means pulling every
 * transcript in the table across the wire to read two numbers off each one,
 * which on a serverless Postgres is the difference between a fast page and a
 * page that visibly hangs.
 */
export interface CallAnalyticsRow {
  telemetry?: CallTelemetry;
  groundedness?: GroundednessReport;
}

export async function listCallAnalytics(limit = 500): Promise<CallAnalyticsRow[]> {
  if (!usingPostgres) {
    return [...memoryStore.values()]
      .slice(0, limit)
      .map((c) => ({ telemetry: c.telemetry, groundedness: c.groundedness }));
  }
  await ensureSchema();
  const rows = (await sql!`
    SELECT telemetry, groundedness FROM calls
    WHERE telemetry IS NOT NULL OR groundedness IS NOT NULL
    ORDER BY started_at DESC LIMIT ${limit}
  `) as { telemetry: CallTelemetry | null; groundedness: GroundednessReport | null }[];
  return rows.map((r) => ({ telemetry: r.telemetry ?? undefined, groundedness: r.groundedness ?? undefined }));
}

export async function deleteCall(id: string): Promise<boolean> {
  if (usingPostgres) {
    await ensureSchema();
    const rows = (await sql!`DELETE FROM calls WHERE id = ${id} RETURNING id`) as unknown as { id: string }[];
    return rows.length > 0;
  }
  return memoryStore.delete(id);
}
