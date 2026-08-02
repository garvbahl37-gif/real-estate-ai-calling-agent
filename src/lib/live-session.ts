"use client";

import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { executeAgentTool, mergeRequirements } from "./agent-tools";
import { CallRecorder } from "./call-recorder";
import { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE, arrayBufferToBase64, base64ToFloat32 } from "./audio-utils";
import type { LeadRequirements, ToolInvocation, TranscriptTurn } from "./types";

export type CallState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "ended"
  | "error";

export interface LiveCallEvents {
  onState?: (state: CallState) => void;
  onTranscript?: (turns: TranscriptTurn[]) => void;
  onRequirements?: (req: LeadRequirements) => void;
  onToolCall?: (call: ToolInvocation) => void;
  onLevel?: (mic: number, agent: number) => void;
  onError?: (message: string) => void;
  onEnded?: (reason: string) => void;
  onLog?: (line: string) => void;
}

export interface LiveCallOptions {
  voice?: string;
  model?: string;
  openingLanguage?: "hindi" | "hinglish" | "english";
  customerName?: string;
  scenarioOverride?: string;
  /** Set only on a reconnect, so the new token resumes the same conversation. */
  resumeHandle?: string;
}

interface TokenResponse {
  mode: "ephemeral" | "direct";
  token: string;
  model: string;
  voice: string;
  /**
   * Only present on the dev-only direct-key path. For ephemeral tokens the
   * config is locked into the token itself and anything sent from here is
   * ignored, so there is nothing for the server to hand back.
   */
  liveConfig?: Record<string, unknown>;
  warning?: string;
}

/**
 * Noise-gate tuning. ABSOLUTE_NOISE_FLOOR is a hard minimum in normalised RMS —
 * ordinary speech at a normal distance sits well above it, while a quiet room
 * sits below. The hangover keeps the gate open across the short gaps inside a
 * sentence.
 */
const ABSOLUTE_NOISE_FLOOR = 0.006;
const GATE_HANGOVER_MS = 900;

const MAX_RECONNECTS = 3;
const MAX_TOTAL_RECONNECTS = 8;

let turnSeq = 0;
const nextId = () => `t${++turnSeq}_${Math.random().toString(36).slice(2, 7)}`;

// CJK, Hangul, Cyrillic, Arabic, Thai — scripts this agent never legitimately
// produces. It is configured for hi-IN and en-IN only.
const FOREIGN_SCRIPT =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯Ѐ-ӿ؀-ۿ฀-๿]/;

/**
 * Defensive net behind the `languageCodes` pin in the session config.
 *
 * Transcription is constrained to Hindi and English, but the ASR can still emit
 * a burst of an unrelated script when it hallucinates on background noise —
 * Chinese characters being the observed failure. Anything that is mostly such a
 * script is not something the caller said, so it never reaches the transcript,
 * the CRM, or the summariser.
 *
 * Deliberately proportional rather than absolute: a stray character inside an
 * otherwise good sentence is kept, since dropping real speech is worse than
 * showing one odd glyph.
 */
export function isHallucinatedScript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  let foreign = 0;
  let letters = 0;
  for (const ch of trimmed) {
    if (/\s|\p{P}|\p{N}/u.test(ch)) continue;
    letters++;
    if (FOREIGN_SCRIPT.test(ch)) foreign++;
  }
  if (letters === 0) return false;
  return foreign / letters > 0.5;
}

/**
 * Owns one voice conversation: microphone capture, the Live API socket, tool
 * execution, transcript assembly and reconnection.
 *
 * Deliberately framework-free — React only subscribes to its events. The same
 * class shape is mirrored by the Twilio bridge on the server, where the audio
 * ends come from a phone instead of a browser.
 */
export class LiveCall {
  private ai?: GoogleGenAI;
  private session?: Session;
  private events: LiveCallEvents;

  private micContext?: AudioContext;
  private playContext?: AudioContext;
  private recorderNode?: AudioWorkletNode;
  private playerNode?: AudioWorkletNode;
  private micStream?: MediaStream;
  private micSource?: MediaStreamAudioSourceNode;

  private startedAt = 0;
  private state: CallState = "idle";
  private closed = false;
  private muted = false;

  private turns: TranscriptTurn[] = [];
  private openCustomerTurn?: TranscriptTurn;
  private openAgentTurn?: TranscriptTurn;

