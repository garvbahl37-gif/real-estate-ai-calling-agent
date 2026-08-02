import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import type { WebSocket } from "ws";
import { executeAgentTool, mergeRequirements } from "../src/lib/agent-tools";
import { buildLiveConfig } from "../src/lib/live-config";
import type { LeadRequirements, ToolInvocation, TranscriptTurn } from "../src/lib/types";
import {
  bufferToPcm16,
  chunkMuLaw,
  downsample24kTo8k,
  muLawBufferToPcm16,
  pcm16ToMuLawBuffer,
  upsample8kTo16k,
} from "./audio";

/**
 * One phone call: Twilio Media Stream on one side, Gemini Live on the other.
 *
 * This is the same conversation logic as the browser client — identical prompt,
 * identical tools, identical executor — with a different transport. The only
 * behavioural differences are forced by the medium: 8 kHz μ-law instead of
 * 16 kHz PCM, no browser echo cancellation, and a wider end-of-speech window
 * because phone lines add their own gaps.
 */

export interface BridgeOptions {
  apiKey: string;
  model: string;
  /** Base URL of the Next.js app, used to persist the call record. */
  appUrl?: string;
  voice?: string;
  log?: (line: string) => void;
}

let seq = 0;
const nextId = () => `p${++seq}_${Math.random().toString(36).slice(2, 7)}`;

export class PhoneCallBridge {
  private twilio: WebSocket;
  private opts: BridgeOptions;
  private session?: Session;

  private streamSid?: string;
  private callSid?: string;
  private fromNumber?: string;
  private callId?: string;

  private startedAt = Date.now();
  private closed = false;

  private turns: TranscriptTurn[] = [];
  private openCustomer?: TranscriptTurn;
  private openAgent?: TranscriptTurn;
  private requirements: LeadRequirements = {};
  private toolCalls: ToolInvocation[] = [];

  // Resampling state must persist across chunks or every 20 ms packet clicks.
  private upsampleLast = 0;
  private downsampleCarry: number[] = [];
  private outboundTail: Buffer = Buffer.alloc(0);

  private persistTimer?: NodeJS.Timeout;

  constructor(twilio: WebSocket, opts: BridgeOptions) {
    this.twilio = twilio;
    this.opts = opts;
    this.twilio.on("message", (raw) => this.onTwilioMessage(raw.toString()));
    this.twilio.on("close", () => void this.shutdown("twilio_closed"));
    this.twilio.on("error", (e) => this.log(`Twilio socket error: ${e.message}`));
  }

  private log(line: string) {
    this.opts.log?.(`[${this.callSid?.slice(-6) ?? "……"}] ${line}`);
  }

  private get elapsed() {
    return Date.now() - this.startedAt;
  }

  /* ---------------------------------------------------------------- */
  /* Twilio → Gemini                                                   */
  /* ---------------------------------------------------------------- */

