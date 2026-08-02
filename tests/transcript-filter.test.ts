import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHallucinatedScript } from "../src/lib/live-session";

describe("foreign-script transcription filter", () => {
  it("drops the Chinese bursts the ASR hallucinates from room noise", () => {
    // The reported failure: a caller speaking Hindi, transcript showing Chinese.
    assert.equal(isHallucinatedScript("好的，我明白了"), true);
    assert.equal(isHallucinatedScript("你好"), true);
    assert.equal(isHallucinatedScript("请问您的预算是多少"), true);
  });

  it("drops other scripts this agent never produces", () => {
    assert.equal(isHallucinatedScript("こんにちは"), true);
    assert.equal(isHallucinatedScript("안녕하세요"), true);
    assert.equal(isHallucinatedScript("Здравствуйте"), true);
    assert.equal(isHallucinatedScript("مرحبا"), true);
  });

  it("keeps Hindi", () => {
    assert.equal(isHallucinatedScript("नमस्ते! मैं प्रिया बोल रही हूँ, आरंभ रियल्टी से।"), false);
    assert.equal(isHallucinatedScript("मुझे सेक्टर 150 में 3BHK चाहिए"), false);
  });

  it("keeps Hinglish and English", () => {
    assert.equal(isHallucinatedScript("Main investment ke liye dekh raha hoon, Noida mein"), false);
    assert.equal(isHallucinatedScript("What's the possession timeline?"), false);
    assert.equal(isHallucinatedScript("3BHK chahiye, budget around 1.5 crore tak"), false);
  });

  it("keeps a good sentence containing one stray glyph", () => {
    // Dropping real speech is worse than showing one odd character, so the
    // filter is proportional rather than absolute.
    assert.equal(isHallucinatedScript("Sector 150 mein 3BHK available hai 好"), false);
  });

  it("ignores whitespace, punctuation and digits when judging", () => {
    assert.equal(isHallucinatedScript("   "), false);
    assert.equal(isHallucinatedScript("... 123 !!"), false);
    assert.equal(isHallucinatedScript(""), false);
  });

  it("catches a mostly-foreign fragment even with some Latin in it", () => {
    assert.equal(isHallucinatedScript("好的好的好的好的 ok"), true);
  });
});

describe("transcript assembly (regression guards)", () => {
  // These lock in three bugs that shipped and were visible on a real call.
  it("documents that agent text has exactly one source", () => {
    // modelTurn.parts[].text and outputAudioTranscription.text both carry the
    // agent's words. Appending both duplicated every sentence and leaked the
    // literal token "model" into the transcript. Only the transcription is used.
    const source = readFileSync(new URL("../src/lib/live-session.ts", import.meta.url), "utf8");
    assert.ok(
      !/if \(part\.text\) this\.appendAgentText/.test(source),
      "agent text must come only from outputAudioTranscription, never modelTurn parts",
    );
  });

  it("does not close one speaker's turn when the other speaks", () => {
    // Overlapping speech is normal on a call. Cross-finalising shredded one
    // sentence into "Hello, this" / "is Priya" / "from" / "Aarambh Realty".
    const source = readFileSync(new URL("../src/lib/live-session.ts", import.meta.url), "utf8");
    const appendCustomer = source.slice(source.indexOf("private appendCustomerText"), source.indexOf("private finalizeCustomerTurn"));
    assert.ok(!/finalizeAgentTurn\(\)/.test(appendCustomer), "appendCustomerText must not finalise the agent's turn");
    const appendAgent = source.slice(source.indexOf("private appendAgentText"), source.indexOf("private finalizeCustomerTurn"));
    assert.ok(!/finalizeCustomerTurn\(\)/.test(appendAgent), "appendAgentText must not finalise the caller's turn");
  });

  it("closes any open session before opening another", () => {
    // Two live sessions attached to the same player are heard as the agent
    // talking over herself.
    const source = readFileSync(new URL("../src/lib/live-session.ts", import.meta.url), "utf8");
    const connect = source.slice(source.indexOf("private async connect()"), source.indexOf("private async handleUnexpectedClose"));
    assert.ok(/if \(this\.session\)/.test(connect), "connect() must close an existing session first");
  });
});
