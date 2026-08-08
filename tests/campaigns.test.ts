/**
 * The campaign engine.
 *
 * These tests exist because the failure modes here are invisible in a demo but
 * expensive in production: dialling the same lead twice, calling someone at
 * 22:00, or silently leaking a contact so it is never called at all. None of
 * those show up as an error — they show up as a complaint weeks later.
 *
 * The call placer is injected throughout, so retries, concurrency ceilings and
 * window closures are exercised against a fake rather than against Twilio.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseContactCsv } from "../src/lib/campaigns/contacts";
import type { CallOutcome, CallPlacer } from "../src/lib/campaigns/dispatcher";
import { tickCampaign } from "../src/lib/campaigns/dispatcher";
import {
  __resetCampaignMemory,
  addContacts,
  campaignProgress,
  claimDueContacts,
  createCampaign,
  listContacts,
  reclaimStaleContacts,
  settleContactByCallId,
} from "../src/lib/campaigns/store";
import {
  DEFAULT_WINDOW,
  isWithinWindow,
  istHour,
  nextAttemptAt,
  nextWindowOpen,
} from "../src/lib/campaigns/window";
import type { Campaign } from "../src/lib/types";

/** 2026-03-10 is a Tuesday. IST = UTC+5:30, so 06:00Z is 11:30 IST. */
const at = (utc: string) => new Date(`2026-03-10T${utc}Z`);

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: "camp1",
  name: "Sector 150 launch",
  profileId: "default",
  status: "running",
  createdAt: "2026-03-10T00:00:00.000Z",
  maxConcurrent: 2,
  maxAttempts: 3,
  ...DEFAULT_WINDOW_FIELDS,
  ...over,
});

const DEFAULT_WINDOW_FIELDS = {
  callWindowStartHour: DEFAULT_WINDOW.startHour,
  callWindowEndHour: DEFAULT_WINDOW.endHour,
};

/* ------------------------------------------------------------------ */

describe("calling window (TRAI 09:00–21:00 IST)", () => {
  it("reads the hour in IST regardless of where the server runs", () => {
    // Vercel runs UTC; the rule is about the person being called.
    assert.equal(istHour(at("06:00:00")), 11); // 11:30 IST
    assert.equal(istHour(at("18:30:00")), 0); // midnight IST, next day
  });

  it("opens at 09:00 and closes at 21:00, exclusive", () => {
    const w = campaign();
    assert.equal(isWithinWindow(at("03:31:00"), w), true); // 09:01 IST
    assert.equal(isWithinWindow(at("03:29:00"), w), false); // 08:59 IST
    assert.equal(isWithinWindow(at("15:29:00"), w), true); // 20:59 IST
    assert.equal(isWithinWindow(at("15:30:00"), w), false); // 21:00 IST — already too late
  });

  it("returns the same instant when the window is already open", () => {
    const now = at("06:00:00");
    assert.equal(nextWindowOpen(now, campaign()).getTime(), now.getTime());
  });

  it("waits for this morning when called before the window opens", () => {
    // 02:00Z = 07:30 IST, so the window opens at 09:00 IST = 03:30Z the same day.
    assert.equal(nextWindowOpen(at("02:00:00"), campaign()).toISOString(), "2026-03-10T03:30:00.000Z");
  });

  it("rolls to tomorrow morning when called after the window closes", () => {
    // 16:00Z = 21:30 IST, past close, so the next opening is tomorrow 09:00 IST.
    assert.equal(nextWindowOpen(at("16:00:00"), campaign()).toISOString(), "2026-03-11T03:30:00.000Z");
  });

  it("never schedules a retry outside the window", () => {
    // Fails at 20:58 IST; a naive +45min retry would land at 21:43 IST.
    const failedAt = at("15:28:00");
    const retry = nextAttemptAt(1, campaign(), failedAt);
    assert.equal(isWithinWindow(retry, campaign()), true);
    assert.equal(retry.toISOString(), "2026-03-11T03:30:00.000Z");
  });

  it("backs off further with each attempt", () => {
    const start = at("04:00:00"); // 09:30 IST, plenty of room
    const first = nextAttemptAt(1, campaign(), start).getTime();
    const second = nextAttemptAt(2, campaign(), start).getTime();
    assert.ok(second > first, "second retry should be further out than the first");
  });
});

/* ------------------------------------------------------------------ */

