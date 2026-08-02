import "server-only";
import { neon } from "@neondatabase/serverless";
import type { CallRecord, CallSummary, LeadRequirements, ToolInvocation, TranscriptTurn } from "./types";

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
          summary        JSONB
        )
      `;
      await sql!`CREATE INDEX IF NOT EXISTS calls_started_at_idx ON calls (started_at DESC)`;
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

export async function deleteCall(id: string): Promise<boolean> {
  if (usingPostgres) {
    await ensureSchema();
    const rows = (await sql!`DELETE FROM calls WHERE id = ${id} RETURNING id`) as unknown as { id: string }[];
    return rows.length > 0;
  }
  return memoryStore.delete(id);
}
