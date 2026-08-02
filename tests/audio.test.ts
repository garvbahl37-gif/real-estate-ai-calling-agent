import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkMuLaw,
  downsample24kTo8k,
  muLawBufferToPcm16,
  muLawToPcmSample,
  pcm16ToMuLawBuffer,
  pcmToMuLawSample,
  upsample8kTo16k,
} from "../telephony/audio";

describe("G.711 μ-law codec", () => {
  it("round-trips every μ-law byte except the negative-zero code", () => {
    // G.711 μ-law has two codes for zero — 0xFF (+0) and 0x7F (−0) — so a
    // decode→encode cycle cannot be a bijection over all 256 values. Every other
    // byte must survive intact; if one doesn't, phone audio picks up a rasp.
    const NEGATIVE_ZERO = 0x7f;
    for (let b = 0; b < 256; b++) {
      if (b === NEGATIVE_ZERO) continue;
      const pcm = muLawToPcmSample(b);
      assert.equal(pcmToMuLawSample(pcm), b, `byte ${b} did not round-trip (pcm ${pcm})`);
    }
  });

  it("decodes both zero codes to silence", () => {
    assert.equal(muLawToPcmSample(0xff), 0);
    assert.equal(muLawToPcmSample(0x7f), 0);
  });

  it("keeps quantisation error within the μ-law step size", () => {
    // μ-law is logarithmic: small signals are near-exact, loud ones coarser.
    // The bound scales with amplitude, which is the whole point of the codec.
    for (let sample = -32000; sample <= 32000; sample += 97) {
      const decoded = muLawToPcmSample(pcmToMuLawSample(sample));
      const tolerance = Math.max(8, Math.abs(sample) * 0.08);
      assert.ok(
        Math.abs(decoded - sample) <= tolerance,
        `sample ${sample} → ${decoded}, error ${Math.abs(decoded - sample)} exceeded ${tolerance}`,
      );
    }
  });

  it("preserves sign", () => {
    for (const s of [-30000, -1000, -100, 100, 1000, 30000]) {
      const decoded = muLawToPcmSample(pcmToMuLawSample(s));
      assert.equal(Math.sign(decoded), Math.sign(s), `sign flipped for ${s}`);
    }
  });

  it("clips beyond the μ-law range instead of wrapping", () => {
    // Wrapping would turn a loud positive peak into a loud negative one — an
    // audible crack rather than gentle clipping.
    const loud = muLawToPcmSample(pcmToMuLawSample(32767));
    const quiet = muLawToPcmSample(pcmToMuLawSample(-32768));
    assert.ok(loud > 30000, `positive clip collapsed to ${loud}`);
    assert.ok(quiet < -30000, `negative clip collapsed to ${quiet}`);
  });

  it("converts buffers in both directions", () => {
    const pcm = Int16Array.from([0, 1000, -1000, 20000, -20000]);
    const round = muLawBufferToPcm16(pcm16ToMuLawBuffer(pcm));
    assert.equal(round.length, pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      assert.ok(Math.abs(round[i] - pcm[i]) <= Math.max(8, Math.abs(pcm[i]) * 0.08));
    }
  });
});

describe("resampling", () => {
  it("doubles the sample count going 8k → 16k", () => {
    const input = Int16Array.from([0, 100, 200, 300]);
    const { out } = upsample8kTo16k(input);
    assert.equal(out.length, 8);
  });

  it("carries the last sample across chunks so boundaries do not click", () => {
    const chunkA = Int16Array.from([1000, 2000]);
    const chunkB = Int16Array.from([3000, 4000]);

    const a = upsample8kTo16k(chunkA, 0);
    const b = upsample8kTo16k(chunkB, a.last);

    // First interpolated sample of chunk B must sit between chunkA's last
    // (2000) and chunkB's first (3000). Without the carry it would be
    // (0 + 3000) / 2 = 1500 — a discontinuity every 20 ms.
    assert.equal(b.out[0], 2500);
    assert.equal(a.last, 2000);
  });

  it("averages rather than dropping samples going 24k → 8k", () => {
    const input = Int16Array.from([300, 600, 900, 30, 60, 90]);
    const { out } = downsample24kTo8k(input);
    assert.deepEqual(Array.from(out), [600, 60]);
  });

  it("carries a partial group across chunks so grouping stays aligned", () => {
    // 4 samples = one full group of 3 plus one left over.
    const first = downsample24kTo8k(Int16Array.from([300, 600, 900, 1200]));
    assert.equal(first.out.length, 1);
    assert.deepEqual(first.carry, [1200]);

    // The carried sample must start the next group, not be discarded.
    const second = downsample24kTo8k(Int16Array.from([1500, 1800]), first.carry);
    assert.equal(second.out.length, 1);
    assert.equal(second.out[0], 1500); // (1200 + 1500 + 1800) / 3
  });

  it("survives a realistic chunk sequence without drifting", () => {
    // 24 kHz in, 8 kHz out: whatever the chunk boundaries, total output must be
    // within one group of input/3. Drift here shows up as the agent's voice
    // slowly desynchronising over a long call.
    let carry: number[] = [];
    let total = 0;
    const chunkSizes = [480, 481, 479, 1000, 7, 3, 2, 960];
    for (const n of chunkSizes) {
      const r = downsample24kTo8k(new Int16Array(n), carry);
      carry = r.carry;
      total += r.out.length;
    }
    const inputTotal = chunkSizes.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - Math.floor(inputTotal / 3)) <= 1, `drifted: ${total} vs ${inputTotal / 3}`);
  });
});

describe("Twilio framing", () => {
  it("emits exact 20 ms frames and keeps the remainder", () => {
    const { frames, tail } = chunkMuLaw(Buffer.alloc(400));
    assert.equal(frames.length, 2);
    assert.equal(frames[0].length, 160);
    assert.equal(tail.length, 80);
  });

  it("prepends the previous tail so no audio is lost between chunks", () => {
    const first = chunkMuLaw(Buffer.alloc(200));
    assert.equal(first.frames.length, 1);
    assert.equal(first.tail.length, 40);

    const second = chunkMuLaw(Buffer.alloc(120), first.tail);
    assert.equal(second.frames.length, 1); // 40 carried + 120 new = exactly one frame
    assert.equal(second.tail.length, 0);
  });

  it("buffers rather than emitting a short frame", () => {
    const { frames, tail } = chunkMuLaw(Buffer.alloc(100));
    assert.equal(frames.length, 0);
    assert.equal(tail.length, 100);
  });
});