  private requirements: LeadRequirements = {};
  private toolCalls: ToolInvocation[] = [];

  private micLevel = 0;
  private agentLevel = 0;
  private noiseFloor = ABSOLUTE_NOISE_FLOOR;
  private gateOpenUntil = 0;
  /** Records both sides so the demo does not depend on OS audio routing. */
  private recorder = new CallRecorder();
  private levelRaf?: number;
  private endCallTimer?: ReturnType<typeof setTimeout>;

  // Hanging up after end_call waits for her to actually stop speaking, rather
  // than after a guessed delay. `playerBusy` mirrors the playback worklet's
  // queue; `pendingEnd` holds the outcome until it is safe to tear down.
  private playerBusy = false;
  private pendingEnd?: { reason: string; sawTurnComplete: boolean };
  private endGraceTimer?: ReturnType<typeof setTimeout>;

  // Reconnection state. The handle lets a new socket pick up the same
  // conversation, so a dropped connection doesn't restart the sales call.
  private resumeHandle?: string;
  private reconnectAttempts = 0;
  private totalReconnects = 0;
  private config?: TokenResponse;
  private options: LiveCallOptions = {};

  constructor(events: LiveCallEvents = {}) {
    this.events = events;
  }

  /* -------------------------------------------------------------- */
  /* Public API                                                      */
  /* -------------------------------------------------------------- */