describe("contact CSV ingestion", () => {
  it("reads a normal export with headers", () => {
    const r = parseContactCsv("Name,Phone\nRahul Verma,9810012345\nPriya Singh,+91 98999 88776\n");
    assert.equal(r.contacts.length, 2);
    assert.deepEqual(r.contacts[0], { phone: "+919810012345", name: "Rahul Verma" });
    assert.equal(r.contacts[1].phone, "+919899988776");
  });

  it("accepts the header names people actually use", () => {
    const r = parseContactCsv("Full Name,Mobile Number\nAmit,9810012345\n");
    assert.equal(r.contacts[0].name, "Amit");
  });

  it("handles a headerless single column of numbers", () => {
    const r = parseContactCsv("9810012345\n9899988776\n");
    assert.equal(r.contacts.length, 2);
    assert.equal(r.contacts[0].name, undefined);
  });

  it("handles quoted fields containing commas", () => {
    const r = parseContactCsv('Name,Phone\n"Verma, Rahul",9810012345\n');
    assert.equal(r.contacts[0].name, "Verma, Rahul");
  });

  it("reports every rejected row with its spreadsheet line number", () => {
    const r = parseContactCsv("Name,Phone\nA,9810012345\nB,12345\nC,\nD,+14155552671\n");
    assert.equal(r.contacts.length, 1);
    assert.deepEqual(
      r.rejected.map((x) => x.row),
      [3, 4, 5],
    );
    assert.match(r.rejected[0].reason, /valid Indian mobile/);
    assert.match(r.rejected[1].reason, /No phone number/);
    assert.match(r.rejected[2].reason, /Only Indian mobile numbers/);
  });

  it("rejects landline-style numbers that cannot receive the campaign", () => {
    // Indian mobiles start 6–9; 1202… is not one.
    assert.equal(parseContactCsv("Phone\n1202345678\n").contacts.length, 0);
  });

  it("keeps the first of a duplicated number and counts the rest", () => {
    const r = parseContactCsv("Phone\n9810012345\n+919810012345\n098100 12345\n");
    assert.equal(r.contacts.length, 1);
    assert.equal(r.duplicates, 2);
  });

  it("suppresses do-not-call numbers without calling them errors", () => {
    const r = parseContactCsv("Phone\n9810012345\n9899988776\n", new Set(["+919810012345"]));
    assert.equal(r.contacts.length, 1);
    assert.equal(r.contacts[0].phone, "+919899988776");
    assert.match(r.rejected[0].reason, /do-not-call/);
  });
});

/* ------------------------------------------------------------------ */

describe("campaign queue", () => {
  beforeEach(() => __resetCampaignMemory());

  const seed = async (phones: string[], over: Partial<Campaign> = {}) => {
    const c = campaign(over);
    await createCampaign(c);
    await addContacts(
      c.id,
      phones.map((p) => ({ phone: p })),
      (i) => `contact${i}`,
    );
    return c;
  };

  const phones = (n: number) => Array.from({ length: n }, (_, i) => `+9198100${String(10000 + i)}`);

  it("does not hand the same contact to two workers", async () => {
    const c = await seed(phones(4));
    const first = await claimDueContacts(c.id, 2);
    const second = await claimDueContacts(c.id, 2);
    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    const ids = new Set([...first, ...second].map((x) => x.id));
    assert.equal(ids.size, 4, "a contact was claimed twice");
  });

  it("ignores contacts whose retry is not due yet", async () => {
    const c = await seed(phones(1));
    const [claimed] = await claimDueContacts(c.id, 1);
    const { settleContact } = await import("../src/lib/campaigns/store");
    await settleContact(claimed.id, { status: "no_answer", nextAttemptAt: at("12:00:00") });

    assert.equal((await claimDueContacts(c.id, 5, at("06:00:00"))).length, 0, "claimed before it was due");
    assert.equal((await claimDueContacts(c.id, 5, at("13:00:00"))).length, 1, "did not claim when due");
  });

  it("does not double-add a number already in the campaign", async () => {
    const c = await seed(["+919810010000"]);
    const added = await addContacts(c.id, [{ phone: "+919810010000" }], () => "dupe");
    assert.equal(added, 0);
    assert.equal((await listContacts(c.id)).length, 1);
  });

  it("returns a leaked in-flight contact to the queue", async () => {
    const c = await seed(phones(1));
    const [claimed] = await claimDueContacts(c.id, 1, new Date(Date.now() - 60 * 60_000));
    assert.equal(claimed.status, "calling");

    // A dispatcher that died mid-tick would leave this row `calling` forever,
    // consuming a concurrency slot and never being retried.
    assert.equal(await reclaimStaleContacts(c.id), 1);
    assert.equal((await campaignProgress(c.id)).calling, 0);
    assert.equal((await claimDueContacts(c.id, 1)).length, 1, "reclaimed contact was not re-queued");
  });

  it("only marks a contact completed once its call has ended", async () => {
    const c = await seed(phones(1));
    const [claimed] = await claimDueContacts(c.id, 1);
    const { settleContact } = await import("../src/lib/campaigns/store");
    await settleContact(claimed.id, { status: "calling", callId: "CA123" });

    assert.equal((await campaignProgress(c.id)).completed, 0, "completed before the call ended");
    assert.equal(await settleContactByCallId("CA123", "completed"), true);
    assert.equal((await campaignProgress(c.id)).completed, 1);
  });
});

