import type { CallTelemetry, ToolMetric, TurnMetric } from "./types";

/**
 * Collects the numbers that decide whether a voice call feels good.
 *
 * Time-to-first-audio is the one that matters: the gap between the caller
 * finishing and hearing a reply is what people describe as "she's slow". It is
 * measured here rather than inferred, because two separate regressions in this
 * project were diagnosed by ear over hours and would have been obvious in a
 * percentile.
 *
 * Kept transport-agnostic so the Twilio bridge records the same shape.
 */

/** Free-tier Live audio is not billed, but the arithmetic should still exist. */
const USD_PER_MILLION_INPUT_TOKENS = 0.5;
const USD_PER_MILLION_OUTPUT_TOKENS = 2.0;

export class TelemetryCollector {
  private turns: TurnMetric[] = [];
  private tools: ToolMetric[] = [];
  private bargeIns = 0;
  private reconnects = 0;
  private promptTokens = 0;
  private responseTokens = 0;

  private startedAt = 0;
  /** When the caller's turn ended and the clock started on her reply. */
  private awaitingSince?: number;
  private currentTurnAudioMs = 0;
  private pendingTools = new Map<string, number>();

  start() {
    this.startedAt = performance.now();
  }

  private now() {
    return performance.now() - this.startedAt;
  }

  /**
   * The caller stopped talking. Everything after this until her first audio
   * byte is latency the caller actually experiences.
   */
  callerTurnEnded() {
    if (this.awaitingSince === undefined) this.awaitingSince = performance.now();
  }

  /** A chunk of her audio arrived. The first one closes the latency window. */
  agentAudio(durationMs: number) {
    if (this.awaitingSince !== undefined) {
      this.turns.push({
        timeToFirstAudioMs: Math.round(performance.now() - this.awaitingSince),
        spokenMs: 0,
        at: Math.round(this.now()),
      });
      this.awaitingSince = undefined;
      this.currentTurnAudioMs = 0;
    }
    this.currentTurnAudioMs += durationMs;
    const last = this.turns[this.turns.length - 1];
    if (last) last.spokenMs = Math.round(this.currentTurnAudioMs);
  }

  toolStarted(id: string) {
    this.pendingTools.set(id, performance.now());
  }

  toolFinished(id: string, name: string) {
    const started = this.pendingTools.get(id);
    if (started === undefined) return;
    this.pendingTools.delete(id);
    this.tools.push({ name, durationMs: Math.round(performance.now() - started), at: Math.round(this.now()) });
  }

  bargeIn() {
    this.bargeIns += 1;
    // An interruption abandons the turn in flight; the clock restarts when the
    // caller stops talking again.
    this.awaitingSince = undefined;
  }

  reconnected() {
    this.reconnects += 1;
  }

  usage(prompt?: number, response?: number) {
    if (prompt) this.promptTokens = prompt;
    if (response) this.responseTokens = response;
  }

  snapshot(): CallTelemetry {
    const ttfa = this.turns.map((t) => t.timeToFirstAudioMs).sort((a, b) => a - b);
    const pct = (p: number) => (ttfa.length ? ttfa[Math.min(ttfa.length - 1, Math.floor(ttfa.length * p))] : undefined);

    const cost =
      (this.promptTokens / 1_000_000) * USD_PER_MILLION_INPUT_TOKENS +
      (this.responseTokens / 1_000_000) * USD_PER_MILLION_OUTPUT_TOKENS;

    return {
      turns: this.turns,
      tools: this.tools,
      bargeIns: this.bargeIns,
      reconnects: this.reconnects,
      promptTokens: this.promptTokens || undefined,
      responseTokens: this.responseTokens || undefined,
      totalTokens: this.promptTokens + this.responseTokens || undefined,
      medianTtfaMs: pct(0.5),
      p95TtfaMs: pct(0.95),
      estimatedCostUsd: cost > 0 ? Number(cost.toFixed(5)) : undefined,
    };
  }

  reset() {
    this.turns = [];
    this.tools = [];
    this.bargeIns = 0;
    this.reconnects = 0;
    this.promptTokens = 0;
    this.responseTokens = 0;
    this.awaitingSince = undefined;
    this.currentTurnAudioMs = 0;
    this.pendingTools.clear();
  }
}

/** 24 kHz mono float PCM -> milliseconds. */
export function pcmDurationMs(samples: number, rate = 24_000) {
  return (samples / rate) * 1000;
}
