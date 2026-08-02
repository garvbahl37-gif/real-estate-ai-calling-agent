/**
 * Mic capture worklet.
 *
 * Gemini Live wants raw 16-bit little-endian PCM at 16 kHz. We create the
 * AudioContext at 16000 Hz so the browser handles resampling from whatever the
 * hardware is actually running at, and this worklet only has to do the
 * Float32 -> Int16 conversion and the buffering.
 *
 * Chunk size is a latency/overhead tradeoff. 2048 samples = 128 ms at 16 kHz,
 * which keeps the WebSocket message rate reasonable while staying well under
 * the threshold where barge-in starts to feel laggy.
 */
const CHUNK_SAMPLES = 2048;

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(CHUNK_SAMPLES);
    this._n = 0;
    this._muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "mute") this._muted = !!e.data.value;
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    let sumSquares = 0;
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i];
      sumSquares += sample * sample;

      // Clamp before scaling; a sample slightly outside [-1,1] wraps to the
      // opposite rail as an Int16 and produces an audible click.
      const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      this._buf[this._n++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this._n === CHUNK_SAMPLES) {
        if (!this._muted) {
          const copy = this._buf.slice();
          this.port.postMessage({ type: "pcm", buffer: copy.buffer }, [copy.buffer]);
        }
        this._n = 0;
      }
    }

    // RMS drives the mic meter in the UI. Sent every render quantum (~2.7 ms
    // worth of blocks at 16 kHz); the UI throttles it with rAF.
    this.port.postMessage({ type: "level", rms: Math.sqrt(sumSquares / channel.length) });
    return true;
  }
}

registerProcessor("pcm-recorder", PCMRecorderProcessor);
