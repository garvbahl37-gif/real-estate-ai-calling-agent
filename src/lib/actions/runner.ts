import { createHash } from "node:crypto";
import type { CallRecord } from "../types";
import { BUILT_IN_PROVIDERS } from "./providers";
import type { ActionProvider, ActionResult } from "./types";

/**
 * Runs the post-call actions.
 *
 * The contract this enforces is that nothing here can hurt the call. By the
 * time it runs, the transcript, the summary and the lead are already saved; a
 * CRM being down at that moment is a delivery problem, not a data-loss one, and
 * the code is written so it stays that way.
 */

/**
 * Stable for a given call and its captured lead.
 *
 * Not just the call id: re-running the summary after the lead was corrected
 * *should* produce a new delivery, while re-running it over identical data
 * should not. Hashing the payload-relevant fields gets both, and gives the
 * receiving system something to deduplicate on.
 */
export function idempotencyKeyFor(call: CallRecord): string {
  const r = call.requirements;
  const material = JSON.stringify([
    call.id,
    r.name,
    r.phone,
    r.email,
    r.budgetMinInr,
    r.budgetMaxInr,
    r.interestedProjectIds,
    r.siteVisitRequested,
    call.summary?.qualification?.score,
  ]);
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export async function runPostCallActions(
  call: CallRecord,
  providers: ActionProvider[] = BUILT_IN_PROVIDERS,
): Promise<ActionResult[]> {
  const ctx = { call, idempotencyKey: idempotencyKeyFor(call) };

  // Concurrent because they are independent, and settled rather than awaited as
  // a group because one provider throwing must not take the others with it.
  const settled = await Promise.allSettled(
    providers.map(async (provider): Promise<ActionResult> => {
      const startedAt = Date.now();
      const stamp = (r: Omit<ActionResult, "provider" | "at" | "durationMs">): ActionResult => ({
        provider: provider.name,
        ...r,
        at: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });

      if (!provider.isConfigured()) {
        return stamp({ status: "skipped", detail: provider.configurationHint() });
      }
      if (!provider.shouldRun(ctx)) {
        return stamp({ status: "skipped", detail: "Nothing on this call warranted it." });
      }

      try {
        return stamp(await provider.run(ctx));
      } catch (err) {
        // A provider that throws is a bug in the provider, not a reason to lose
        // the others' results or to fail the request.
        return stamp({ status: "failed", detail: `Provider threw: ${(err as Error).message}` });
      }
    }),
  );

  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          provider: providers[i].name,
          status: "failed" as const,
          detail: `Provider could not be run: ${String(s.reason)}`,
          at: new Date().toISOString(),
          durationMs: 0,
        },
  );
}

/** What the ops dashboard shows: which actions exist and whether they are live. */
export function describeProviders(providers: ActionProvider[] = BUILT_IN_PROVIDERS) {
  return providers.map((p) => ({
    name: p.name,
    description: p.description,
    configured: p.isConfigured(),
    hint: p.isConfigured() ? undefined : p.configurationHint(),
  }));
}
