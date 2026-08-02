"use client";

/**
 * Records both sides of a call and hands back a WAV.
 *
 * This exists because capturing a browser voice agent with a screen recorder is
 * unreasonably fiddly. If you wear headphones, the agent's voice goes into your
 * ears and never reaches the microphone; if you use speakers, you get echo and
 * the agent starts interrupting itself. macOS can capture system audio, but
 * only through a specific toggle that is easy to miss, and there is no
 * loopback device on a stock machine.
 *
 * All of that disappears if the app records itself. Both streams already pass
 * through this client as raw PCM, so they are mixed here and written straight
 * to a WAV.
 *
 * The two sides land on separate channels — caller left, agent right. That
 * costs nothing, and it makes barge-in audible as overlap rather than a muddle.
 */

const RATE = 24_000;
const INITIAL_SECONDS = 120;

export class CallRecorder {
  private left: Float32Array; // caller
  private right: Float32Array; // agent
  private length = 0; // highest sample index written
  private agentHead = 0; // where the next agent chunk goes
  private startedAt = 0;
  private recording = false;

  constructor() {
    this.left = new Float32Array(RATE * INITIAL_SECONDS);
    this.right = new Float32Array(RATE * INITIAL_SECONDS);
  }

  start() {
    this.startedAt = performance.now();
    this.recording = true;
  }

  stop() {
    this.recording = false;
  }

  get isRecording() {
    return this.recording;
  }

  get durationSec() {
    return this.length / RATE;
  }

  private elapsedSamples() {
    return Math.floor(((performance.now() - this.startedAt) / 1000) * RATE);
  }

  /** Doubling growth; a long call should not reallocate on every chunk. */
  private ensure(samples: number) {
    if (samples <= this.left.length) return;
    let size = this.left.length;
    while (size < samples) size *= 2;
    const l = new Float32Array(size);
    const r = new Float32Array(size);
    l.set(this.left);
    r.set(this.right);
    this.left = l;
    this.right = r;
  }

  /**
   * Caller audio: 16 kHz Int16 from the capture worklet.
   *
   * Positioned by wall clock rather than appended, because the noise gate drops
   * silent chunks — appending would splice the silences out and slowly slide
   * the caller ahead of the agent.
   */
  pushMic(pcm: Int16Array) {
    if (!this.recording) return;
    const at = this.elapsedSamples();
    const out = Math.floor(pcm.length * (RATE / 16_000));
    this.ensure(at + out + 1);

    for (let i = 0; i < out; i++) {
      // Linear interpolation, 16 kHz -> 24 kHz.
      const src = (i * 16_000) / RATE;
      const i0 = Math.floor(src);
      const frac = src - i0;
      const a = pcm[i0] ?? 0;
      const b = pcm[i0 + 1] ?? a;
      this.left[at + i] = ((a + (b - a) * frac) / 0x8000) * 0.9;
    }
    this.length = Math.max(this.length, at + out);
  }

  /**
   * Agent audio: 24 kHz Float32, already decoded for playback.
   *
   * Written contiguously rather than by wall clock, because these chunks arrive
   * from the model faster than real time while the worklet plays them out at
   * real time. Timestamping them on arrival would compress her speech into a
   * fraction of its actual duration. The head is nudged forward if playback has
   * been idle, so a pause between turns stays a pause.
   */
  pushAgent(pcm: Float32Array) {
    if (!this.recording) return;
    this.agentHead = Math.max(this.agentHead, this.elapsedSamples());
    this.ensure(this.agentHead + pcm.length + 1);

    for (let i = 0; i < pcm.length; i++) this.right[this.agentHead + i] = pcm[i] * 0.9;
    this.agentHead += pcm.length;
    this.length = Math.max(this.length, this.agentHead);
  }

  /**
   * Called on barge-in. Audio already handed to the player is discarded rather
   * than played, so it must be discarded here too — otherwise the recording
   * contains a sentence the caller never actually heard.
   */
  discardUnplayedAgent() {
    if (!this.recording) return;
    const now = this.elapsedSamples();
    if (this.agentHead <= now) return;
    this.right.fill(0, now, Math.min(this.agentHead, this.right.length));
    this.agentHead = now;
  }

  /** Stereo 16-bit PCM WAV. Empty recording returns null. */
  toWavBlob(): Blob | null {
    if (this.length === 0) return null;

    const frames = this.length;
    const bytes = 44 + frames * 4; // stereo, 16-bit
    const buf = new ArrayBuffer(bytes);
    const view = new DataView(buf);

    const ascii = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    ascii(0, "RIFF");
    view.setUint32(4, bytes - 8, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format: PCM
    view.setUint16(22, 2, true); // channels
    view.setUint32(24, RATE, true);
    view.setUint32(28, RATE * 4, true); // byte rate
    view.setUint16(32, 4, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    ascii(36, "data");
    view.setUint32(40, frames * 4, true);

    let offset = 44;
    for (let i = 0; i < frames; i++) {
      const l = Math.max(-1, Math.min(1, this.left[i]));
      const r = Math.max(-1, Math.min(1, this.right[i]));
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
      view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 4;
    }

    return new Blob([buf], { type: "audio/wav" });
  }

  reset() {
    this.left = new Float32Array(RATE * INITIAL_SECONDS);
    this.right = new Float32Array(RATE * INITIAL_SECONDS);
    this.length = 0;
    this.agentHead = 0;
    this.recording = false;
  }
}
