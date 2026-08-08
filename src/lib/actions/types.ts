import type { CallRecord } from "../types";

/**
 * What happens after the call ends.
 *
 * A qualified lead is worth nothing sitting in a database. In a real
 * deployment this is where it reaches a CRM, a calendar, a WhatsApp thread.
 * Each of those is a different vendor with a different failure mode, so they
 * sit behind one interface rather than being inlined into the summary route —
 * adding "push to Salesforce" should be a new file, not an edit to the call
 * pipeline.
 *
 * Three rules the runner enforces so a provider cannot damage the call:
 *
 *   1. A provider never fails the request. The call and its summary are already
 *      saved by the time actions run; a CRM being down must not lose them.
 *   2. A provider is bounded in time. A webhook that hangs would otherwise hold
 *      the serverless function open until it is killed, and the summary would
 *      appear to fail for a reason that has nothing to do with it.
 *   3. A provider says when it did nothing. "Not configured" is a normal state
 *      here, and it has to be distinguishable from "tried and failed".
 */

export interface ActionContext {
  call: CallRecord;
  /**
   * Stable across retries of the same call, so a provider that is invoked twice
   * can recognise the second one. The summary route can legitimately be called
   * again with `force`, and a lead posted twice to a CRM is a real support
   * ticket.
   */
  idempotencyKey: string;
}

export type ActionStatus = "sent" | "skipped" | "failed";

export interface ActionResult {
  provider: string;
  status: ActionStatus;
  /** Human-readable: what happened, or why nothing did. */
  detail: string;
  /** Anything worth showing in the UI — an ICS payload, a webhook status code. */
  data?: Record<string, unknown>;
  at: string;
  durationMs: number;
}

export interface ActionProvider {
  name: string;
  /** One line for the ops dashboard, explaining what this does when enabled. */
  description: string;
  /**
   * Whether this provider is configured. Checked before `run`, so an unconfigured
   * provider reports "skipped" with a reason instead of failing on a missing
   * credential.
   */
  isConfigured(): boolean;
  /** Why it is not configured — shown in the dashboard so it is fixable. */
  configurationHint(): string;
  /**
   * Whether this particular call warrants the action. A lead who hung up
   * immediately should not get a calendar invite.
   */
  shouldRun(ctx: ActionContext): boolean;
  run(ctx: ActionContext): Promise<Omit<ActionResult, "provider" | "at" | "durationMs">>;
}
