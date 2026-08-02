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
