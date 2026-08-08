/**
 * Phone redaction.
 *
 * Written after an audit found the campaign detail route returning uploaded
 * contact numbers to anyone who read a campaign id out of the public listing.
 * The numbers in this demo are real — whoever tries the agent types their own
 * mobile, and a campaign list is third parties who never touched the system —
 * so these tests exist to keep the mask from quietly regressing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskPhone, redactCall, scrubSpokenNumbers } from "../src/lib/redact";
import type { CallRecord } from "../src/lib/types";

describe("maskPhone", () => {
  it("leaves too little to dial", () => {
    const masked = maskPhone("+919810012345")!;
    assert.ok(!masked.includes("9810012345"), "the full number survived masking");
    assert.match(masked, /•/);
  });

  it("keeps enough for an operator to recognise a number they know", () => {
    const masked = maskPhone("+919810012345")!;
    assert.ok(masked.startsWith("+9198"), "lost the country code and prefix");
    assert.ok(masked.endsWith("45"), "lost the last digits");
  });

  it("does not crash on absent or short values", () => {
    assert.equal(maskPhone(undefined), undefined);
    assert.equal(maskPhone(""), "");
    assert.equal(maskPhone("12345"), "•••••");
  });
});

describe("scrubSpokenNumbers", () => {
  it("masks a number the caller read out in the transcript", () => {
    // Masking the structured fields is not enough — this is where it actually
    // survived when the audit found it.
    const line = "Theek hai. Mera naam Rahul Verma hai, number 9810012345. Saturday morning theek rahega.";
    const out = scrubSpokenNumbers(line);
    assert.ok(!out.includes("9810012345"), "the spoken number survived");
    assert.ok(out.includes("Rahul Verma"), "scrubbing ate the rest of the sentence");
  });

  it("handles a number spoken with separators", () => {
    assert.ok(!scrubSpokenNumbers("number 98100 12345 hai").includes("98100 12345"));
    assert.ok(!scrubSpokenNumbers("98100-12345").includes("98100-12345"));
  });

  it("leaves the numbers she is supposed to say alone", () => {
    // Mangling these would make a transcript useless to read.
    for (const line of [
      "Sector 150 Noida ka sabse green sector hai",
      "plots available hain around 1.5 crore",
      "3BHK 1,650 sq ft ka hai, possession December 2027",
      "booking amount 5 lakh hai",
    ]) {
      assert.equal(scrubSpokenNumbers(line), line, `mangled: ${line}`);
    }
  });
});

describe("redactCall", () => {
  const call = {
    id: "call_1",
    channel: "phone",
    status: "completed",
    startedAt: "2026-03-10T06:00:00.000Z",
    transcript: [],
    toolCalls: [],
    fromNumber: "+919810012345",
    requirements: { name: "Rahul", phone: "+919899988776" },
    summary: {
      headline: "h",
      summary: "s",
      languagesUsed: [],
      qualification: { score: 90, band: "hot", reasoning: "" },
      requirements: { name: "Rahul", phone: "+919899988776" },
      objections: [],
      nextAction: "",
      agentNotes: "",
    },
  } as unknown as CallRecord;

  it("masks every place a number hides on a record", () => {
    // The number appears three times: the caller id, the captured requirement,
    // and the summary's own copy. Missing any one of them leaks it.
    const json = JSON.stringify(redactCall(call));
    assert.ok(!json.includes("9810012345"), "fromNumber leaked");
    assert.ok(!json.includes("9899988776"), "a requirements phone leaked");
  });

  it("masks a number spoken in the transcript and captured in a tool call", () => {
    const withTalk = {
      ...call,
      transcript: [{ role: "customer", text: "Mera number 9810012345 hai", at: 1, id: "t1", partial: false }],
      toolCalls: [{ id: "fc1", name: "update_lead_requirements", args: { phone: "+919810012345" }, at: 2 }],
    } as unknown as CallRecord;
    const json = JSON.stringify(redactCall(withTalk));
    assert.ok(!json.includes("9810012345"), "a number leaked through the transcript or tool args");
  });

  it("leaves identifiers alone", () => {
    // A tool call id is a long digit run that is not a phone number; mangling
    // it would break correlation between the transcript and the tool log.
    const withIds = {
      ...call,
      toolCalls: [{ id: "fc_5859909964309661584", name: "search_projects", args: { projectId: "skyline-greens" }, at: 1 }],
    } as unknown as CallRecord;
    const out = redactCall(withIds) as unknown as { toolCalls: { id: string; args: { projectId: string } }[] };
    assert.equal(out.toolCalls[0].id, "fc_5859909964309661584");
    assert.equal(out.toolCalls[0].args.projectId, "skyline-greens");
  });

  it("drops the conversation entirely when asked", () => {
    const r = redactCall(call, false);
    assert.deepEqual(r.transcript, []);
    assert.deepEqual(r.toolCalls, []);
  });

  it("leaves everything else intact", () => {
    const r = redactCall(call);
    assert.equal(r.requirements.name, "Rahul");
    assert.equal(r.summary?.qualification.score, 90);
  });

  it("does not mutate the record it was given", () => {
    redactCall(call);
    assert.equal(call.fromNumber, "+919810012345", "redaction mutated the stored record");
  });
});