  private async onTwilioMessage(raw: string) {
    let msg: {
      event: string;
      start?: { streamSid: string; callSid: string; customParameters?: Record<string, string> };
      media?: { payload: string };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.event) {
      case "connected":
        this.log("Twilio stream connected");
        break;

      case "start": {
        this.streamSid = msg.start?.streamSid;
        this.callSid = msg.start?.callSid;
        this.fromNumber = msg.start?.customParameters?.from;
        this.startedAt = Date.now();
        this.log(`Call started from ${this.fromNumber ?? "unknown"}`);
        await this.createCallRecord();
        await this.openGemini();
        break;
      }

      case "media": {
        if (!msg.media?.payload || !this.session) return;
        const mulaw = Buffer.from(msg.media.payload, "base64");
        const pcm8 = muLawBufferToPcm16(mulaw);
        const { out: pcm16, last } = upsample8kTo16k(pcm8, this.upsampleLast);
        this.upsampleLast = last;
        try {
          this.session.sendRealtimeInput({
            audio: {
              data: Buffer.from(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength).toString("base64"),
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } catch {
          /* socket closing; the close handler deals with it */
        }
        break;
      }

      case "stop":
        this.log("Twilio stream stopped");
        await this.shutdown("caller_hung_up");
        break;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Gemini                                                            */
  /* ---------------------------------------------------------------- */

  private async openGemini() {
    const ai = new GoogleGenAI({ apiKey: this.opts.apiKey });

    this.session = await ai.live.connect({
      model: this.opts.model,
      callbacks: {
        onopen: () => this.log("Gemini Live session open"),
        onmessage: (m) => this.onGeminiMessage(m),
        onerror: (e) => this.log(`Gemini error: ${e?.message ?? "unknown"}`),
        onclose: (e) => {
          this.log(`Gemini closed${e?.reason ? `: ${e.reason}` : ""}`);
          if (!this.closed) void this.shutdown("gemini_closed");
        },
      },
      // Passed directly rather than through an ephemeral token — this process
      // holds the API key, so there is nothing to lock the config into.
      config: buildLiveConfig({
        voice: this.opts.voice,
        openingLanguage: "hinglish",
        channel: "phone",
      }),
    });

    // Same reason as the browser client: the Live API will not speak first.
    this.session.sendRealtimeInput({
      text: "[SYSTEM: The caller has just picked up. Deliver your opening line now.]",
    });

    this.persistTimer = setInterval(() => void this.persist(), 5000);
  }

  private onGeminiMessage(msg: LiveServerMessage) {
    if (msg.toolCall?.functionCalls?.length) {
      const responses = msg.toolCall.functionCalls.map((fc) => {
        const name = fc.name ?? "";
        const args = (fc.args ?? {}) as Record<string, unknown>;
        const result = executeAgentTool(name, args);

        if (result.requirementsPatch) {
          this.requirements = mergeRequirements(this.requirements, result.requirementsPatch);
        }
        this.toolCalls.push({ id: fc.id ?? nextId(), name, args, result: result.response, at: this.elapsed });
        this.log(`tool ${name}`);

        if (result.endCall) {
          // Let the closing line play out before dropping the line.
          setTimeout(() => void this.shutdown(result.endCall!.outcome), 4000);
        }
        return { id: fc.id, name: fc.name, response: result.response };
      });
      try {
        this.session?.sendToolResponse({ functionResponses: responses });
      } catch {
        /* session gone */
      }
    }

    const sc = msg.serverContent;
    if (!sc) return;

    // Barge-in. Twilio buffers everything already sent, so telling Gemini to
    // stop is not enough — `clear` is what actually drops the queued audio at
    // Twilio's end. Without it the agent keeps talking over the caller for as
    // long as the buffer lasts.
    if (sc.interrupted) {
      this.sendToTwilio({ event: "clear", streamSid: this.streamSid });
      this.outboundTail = Buffer.alloc(0);
      this.downsampleCarry = [];
      this.finalizeAgent();
      this.log("caller interrupted — cleared Twilio buffer");
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data && inline.mimeType?.startsWith("audio/")) {
        this.sendAudioToTwilio(Buffer.from(inline.data, "base64"));
      }
    }

    if (sc.inputTranscription?.text) this.appendCustomer(sc.inputTranscription.text, sc.inputTranscription.languageCode);
    if (sc.outputTranscription?.text) this.appendAgent(sc.outputTranscription.text, sc.outputTranscription.languageCode);

    if (sc.turnComplete) {
      this.finalizeCustomer();
      this.finalizeAgent();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Gemini → Twilio                                                   */
  /* ---------------------------------------------------------------- */

  private sendAudioToTwilio(pcm24Bytes: Buffer) {
    if (!this.streamSid) return;
    const pcm24 = bufferToPcm16(pcm24Bytes);
    const { out: pcm8, carry } = downsample24kTo8k(pcm24, this.downsampleCarry);
    this.downsampleCarry = carry;

    const mulaw = pcm16ToMuLawBuffer(pcm8);
    const { frames, tail } = chunkMuLaw(mulaw, this.outboundTail);
    this.outboundTail = tail;

    for (const frame of frames) {
      this.sendToTwilio({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: frame.toString("base64") },
      });
    }
  }

  private sendToTwilio(payload: Record<string, unknown>) {
    if (this.twilio.readyState !== this.twilio.OPEN) return;
    try {
      this.twilio.send(JSON.stringify(payload));
    } catch {
      /* closing */
    }
  }

  /* ---------------------------------------------------------------- */
  /* Transcript                                                        */
  /* ---------------------------------------------------------------- */

  private appendCustomer(text: string, languageCode?: string) {
    if (this.openAgent) this.finalizeAgent();
    if (!this.openCustomer) {
      this.openCustomer = { id: nextId(), role: "customer", text: "", at: this.elapsed, partial: true };
      this.turns.push(this.openCustomer);
    }
    this.openCustomer.text += text;
    if (languageCode) this.openCustomer.languageCode = languageCode;
  }

  private appendAgent(text: string, languageCode?: string) {
    if (this.openCustomer) this.finalizeCustomer();
    if (!this.openAgent) {
      this.openAgent = { id: nextId(), role: "agent", text: "", at: this.elapsed, partial: true };
      this.turns.push(this.openAgent);
    }
    this.openAgent.text += text;
    if (languageCode) this.openAgent.languageCode = languageCode;
  }

  private finalizeCustomer() {
    if (!this.openCustomer) return;
    const t = this.openCustomer;
    t.partial = false;
    if (!t.text.trim()) this.turns = this.turns.filter((x) => x !== t);
    this.openCustomer = undefined;
  }

  private finalizeAgent() {
    if (!this.openAgent) return;
    const t = this.openAgent;
    t.partial = false;
    if (!t.text.trim()) this.turns = this.turns.filter((x) => x !== t);
    this.openAgent = undefined;
  }

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */
  /* ---------------------------------------------------------------- */

  private get api() {
    return this.opts.appUrl?.replace(/\/$/, "");
  }

  private async createCallRecord() {
    if (!this.api) return;
    try {
      const res = await fetch(`${this.api}/api/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", fromNumber: this.fromNumber }),
      });
      const data = (await res.json()) as { call?: { id: string } };
      this.callId = data.call?.id;
      this.log(`lead record ${this.callId}`);
    } catch (e) {
      this.log(`could not create lead record: ${(e as Error).message}`);
    }
  }

  private async persist(final = false) {
    if (!this.api || !this.callId) return;
    try {
      await fetch(`${this.api}/api/calls/${this.callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: this.turns,
          requirements: this.requirements,
          toolCalls: this.toolCalls,
          ...(final
            ? {
                status: "completed",
                endedAt: new Date().toISOString(),
                durationSec: Math.round(this.elapsed / 1000),
              }
            : {}),
        }),
      });
    } catch {
      /* best effort */
    }
  }

  private async summarise() {
    if (!this.api || !this.callId) return;
    try {
      await fetch(`${this.api}/api/calls/${this.callId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      this.log("summary generated");
    } catch (e) {
      this.log(`summary failed: ${(e as Error).message}`);
    }
  }

  /* ---------------------------------------------------------------- */

  async shutdown(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.log(`shutting down (${reason})`);

    if (this.persistTimer) clearInterval(this.persistTimer);
    this.finalizeCustomer();
    this.finalizeAgent();

    try {
      this.session?.close();
    } catch {
      /* already gone */
    }
    try {
      if (this.twilio.readyState === this.twilio.OPEN) this.twilio.close();
    } catch {
      /* already gone */
    }

    await this.persist(true);
    await this.summarise();
  }
}
