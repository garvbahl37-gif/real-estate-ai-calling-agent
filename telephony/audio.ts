/**
 * G.711 μ-law codec and sample-rate conversion for the Twilio bridge.
 *
 * Twilio Media Streams speak 8 kHz μ-law; Gemini Live wants 16 kHz linear PCM
 * in and returns 24 kHz linear PCM out. Nothing in either SDK does this, so
 * both directions are converted here.
 *
 *   phone  →  8 kHz μ-law  →  16-bit PCM  →  upsample ×2  →  16 kHz  →  Gemini
 *   Gemini →  24 kHz PCM   →  decimate ÷3 →  8 kHz        →  μ-law   →  phone
 */

const BIAS = 0x84;
const CLIP = 32635;

/**
 * Exponent lookup indexed by (sample >> 7) & 0xFF — it is floor(log2(i)),
 * clamped to 7. Computed rather than pasted as a 256-entry literal so it is
 * obvious what it means.
 */
const EXP_LUT = new Uint8Array(256);
for (let i = 1; i < 256; i++) EXP_LUT[i] = Math.min(7, 31 - Math.clz32(i));

/** One 16-bit signed sample → one μ-law byte. */
export function pcmToMuLawSample(sample: number): number {
  const sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;

  const exponent = EXP_LUT[(sample >> 7) & 0xff];
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** One μ-law byte → one 16-bit signed sample. */
export function muLawToPcmSample(muByte: number): number {
  const u = ~muByte & 0xff;
  let t = ((u & 0x0f) << 3) + BIAS;
  t <<= (u & 0x70) >> 4;
  return (u & 0x80) !== 0 ? BIAS - t : t - BIAS;
}

export function muLawBufferToPcm16(mulaw: Buffer): Int16Array {
  const out = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) out[i] = muLawToPcmSample(mulaw[i]);
  return out;
}

export function pcm16ToMuLawBuffer(pcm: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcmToMuLawSample(pcm[i]);
  return out;
}

/**
 * 8 kHz → 16 kHz by linear interpolation.
 *
 * Upsampling only mirrors the existing spectrum, so the artefacts it can
 * introduce are above the original 4 kHz band and inaudible here. Linear is
 * plenty; a polyphase filter would cost CPU per call for no gain the model can
 * hear.
 *
 * `lastSample` carries the previous chunk's final sample so the interpolated
 * value at the chunk boundary is correct instead of jumping from zero — without
 * it every 20 ms packet starts with a click.
 */
export function upsample8kTo16k(input: Int16Array, lastSample = 0): { out: Int16Array; last: number } {
  const out = new Int16Array(input.length * 2);
  let prev = lastSample;
  for (let i = 0; i < input.length; i++) {
    const cur = input[i];
    out[i * 2] = (prev + cur) >> 1;
    out[i * 2 + 1] = cur;
    prev = cur;
  }
  return { out, last: prev };
}

/**
 * 24 kHz → 8 kHz by averaging each group of three samples.
 *
 * The averaging matters. Plain decimation (keep every third sample) folds
 * everything above 4 kHz back into the audible band as aliasing, which on
 * speech sounds like a metallic rasp. A 3-tap box filter is not a great
 * low-pass, but its first null sits at 8 kHz and it removes the worst of it for
 * three adds per output sample.
 *
 * `carry` holds samples left over when a chunk length is not a multiple of
 * three, so groups stay aligned across chunk boundaries.
 */
export function downsample24kTo8k(
  input: Int16Array,
  carry: number[] = [],
): { out: Int16Array; carry: number[] } {
  const src = carry.length ? Int16Array.from([...carry, ...input]) : input;
  const groups = Math.floor(src.length / 3);
  const out = new Int16Array(groups);

  for (let g = 0; g < groups; g++) {
    const i = g * 3;
    out[g] = ((src[i] + src[i + 1] + src[i + 2]) / 3) | 0;
  }

  const remainder: number[] = [];
  for (let i = groups * 3; i < src.length; i++) remainder.push(src[i]);
  return { out, carry: remainder };
}

/** Raw little-endian 16-bit PCM bytes → Int16Array, without copying semantics surprises. */
export function bufferToPcm16(buf: Buffer): Int16Array {
  const out = new Int16Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

export function pcm16ToBuffer(pcm: Int16Array): Buffer {
  const buf = Buffer.allocUnsafe(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2);
  return buf;
}

/** Twilio sends and expects 20 ms frames — 160 bytes of μ-law at 8 kHz. */
export const TWILIO_FRAME_BYTES = 160;

/**
 * Splits a μ-law buffer into exact 20 ms frames, returning any partial tail so
 * the caller can prepend it to the next chunk. Twilio tolerates odd sizes but
 * paces playback per frame, and irregular frames make the agent's speech sound
 * subtly uneven.
 */
export function chunkMuLaw(
  buf: Buffer,
  tail: Buffer = Buffer.alloc(0),
  // Bare `Buffer` means Buffer<ArrayBufferLike>. `subarray` returns that wider
  // type while `Buffer.alloc` returns Buffer<ArrayBuffer>, so the annotations
  // have to be explicit or the two sides refuse to assign to each other.
): { frames: Buffer[]; tail: Buffer } {
  const all = tail.length ? Buffer.concat([tail, buf]) : buf;
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset + TWILIO_FRAME_BYTES <= all.length) {
    frames.push(all.subarray(offset, offset + TWILIO_FRAME_BYTES));
    offset += TWILIO_FRAME_BYTES;
  }
  return { frames, tail: all.subarray(offset) };
}
