/**
 * Post-call actions.
 *
 * The contract worth testing is the runner's, not any one provider's: by the
 * time actions run the call is already saved, so a provider that hangs, throws
 * or is misconfigured must degrade to a recorded result and nothing more. A
 * runner that propagates a provider failure would turn a CRM outage into lost
 * call summaries.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarInviteProvider, crmWebhookProvider } from "../src/lib/actions/providers";
import { idempotencyKeyFor, runPostCallActions } from "../src/lib/actions/runner";
import type { ActionProvider } from "../src/lib/actions/types";
import type { CallRecord } from "../src/lib/types";

const call = (over: Partial<CallRecord> = {}): CallRecord => ({
  id: "call_1",
  channel: "browser",
  status: "completed",
  startedAt: "2026-03-10T06:00:00.000Z",
  transcript: [],
  toolCalls: [],
  requirements: { name: "Rahul Verma", phone: "+919810012345", siteVisitRequested: true },
  ...over,
});

const provider = (over: Partial<ActionProvider>): ActionProvider => ({
  name: "test",
  description: "test provider",
  isConfigured: () => true,
  configurationHint: () => "hint",
  shouldRun: () => true,
  run: async () => ({ status: "sent", detail: "ok" }),
  ...over,
});

describe("action runner", () => {
  it("records a provider that throws instead of propagating it", async () => {
    const results = await runPostCallActions(call(), [
      provider({
        name: "explodes",
        run: async () => {
          throw new Error("connection reset");
        },
      }),
    ]);
    assert.equal(results[0].status, "failed");
    assert.match(results[0].detail, /connection reset/);
  });

  it("does not let one provider's failure hide another's success", async () => {
    const results = await runPostCallActions(call(), [
      provider({
        name: "bad",
        run: async () => {
          throw new Error("nope");
        },
      }),
      provider({ name: "good" }),
    ]);
    assert.deepEqual(
      results.map((r) => [r.provider, r.status]),
      [
        ["bad", "failed"],
        ["good", "sent"],
      ],
    );
  });

  it("skips an unconfigured provider with the reason, rather than failing it", async () => {
    // "Not configured" is a normal state and has to read differently from
    // "tried and failed", or the dashboard cannot tell you what to fix.
    const results = await runPostCallActions(call(), [
      provider({ isConfigured: () => false, configurationHint: () => "Set FOO_TOKEN." }),
    ]);
    assert.equal(results[0].status, "skipped");
    assert.match(results[0].detail, /Set FOO_TOKEN/);
  });

  it("does not run a provider the call did not warrant", async () => {
    let ran = false;
    const results = await runPostCallActions(call(), [
      provider({
        shouldRun: () => false,
        run: async () => {
          ran = true;
          return { status: "sent", detail: "should not happen" };
        },
      }),
    ]);
    assert.equal(ran, false);
    assert.equal(results[0].status, "skipped");
  });

  it("stamps every result with a provider, time and duration", async () => {
    const [r] = await runPostCallActions(call(), [provider({})]);
    assert.equal(r.provider, "test");
    assert.ok(Date.parse(r.at) > 0);
    assert.ok(r.durationMs >= 0);
  });
});

describe("idempotency key", () => {
  it("is stable for the same call and lead", () => {
    assert.equal(idempotencyKeyFor(call()), idempotencyKeyFor(call()));
  });

  it("changes when the captured lead changes", () => {
    // Re-running the summary after a correction should deliver again; re-running
    // it over identical data should not.
    const corrected = call({ requirements: { name: "Rahul Verma", phone: "+919899988776" } });
    assert.notEqual(idempotencyKeyFor(call()), idempotencyKeyFor(corrected));
  });

  it("differs between calls", () => {
    assert.notEqual(idempotencyKeyFor(call()), idempotencyKeyFor(call({ id: "call_2" })));
  });
});

describe("calendar invite", () => {
  const run = (c: CallRecord) => calendarInviteProvider.run({ call: c, idempotencyKey: "abc123" });

  it("only fires when a site visit was actually booked", () => {
    const ctx = (c: CallRecord) => ({ call: c, idempotencyKey: "k" });
    assert.equal(calendarInviteProvider.shouldRun(ctx(call())), true);
    assert.equal(
      calendarInviteProvider.shouldRun(ctx(call({ requirements: { name: "A", phone: "+919810012345" } }))),
      false,
    );
  });

  it("produces a well-formed VEVENT", async () => {
    const r = await run(call());
    const ics = String(r.data?.ics);
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /UID:abc123@/);
    assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
    assert.ok(ics.split("\r\n").every((l) => l.length <= 75 || l.startsWith(" ")), "a line was left unfolded");
  });

  it("escapes the characters iCalendar treats as structure", async () => {
    const r = await run(
      call({ requirements: { name: "Verma, Rahul", phone: "+919810012345", siteVisitRequested: true } }),
    );
    const ics = String(r.data?.ics);
    // A raw comma in a DESCRIPTION would end the value early.
    assert.match(ics, /Verma\\, Rahul/);
    assert.ok(!/DESCRIPTION:[^\r\n]*[^\\],/.test(ics), "found an unescaped comma in DESCRIPTION");
  });

  it("never splits a multi-byte character when folding", async () => {
    // The limit is in octets, the content is UTF-8, and this catalogue is full
    // of ₹ and Devanagari. A naive octet split emits U+FFFD on unfold.
    const r = await run(
      call({
        requirements: {
          name: "राहुल वर्मा",
          phone: "+919810012345",
          siteVisitRequested: true,
          siteVisitPreference: "शनिवार सुबह ग्यारह बजे, सेक्टर एक सौ पचास में मिलते हैं ठीक है",
        },
      }),
    );
    const ics = String(r.data?.ics);
    assert.ok(!ics.includes("\uFFFD"), "folding produced a replacement character");
    // Unfolding must reproduce the original text exactly.
    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(unfolded.includes("राहुल वर्मा"), "the name did not survive a fold");
    assert.ok(unfolded.includes("शनिवार सुबह ग्यारह बजे"), "the preference did not survive a fold");
    assert.ok(
      ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75 || l.startsWith(" ")),
      "a line exceeded 75 octets",
    );
  });

  it("carries the caller's own words rather than inventing a slot", async () => {
    const r = await run(
      call({
        requirements: {
          name: "Rahul",
          phone: "+919810012345",
          siteVisitRequested: true,
          siteVisitPreference: "Saturday morning",
        },
      }),
    );
    assert.match(String(r.data?.ics), /Saturday morning/);
    assert.match(String(r.data?.ics), /PROVISIONAL/);
  });
});

describe("crm webhook", () => {
  it("is skipped rather than failed when no URL is set", async () => {
    const had = process.env.CRM_WEBHOOK_URL;
    delete process.env.CRM_WEBHOOK_URL;
    try {
      assert.equal(crmWebhookProvider.isConfigured(), false);
      const [r] = await runPostCallActions(call(), [crmWebhookProvider]);
      assert.equal(r.status, "skipped");
      assert.match(r.detail, /CRM_WEBHOOK_URL/);
    } finally {
      if (had) process.env.CRM_WEBHOOK_URL = had;
    }
  });

  it("does not fire for a call with no way to reach the lead", () => {
    const anonymous = call({ requirements: {}, fromNumber: undefined });
    assert.equal(crmWebhookProvider.shouldRun({ call: anonymous, idempotencyKey: "k" }), false);
  });
});