  get callState() {
    return this.state;
  }
  get transcript() {
    return this.turns;
  }
  get lead() {
    return this.requirements;
  }
  get tools() {
    return this.toolCalls;
  }
  get elapsedMs() {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  /**
   * The finished call as a stereo WAV — caller left, agent right. Available
   * once the call ends; null if nothing was captured.
   */
  getRecording(): Blob | null {
    return this.recorder.toWavBlob();
  }

  get recordedSeconds() {
    return this.recorder.durationSec;
  }

  async start(options: LiveCallOptions = {}) {
    if (this.state !== "idle" && this.state !== "ended" && this.state !== "error") return;
    this.closed = false;
    this.options = options;
    this.reconnectAttempts = 0;
    this.resumeHandle = undefined;
    this.setState("connecting");
    this.startedAt = Date.now();

    try {
      this.config = await this.fetchToken(options);
      this.log(`Session token acquired (${this.config.mode}) · model ${this.config.model} · voice ${this.config.voice}`);
      if (this.config.warning) this.log(`⚠ ${this.config.warning}`);

      // Microphone first. If permission is denied we want to fail before
      // opening a socket, otherwise the agent greets an empty room.
      await this.setupAudio();
      this.recorder.reset();
      this.recorder.start();
      this.log("Mic capturing at 16 kHz · playback ready at 24 kHz · recording both sides");

      await this.connect();
      this.startLevelPump();
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err));
    }
  }

  /** Push a typed message into the live call (the console's text fallback). */
  sendText(text: string) {
    if (!this.session || this.closed) return;
    // Typing while the agent is mid-sentence is a barge-in like any other:
    // close her turn and drop the queued audio, so the transcript doesn't end
    // up with a half-finished line sitting after the caller's reply.
    this.finalizeAgentTurn();
    this.playerNode?.port.postMessage({ type: "flush" });
    this.session.sendRealtimeInput({ text });
    this.pushTurn({ id: nextId(), role: "customer", text, at: this.elapsedMs });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.recorderNode?.port.postMessage({ type: "mute", value: muted });
  }

  async stop(reason = "user_hangup") {
    this.finish(reason);
  }

  /* -------------------------------------------------------------- */
  /* Connection                                                      */
  /* -------------------------------------------------------------- */

  private async fetchToken(options: LiveCallOptions): Promise<TokenResponse> {
    const res = await fetch("/api/live-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Token request failed (${res.status})`);
    return body as TokenResponse;
  }

  private async connect() {
    const cfg = this.config;
    if (!cfg) throw new Error("No session configuration");

    const isResume = this.reconnectAttempts > 0;

    // An ephemeral token is single-use, and the session config is locked into
    // it at mint time — so a reconnect needs a fresh token that carries the
    // resumption handle. That's why the handle is sent to our own API rather
    // than passed to live.connect().
    const active = isResume
      ? await this.fetchToken({ ...this.options, resumeHandle: this.resumeHandle })
      : cfg;

    this.ai = new GoogleGenAI({ apiKey: active.token });
    this.session = await this.ai.live.connect({
      model: active.model,
      callbacks: {
        onopen: () => {
          this.log(isResume ? "Socket reopened — conversation resumed." : "Socket open — streaming audio.");
          this.setState("listening");
        },
        onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        onerror: (e: ErrorEvent) => this.log(`Socket error: ${e?.message ?? "unknown"}`),
        onclose: (e: CloseEvent) => {
          this.log(`Socket closed${e?.reason ? `: ${e.reason}` : ""}`);
          if (!this.closed) void this.handleUnexpectedClose();
        },
      },
      // Intentionally empty for the ephemeral path. The Live API treats the
      // token's `liveConnectConstraints.config` as authoritative and discards
      // whatever the client sends — passing a config here would look like it
      // worked while the agent quietly ran with none of it. `liveConfig` is
      // only populated on the dev-only direct-key fallback, which has no token
      // to carry the config.
      config: active.liveConfig ?? {},
    });

    this.reconnectAttempts = 0;

    // The Live API is turn-based: it stays silent until it receives something,
    // no matter what the system instruction says about greeting first. A real
    // outbound call has the agent speak first, so nudge it with a text turn.
    //
    // This must happen AFTER the connect promise resolves — `onopen` fires
    // while the socket is still being handed back, so `this.session` is not
    // assigned yet and sending from there silently does nothing.
    //
    // Text input produces no inputTranscription, so the nudge never appears in
    // the transcript. Skipped on a resume, where the conversation already has
    // history and a second nudge would make her greet the caller twice.
    if (!isResume) {
      try {
        this.session.sendRealtimeInput({
          text: "[SYSTEM: The call has just connected and the customer is on the line. Deliver your opening line now.]",
        });
      } catch (err) {
        this.log(`Could not send the opening nudge: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async handleUnexpectedClose() {
    if (this.closed) return;

    // Two ceilings. `reconnectAttempts` resets on a successful connect so a
    // single blip mid-call doesn't count against a later one; `totalReconnects`
    // never resets, which is what stops a socket that connects and immediately
    // drops from looping forever.
    if (this.reconnectAttempts >= MAX_RECONNECTS || this.totalReconnects >= MAX_TOTAL_RECONNECTS) {
      this.log(`Giving up after ${this.totalReconnects} reconnection attempts.`);
      this.finish("connection_lost");
      return;
    }

    this.reconnectAttempts += 1;
    this.totalReconnects += 1;
    this.setState("reconnecting");
    // Drop any half-played audio so the agent doesn't resume mid-word.
    this.playerNode?.port.postMessage({ type: "flush" });

    const backoff = 400 * Math.pow(2, this.reconnectAttempts - 1);
    this.log(`Reconnecting (attempt ${this.reconnectAttempts}/${MAX_RECONNECTS}) in ${backoff}ms…`);
    await new Promise((r) => setTimeout(r, backoff));
    if (this.closed) return;

    try {
      await this.connect();
    } catch (err) {
      this.log(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
      void this.handleUnexpectedClose();
    }
  }

  /**
   * Client-side noise gate. Nothing reaches the model unless it plausibly
   * contains speech.
   *
   * The server's own VAD decides when a *turn* starts and ends, but it still
   * transcribes whatever audio it is given — and given a couple of seconds of
   * room tone, a fan, or a laptop's own speaker bleed, it will confidently
   * invent a sentence. Those arrive as phantom caller turns: a line nobody
   * said, which the agent then answers. Filtering at the source is the only
   * place this can be fixed properly, because by the time the text comes back
   * it is indistinguishable from real speech.
   *
   * The floor adapts, because a laptop in a quiet room and a phone in a cafe
   * have very different baselines. It tracks the quiet passages quickly and
   * loud ones barely at all, so sustained speech never raises the bar against
   * itself.
   *
   * The hangover is what protects real speech: once the gate opens it stays
   * open for a beat, so trailing consonants and the short pauses inside a
   * sentence are not chopped out mid-word.
   */
  private passesNoiseGate(rms: number): boolean {
    if (typeof rms !== "number" || Number.isNaN(rms)) return true; // no signal to judge on — let it through

    // Adapt downward fast, upward slowly.
    this.noiseFloor =
      rms < this.noiseFloor ? this.noiseFloor * 0.9 + rms * 0.1 : this.noiseFloor * 0.995 + rms * 0.005;

    const threshold = Math.max(ABSOLUTE_NOISE_FLOOR, this.noiseFloor * 2.5);
    const now = performance.now();

    if (rms > threshold) {
      this.gateOpenUntil = now + GATE_HANGOVER_MS;
      return true;
    }
    return now < this.gateOpenUntil;
  }

  /* -------------------------------------------------------------- */
  /* Audio                                                           */
  /* -------------------------------------------------------------- */

  private async setupAudio() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot capture audio. Try Chrome, Edge or Safari over HTTPS.");
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Essential: without cancellation the agent hears its own voice
          // through the speakers and interrupts itself mid-sentence.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError") throw new Error("Microphone access was blocked. Allow it and start the call again.");
      if (name === "NotFoundError") throw new Error("No microphone found. Connect one and try again.");
      throw err;
    }

    // Requesting 16 kHz directly lets the browser resample from the hardware
    // rate. Some Safari versions ignore the hint; the worklet still works, the
    // platform just does the resampling itself.
    this.micContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    await this.micContext.audioWorklet.addModule("/worklets/pcm-recorder.js");
    this.micSource = this.micContext.createMediaStreamSource(this.micStream);
    this.recorderNode = new AudioWorkletNode(this.micContext, "pcm-recorder");
    this.recorderNode.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === "pcm") {
        if (!this.session || this.closed) return;
        // Recorded before gating: the gate exists to stop the *model*
        // hallucinating on room tone, not to censor the recording.
        this.recorder.pushMic(new Int16Array(data.buffer as ArrayBuffer));
        if (!this.passesNoiseGate(data.rms as number)) return;
        try {
          this.session.sendRealtimeInput({
            audio: {
              data: arrayBufferToBase64(data.buffer as ArrayBuffer),
              mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            },
          });
        } catch {
          // Socket closed between the check and the send — the close handler
          // will pick it up.
        }
      } else if (data.type === "level") {
        this.micLevel = this.muted ? 0 : data.rms;
      }
    };
    this.micSource.connect(this.recorderNode);
    // The worklet emits no audio, but Chrome suspends nodes that aren't part of
    // the graph, so terminate it at the destination.
    this.recorderNode.connect(this.micContext.destination);

    this.playContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    await this.playContext.audioWorklet.addModule("/worklets/pcm-player.js");
    this.playerNode = new AudioWorkletNode(this.playContext, "pcm-player", { outputChannelCount: [1] });
    this.playerNode.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === "playing") {
        this.playerBusy = true;
        this.setState("speaking");
      } else if (data.type === "drained") {
        this.playerBusy = false;
        if (this.state === "speaking") this.setState("listening");
        this.agentLevel = 0;
        // She has stopped talking. If a hang-up was queued, this is the moment.
        this.maybeFinishAfterSpeech();
      } else if (data.type === "level") this.agentLevel = data.rms;
    };
    this.playerNode.connect(this.playContext.destination);

    // Contexts created before a user gesture start suspended under autoplay policy.
    await this.micContext.resume().catch(() => {});
    await this.playContext.resume().catch(() => {});
  }

  /* -------------------------------------------------------------- */
  /* Message handling                                                */
  /* -------------------------------------------------------------- */

  private handleMessage(msg: LiveServerMessage) {
    // The server hands back a fresh handle periodically; keep the newest.
    const resumption = (msg as { sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean } })
      .sessionResumptionUpdate;
    if (resumption?.resumable && resumption.newHandle) {
      this.resumeHandle = resumption.newHandle;
    }

    // Advance warning that the server is about to drop us — reconnect on our
    // own terms rather than waiting for the socket to die mid-sentence.
    if ((msg as { goAway?: { timeLeft?: string } }).goAway) {
      this.log("Server signalled goAway — rotating the connection.");
      try {
        this.session?.close();
      } catch {
        /* the close handler takes it from here */
      }
      return;
    }

    if (msg.toolCall?.functionCalls?.length) {
      this.runToolCalls(msg.toolCall.functionCalls);
    }

    const sc = msg.serverContent;
    if (!sc) return;

    // Barge-in: the caller started talking over the agent.
    if (sc.interrupted) {
      this.playerNode?.port.postMessage({ type: "flush" });
      this.recorder.discardUnplayedAgent();
      this.finalizeAgentTurn();
      this.setState("listening");
      this.log("↩ Caller interrupted — playback flushed.");
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data && inline.mimeType?.startsWith("audio/")) {
        const pcm = base64ToFloat32(inline.data);
        this.recorder.pushAgent(pcm);
        // The worklet takes ownership of the buffer, so record before transfer.
        this.playerNode?.port.postMessage({ type: "chunk", buffer: pcm.buffer }, [pcm.buffer]);
      }
      if (part.text) this.appendAgentText(part.text);
    }

    if (sc.inputTranscription?.text) {
      this.appendCustomerText(sc.inputTranscription.text, sc.inputTranscription.languageCode);
    }
    if (sc.outputTranscription?.text) {
      this.appendAgentText(sc.outputTranscription.text, sc.outputTranscription.languageCode);
    }

    if (sc.turnComplete) {
      this.finalizeCustomerTurn();
      this.finalizeAgentTurn();
      if (this.pendingEnd) {
        this.pendingEnd.sawTurnComplete = true;
        this.maybeFinishAfterSpeech();
      }
    }
  }

  private runToolCalls(functionCalls: { id?: string; name?: string; args?: unknown }[]) {
    const responses = functionCalls.map((fc) => {
      const name = fc.name ?? "";
      const args = (fc.args ?? {}) as Record<string, unknown>;
      const result = executeAgentTool(name, args);

      if (result.requirementsPatch) {
        this.requirements = mergeRequirements(this.requirements, result.requirementsPatch);
        this.events.onRequirements?.({ ...this.requirements });
      }

      const invocation: ToolInvocation = {
        id: fc.id ?? nextId(),
        name,
        args,
        result: result.response,
        at: this.elapsedMs,
      };
      this.toolCalls.push(invocation);
      this.events.onToolCall?.(invocation);
      this.log(`🔧 ${name}(${JSON.stringify(args).slice(0, 160)})`);

      if (result.endCall) {
        // Do NOT hang up on a timer. Her closing line — repeating the number
        // back, confirming the next step, signing off — routinely runs 15
        // seconds or more, and a fixed delay guillotines it mid-sentence.
        // Instead, remember the outcome and tear down once the model has
        // finished the turn AND the playback queue has actually drained.
        // The timer here is only a backstop for a turn that never completes.
        this.pendingEnd = { reason: result.endCall.outcome, sawTurnComplete: false };
        this.log("end_call — hanging up once she has finished speaking");
        this.endCallTimer = setTimeout(() => {
          this.log("closing line exceeded 45s — ending anyway");
          this.finish(result.endCall!.outcome);
        }, 45_000);
      }

      return { id: fc.id, name: fc.name, response: result.response };
    });

    try {
      this.session?.sendToolResponse({ functionResponses: responses });
    } catch (err) {
      this.log(`Tool response failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Ends the call once, and only once, both conditions hold: the model has
   * finished generating the turn, and the playback queue is empty.
   *
   * The short grace period covers the gap between chunks — the queue can drain
   * for a few milliseconds mid-sentence while the next packet is in flight, and
   * hanging up there would clip her exactly as a fixed timer did.
   */
  private maybeFinishAfterSpeech() {
    if (!this.pendingEnd?.sawTurnComplete || this.playerBusy) return;
    if (this.endGraceTimer) clearTimeout(this.endGraceTimer);
    this.endGraceTimer = setTimeout(() => {
      if (!this.pendingEnd || this.playerBusy) return;
      this.finish(this.pendingEnd.reason);
    }, 600);
  }

  /* -------------------------------------------------------------- */
  /* Transcript assembly                                             */
  /* -------------------------------------------------------------- */

  private appendCustomerText(text: string, languageCode?: string) {
    if (isHallucinatedScript(text)) {
      this.log(`Dropped a non-Hindi/English transcription fragment: ${JSON.stringify(text.slice(0, 40))}`);
      return;
    }
    // The agent replying means the caller's turn has ended.
    if (this.openAgentTurn) this.finalizeAgentTurn();
    if (!this.openCustomerTurn) {
      this.openCustomerTurn = { id: nextId(), role: "customer", text: "", at: this.elapsedMs, partial: true };
      this.turns.push(this.openCustomerTurn);
    }
    this.openCustomerTurn.text += text;
    if (languageCode) this.openCustomerTurn.languageCode = languageCode;
    this.emitTranscript();
  }

  private appendAgentText(text: string, languageCode?: string) {
    if (isHallucinatedScript(text)) {
      this.log(`Dropped a non-Hindi/English agent fragment: ${JSON.stringify(text.slice(0, 40))}`);
      return;
    }
    if (this.openCustomerTurn) this.finalizeCustomerTurn();
    if (!this.openAgentTurn) {
      this.openAgentTurn = { id: nextId(), role: "agent", text: "", at: this.elapsedMs, partial: true };
      this.turns.push(this.openAgentTurn);
    }
    this.openAgentTurn.text += text;
    if (languageCode) this.openAgentTurn.languageCode = languageCode;
    this.emitTranscript();
  }

  private finalizeCustomerTurn() {
    if (!this.openCustomerTurn) return;
    const turn = this.openCustomerTurn;
    turn.partial = false;
    if (!turn.text.trim()) this.turns = this.turns.filter((t) => t !== turn);
    this.openCustomerTurn = undefined;
    this.emitTranscript();
  }

  private finalizeAgentTurn() {
    if (!this.openAgentTurn) return;
    const turn = this.openAgentTurn;
    turn.partial = false;
    if (!turn.text.trim()) this.turns = this.turns.filter((t) => t !== turn);
    this.openAgentTurn = undefined;
    this.emitTranscript();
  }

  private pushTurn(turn: TranscriptTurn) {
    this.turns.push(turn);
    this.emitTranscript();
  }

  private emitTranscript() {
    this.events.onTranscript?.([...this.turns]);
  }

  /* -------------------------------------------------------------- */
  /* Lifecycle                                                       */
  /* -------------------------------------------------------------- */

  private startLevelPump() {
    const tick = () => {
      this.events.onLevel?.(this.micLevel, this.agentLevel);
      this.levelRaf = requestAnimationFrame(tick);
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  private setState(s: CallState) {
    if (this.state === s) return;
    this.state = s;
    this.events.onState?.(s);
  }

  private log(line: string) {
    this.events.onLog?.(line);
  }

  private fail(message: string) {
    this.log(`✗ ${message}`);
    this.closed = true;
    this.events.onError?.(message);
    this.setState("error");
    void this.teardown();
  }

  private finish(reason: string) {
    if (this.closed) return;
    this.closed = true;

    // Silence first, UI second. If any of the bookkeeping below throws, the
    // call is already quiet — hanging up must never depend on a clean teardown.
    this.stopAudioNow();

    try {
      this.finalizeCustomerTurn();
      this.finalizeAgentTurn();
    } catch {
      /* transcript bookkeeping is not worth failing a hang-up over */
    }

    this.setState("ended");
    void this.teardown();
    this.events.onEnded?.(reason);
  }

  /**
   * Order matters here.
   *
   * Everything that silences the call is done synchronously and first — drop
   * the queued audio, disconnect the player, cut the mic. Only then do we touch
   * anything that can block: closing the WebSocket and the AudioContexts both
   * return promises, and if either is slow the caller would keep hearing the
   * agent talk for as long as it took. "End call" has to mean silence
   * immediately, not silence eventually.
   */
  private stopAudioNow() {
    this.recorder.stop();
    if (this.levelRaf) cancelAnimationFrame(this.levelRaf);
    this.levelRaf = undefined;
    if (this.endCallTimer) clearTimeout(this.endCallTimer);
    this.endCallTimer = undefined;
    if (this.endGraceTimer) clearTimeout(this.endGraceTimer);
    this.endGraceTimer = undefined;
    this.pendingEnd = undefined;
    this.playerBusy = false;

    try {
      this.playerNode?.port.postMessage({ type: "flush" });
      this.playerNode?.disconnect();
    } catch {
      /* node already torn down */
    }
    try {
      this.recorderNode?.port.postMessage({ type: "mute", value: true });
      this.recorderNode?.disconnect();
      this.micSource?.disconnect();
      this.micStream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* already stopped */
    }

    this.micLevel = 0;
    this.agentLevel = 0;
    this.events.onLevel?.(0, 0);
  }

  private async teardown() {
    this.stopAudioNow();

    try {
      this.session?.close();
    } catch {
      /* already gone */
    }
    this.session = undefined;

    await this.micContext?.close().catch(() => {});
    await this.playContext?.close().catch(() => {});
    this.micContext = undefined;
    this.playContext = undefined;
  }
}
