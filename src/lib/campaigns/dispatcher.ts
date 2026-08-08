import "server-only";
import { explainTwilioError, placeOutboundCall } from "../../../telephony/outbound";
import { callingEnabled } from "../ops-auth";
import type { Campaign, CampaignContact } from "../types";
import {
  campaignProgress,
  claimDueContacts,
  reclaimStaleContacts,
  releaseContact,
  runningCampaigns,
  setCampaignStatus,
  settleContact,
} from "./store";
import { isWithinWindow, istLabel, nextAttemptAt, nextWindowOpen } from "./window";

/**
 * The campaign dispatcher.
 *
 * Design constraint: this runs on Vercel, where there is no long-lived worker
 * process. So it is a `tick()` — idempotent, bounded, safe to run concurrently
 * with itself — driven by a cron rather than a loop. Everything that would
 * normally live in a worker's memory (which contacts are in flight, how many
 * attempts each has had) lives in Postgres instead, which is also what makes it
 * survive a deploy mid-campaign.
 *
 * The call placer is injected. That is not test scaffolding for its own sake:
 * this project's Twilio account is a trial that cannot complete outbound calls,
 * so the queue's behaviour under retries, concurrency limits and window
 * closures is proven against a fake placer rather than asserted and hoped for.
 */

export type CallOutcome =
  | { kind: "placed"; callId: string }
  | { kind: "no_answer" }
  /** Terminal — a wrong number will still be wrong tomorrow. */
  | { kind: "invalid"; reason: string }
  /** Transient — worth another attempt. */
  | { kind: "error"; reason: string }
  /** Not dialled at all. The claim is released, so nothing is consumed. */
  | { kind: "suppressed"; reason: string };

export type CallPlacer = (contact: CampaignContact, campaign: Campaign) => Promise<CallOutcome>;

/**
 * Dials nothing and reports why.
 *
 * This is the default in every deployment. The queue still runs completely —
 * claim, retry, back off, respect the window — so the engine is observable
 * without an unsolicited call reaching anyone.
 */
export const dryRunPlacer: CallPlacer = async () => ({
  kind: "suppressed",
  reason: "Calling is disabled (set CAMPAIGNS_ENABLED=true to dial for real)",
});

/** The real one. Everything it needs comes from the environment. */
export const twilioPlacer: CallPlacer = async (contact) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const from = process.env.TWILIO_PHONE_NUMBER ?? "";
  const host = (process.env.TELEPHONY_PUBLIC_HOST ?? "").replace(/\/$/, "");

  if (!accountSid || !from || !host) {
    return { kind: "error", reason: "Telephony is not configured (account, number or public host missing)" };
  }

  try {
    const call = await placeOutboundCall({
      accountSid,
      authToken,
      apiKeySid: process.env.TWILIO_API_KEY_SID,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
      to: contact.phone,
      from,
      answerUrl: `${host}/twiml`,
    });
    return { kind: "placed", callId: call.sid };
  } catch (err) {
    const code = (err as { code?: number }).code;
    // 21211 invalid number, 21217 not a valid mobile, 13224 blocked destination.
    // These do not become valid on a retry, so burning attempts on them just
    // delays the campaign finishing.
    if (code === 21211 || code === 21217 || code === 13224) {
      return { kind: "invalid", reason: explainTwilioError(err) };
    }
    return { kind: "error", reason: explainTwilioError(err) };
  }
};

export interface TickResult {
  campaignId: string;
  campaignName: string;
  placed: number;
  /** Attempted and did not connect — counts against the contact's retries. */
  skipped: number;
  /** Never dialled; the claim was released untouched. */
  suppressed: number;
  reclaimed: number;
  /** Why nothing was dialled, when nothing was. */
  note?: string;
}

/**
 * Advances one campaign by at most `maxConcurrent - inFlight` calls.
 *
 * Order matters here: stale contacts are reclaimed *before* in-flight is
 * counted, or a leaked `calling` row permanently consumes a concurrency slot
 * and the campaign silently throttles itself to nothing.
 */
