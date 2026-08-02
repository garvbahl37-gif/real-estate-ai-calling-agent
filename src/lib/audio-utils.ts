/** Browser-side PCM/base64 helpers shared by the live call client. */

/** Int16 PCM buffer -> base64, chunked so we never blow the argument limit. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(binary);
}

/** base64 -> Float32 in [-1, 1], assuming 16-bit little-endian PCM. */
export function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(len / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    // Divide by 0x8000 (not 0x7fff) so -32768 maps to exactly -1.0.
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
