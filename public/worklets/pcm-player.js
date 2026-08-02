/**
 * Playback worklet for the model's audio.
 *
 * Gemini Live returns raw 16-bit PCM at 24 kHz. The obvious approach — decode
 * each chunk into an AudioBuffer and schedule it with a BufferSourceNode — is
 * hard to get right: chunks arrive irregularly, and scheduling them back to
 * back produces clicks whenever the network hiccups.
 *
 * A ring of queued Float32 chunks drained by a single worklet avoids that, and
 * more importantly makes barge-in instant: on interruption we drop the queue
 * and the agent goes silent within one render quantum (~2.7 ms) instead of
 * finishing the audio already handed to the audio thread.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array[]} */
    this._queue = [];
    this._offset = 0;
    this._wasPlaying = false;
    this._frames = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === "chunk") {
        this._queue.push(new Float32Array(msg.buffer));
      } else if (msg.type === "flush") {
        this._queue = [];
        this._offset = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;

    let i = 0;
    let sumSquares = 0;

    while (i < out.length) {
      if (this._queue.length === 0) {
        // Underrun (or simply nothing to say) — emit silence.
        out[i++] = 0;
        continue;
      }
      const current = this._queue[0];
      const n = Math.min(out.length - i, current.length - this._offset);
      for (let k = 0; k < n; k++) {
        const v = current[this._offset + k];
        out[i + k] = v;
        sumSquares += v * v;
      }
      i += n;
      this._offset += n;
      if (this._offset >= current.length) {
        this._queue.shift();
        this._offset = 0;
      }
    }

    const playing = this._queue.length > 0;
    if (playing !== this._wasPlaying) {
      this._wasPlaying = playing;
      this.port.postMessage({ type: playing ? "playing" : "drained" });
    }

    // Throttle level reporting to roughly every 8 quanta (~21 ms).
    if (++this._frames % 8 === 0) {
      this.port.postMessage({ type: "level", rms: Math.sqrt(sumSquares / out.length) });
    }

    return true;
  }
}

registerProcessor("pcm-player", PCMPlayerProcessor);