/* ------------------------------------------------------------------ */

describe("dispatcher", () => {
  beforeEach(() => __resetCampaignMemory());

  const seed = async (n: number, over: Partial<Campaign> = {}) => {
    const c = campaign(over);
    await createCampaign(c);
    await addContacts(
      c.id,
      Array.from({ length: n }, (_, i) => ({ phone: `+9198100${String(10000 + i)}` })),
      (i) => `contact${i}`,
    );
    return c;
  };

  const placer = (outcome: CallOutcome | ((n: number) => CallOutcome)) => {
    let n = 0;
    const calls: string[] = [];
    const fn: CallPlacer = async (contact) => {
      calls.push(contact.phone);
      return typeof outcome === "function" ? outcome(n++) : outcome;
    };
    return { fn, calls };
  };

  const OPEN = at("06:00:00"); // 11:30 IST
  const CLOSED = at("18:00:00"); // 23:30 IST

  it("dials nobody outside the calling window", async () => {
    const c = await seed(5);
    const p = placer({ kind: "placed", callId: "CA1" });
    const r = await tickCampaign(c, p.fn, CLOSED);

    assert.equal(p.calls.length, 0, "dialled outside the TRAI window");
    assert.equal(r.placed, 0);
    assert.match(r.note ?? "", /Outside the calling window/);
    assert.match(r.note ?? "", /Resumes 09:00 IST/);
  });

  it("never exceeds the concurrency ceiling", async () => {
    const c = await seed(10, { maxConcurrent: 3 });
    const p = placer((n) => ({ kind: "placed", callId: `CA${n}` }));

    assert.equal((await tickCampaign(c, p.fn, OPEN)).placed, 3);
    // Those three are still in flight, so a second tick must place nothing.
    const second = await tickCampaign(c, p.fn, OPEN);
    assert.equal(second.placed, 0);
    assert.match(second.note ?? "", /concurrency ceiling/);
    assert.equal(p.calls.length, 3);
  });

  it("frees a slot when a call ends and dials the next contact", async () => {
    const c = await seed(4, { maxConcurrent: 1 });
    const p = placer((n) => ({ kind: "placed", callId: `CA${n}` }));

    await tickCampaign(c, p.fn, OPEN);
    await settleContactByCallId("CA0", "completed");
    await tickCampaign(c, p.fn, OPEN);

    assert.equal(p.calls.length, 2);
    assert.notEqual(p.calls[0], p.calls[1]);
  });

  it("retries a no-answer and gives up at maxAttempts", async () => {
    const c = await seed(1, { maxConcurrent: 1, maxAttempts: 2 });
    const p = placer({ kind: "no_answer" });

    await tickCampaign(c, p.fn, OPEN);
    let contact = (await listContacts(c.id))[0];
    assert.equal(contact.status, "no_answer");
    assert.equal(contact.attempts, 1);
    assert.ok(contact.nextAttemptAt, "no retry was scheduled");

    // Second attempt, once the retry is due, hits maxAttempts.
    const due = new Date(contact.nextAttemptAt!);
    await tickCampaign(c, p.fn, due);
    contact = (await listContacts(c.id))[0];
    assert.equal(contact.status, "failed");
    assert.equal(contact.attempts, 2);
    assert.match(contact.failureReason ?? "", /gave up after 2 attempts/);
    assert.equal(contact.nextAttemptAt, undefined, "a failed contact must not be re-queued");
  });

  it("leaves the queue untouched when calling is suppressed", async () => {
    // A dry run must be observable without consuming anything: the contact goes
    // back to `queued` with its attempt uncounted, ready to be dialled for real
    // the moment calling is enabled.
    const c = await seed(2, { maxConcurrent: 2, maxAttempts: 3 });
    const { dryRunPlacer } = await import("../src/lib/campaigns/dispatcher");

    const r = await tickCampaign(c, dryRunPlacer, OPEN);
    assert.equal(r.placed, 0);
    assert.equal(r.suppressed, 2);
    assert.equal(r.skipped, 0, "a suppressed contact must not count as an attempt");
    assert.match(r.note ?? "", /Calling is disabled/);

    for (const contact of await listContacts(c.id)) {
      assert.equal(contact.status, "queued");
      assert.equal(contact.attempts, 0, "a dry run burned a retry");
      assert.equal(contact.nextAttemptAt, undefined);
    }

    // And a real placer afterwards dials both, unaffected by the dry run.
    const p = placer((n) => ({ kind: "placed", callId: `CA${n}` }));
    assert.equal((await tickCampaign(c, p.fn, OPEN)).placed, 2);
  });

  it("does not retry a number that is permanently invalid", async () => {
    const c = await seed(1, { maxConcurrent: 1, maxAttempts: 3 });
    const p = placer({ kind: "invalid", reason: "Not a valid mobile number" });

    await tickCampaign(c, p.fn, OPEN);
    const contact = (await listContacts(c.id))[0];
    assert.equal(contact.status, "failed", "burned a retry on a number that cannot become valid");
    assert.equal(contact.attempts, 1);
  });

  it("marks the campaign complete once every contact is settled", async () => {
    const c = await seed(2, { maxConcurrent: 2 });
    const p = placer((n) => ({ kind: "placed", callId: `CA${n}` }));

    await tickCampaign(c, p.fn, OPEN);
    await settleContactByCallId("CA0", "completed");
    await settleContactByCallId("CA1", "completed");

    const r = await tickCampaign(c, p.fn, OPEN);
    assert.match(r.note ?? "", /campaign complete/i);
    const { getCampaign } = await import("../src/lib/campaigns/store");
    assert.equal((await getCampaign(c.id))!.status, "completed");
  });

  it("does not declare victory while retries are still pending", async () => {
    // A contact awaiting a retry is neither `queued` nor `calling`, so a
    // completion check that only looks at those two marks the campaign done
    // while work remains — and a completed campaign is dropped by
    // runningCampaigns(), so the retry never happens. Silent lead loss.
    const c = await seed(1, { maxConcurrent: 1, maxAttempts: 3 });
    const p = placer({ kind: "no_answer" });

    await tickCampaign(c, p.fn, OPEN);
    const contact = (await listContacts(c.id))[0];
    assert.equal(contact.status, "no_answer");
    assert.ok(contact.nextAttemptAt, "no retry scheduled");

    // Tick again before the retry is due: nothing to claim, but not finished.
    const r = await tickCampaign(c, p.fn, OPEN);
    assert.doesNotMatch(r.note ?? "", /complete/i, "declared complete with a retry pending");

    const { getCampaign } = await import("../src/lib/campaigns/store");
    assert.equal((await getCampaign(c.id))!.status, "running", "campaign was closed with work outstanding");

    // And once the retry comes due it is actually dialled.
    const live = placer((n) => ({ kind: "placed", callId: `CA${n}` }));
    assert.equal((await tickCampaign(c, live.fn, new Date(contact.nextAttemptAt!))).placed, 1);
  });

  it("reclaims leaked contacts before counting the concurrency ceiling", async () => {
    // Otherwise a single leaked row permanently throttles the campaign.
    const c = await seed(3, { maxConcurrent: 1 });
    // An hour before the tick, on the tick's clock — staleness is judged
    // against the instant the tick runs at, not against wall time.
    await claimDueContacts(c.id, 1, new Date(OPEN.getTime() - 60 * 60_000));

    const p = placer((n) => ({ kind: "placed", callId: `CA${n}` }));
    const r = await tickCampaign(c, p.fn, OPEN);
    assert.equal(r.reclaimed, 1);
    assert.equal(r.placed, 1, "leaked contact blocked the only slot");
  });
});