export async function tickCampaign(
  campaign: Campaign,
  place: CallPlacer = twilioPlacer,
  now = new Date(),
): Promise<TickResult> {
  const base = { campaignId: campaign.id, campaignName: campaign.name, placed: 0, skipped: 0, suppressed: 0 };

  // Same clock as the rest of the tick — a reclaim that reads its own wall
  // time would decide staleness against a different instant than the one
  // used to claim, which is exactly the kind of skew that only shows up
  // under load.
  const reclaimed = await reclaimStaleContacts(campaign.id, undefined, now);

  if (!isWithinWindow(now, campaign)) {
    const opens = nextWindowOpen(now, campaign);
    return {
      ...base,
      reclaimed,
      note: `Outside the calling window (${campaign.callWindowStartHour}:00–${campaign.callWindowEndHour}:00 IST). Resumes ${istLabel(opens)}.`,
    };
  }

  const progress = await campaignProgress(campaign.id);
  const slots = campaign.maxConcurrent - progress.calling;
  if (slots <= 0) {
    return { ...base, reclaimed, note: `At the concurrency ceiling (${campaign.maxConcurrent} in flight).` };
  }

  const claimed = await claimDueContacts(campaign.id, slots, now);
  if (!claimed.length) {
    // A campaign is finished only when nothing can still happen to it.
    //
    // Checking `queued` and `calling` alone is not enough, and getting this
    // wrong loses leads silently: a contact awaiting a retry sits in
    // `no_answer` with a future nextAttemptAt, so it is neither queued nor
    // calling. Closing the campaign on that basis marks it completed, and
    // runningCampaigns() then drops it — so the retry never happens and nobody
    // is told. `noAnswer` here counts exactly those pending retries, because a
    // contact that has exhausted its attempts is moved to `failed`.
    const pendingRetries = progress.noAnswer;
    if (progress.calling === 0 && progress.queued === 0 && pendingRetries === 0) {
      await setCampaignStatus(campaign.id, "completed");
      return { ...base, reclaimed, note: "All contacts settled — campaign complete." };
    }
    return {
      ...base,
      reclaimed,
      note: pendingRetries ? `Nothing due yet — ${pendingRetries} awaiting retry.` : "Nothing due yet.",
    };
  }

  let placed = 0;
  let skipped = 0;
  let suppressed = 0;
  let suppressedReason = "";

  // Sequential on purpose. `slots` is small by design (telephony providers
  // rate-limit hard, and a burst of simultaneous dials is what gets a number
  // flagged), so the concurrency win is negligible against the risk.
  for (const contact of claimed) {
    const outcome = await place(contact, campaign);
    const exhausted = contact.attempts >= campaign.maxAttempts;

    switch (outcome.kind) {
      case "placed":
        // Stays `calling`. The bridge moves it to `completed` when the call
        // ends (settleContactByCallId); reclaimStaleContacts is the backstop
        // if that never happens.
        await settleContact(contact.id, { status: "calling", callId: outcome.callId });
        placed++;
        break;

      case "suppressed":
        await releaseContact(contact.id);
        suppressed++;
        suppressedReason = outcome.reason;
        break;

      case "invalid":
        await settleContact(contact.id, { status: "failed", failureReason: outcome.reason });
        skipped++;
        break;

      case "no_answer":
      case "error": {
        const reason = outcome.kind === "no_answer" ? "No answer" : outcome.reason;
        if (exhausted) {
          await settleContact(contact.id, {
            status: "failed",
            failureReason: `${reason} (gave up after ${contact.attempts} attempts)`,
          });
        } else {
          await settleContact(contact.id, {
            status: "no_answer",
            failureReason: reason,
            nextAttemptAt: nextAttemptAt(contact.attempts, campaign, now),
          });
        }
        skipped++;
        break;
      }
    }
  }

  return {
    ...base,
    placed,
    skipped,
    suppressed,
    reclaimed,
    ...(suppressed && !placed ? { note: suppressedReason } : {}),
  };
}

/** Whichever placer the environment permits. Safe by default. */
export function activePlacer(): CallPlacer {
  return callingEnabled() ? twilioPlacer : dryRunPlacer;
}

/** One pass over every running campaign. This is what the cron route calls. */
export async function tickAll(place: CallPlacer = activePlacer(), now = new Date()): Promise<TickResult[]> {
  const campaigns = await runningCampaigns();
  const results: TickResult[] = [];
  for (const c of campaigns) results.push(await tickCampaign(c, place, now));
  return results;
}
