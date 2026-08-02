import { Modality, type LiveConnectConfig } from "@google/genai";
import { AGENT_FUNCTION_DECLARATIONS } from "./agent-tools";
import { DEFAULT_VOICE, buildSystemInstruction, type PromptOptions } from "./agent-prompt";

/**
 * The single definition of a Priya session.
 *
 * Why this lives on the server and not in the browser client:
 *
 * An ephemeral token is minted with `liveConnectConstraints.config`, and that
 * config is AUTHORITATIVE — anything the client passes to `live.connect()` is
 * silently discarded. This is not obvious from the docs, and it bites hard: the
 * agent connects fine, speaks fine, and introduces itself as "Gemini" in
 * English because the system instruction never reached the model.
 *
 * Once you know that, it's the better design anyway. The prompt, the
 * guardrails, the project catalogue and the tool list are all fixed at mint
 * time, so a user with devtools open cannot rewrite the agent's instructions,
 * add a tool, or strip the "no guaranteed returns" rule. The browser gets a
 * credential, not a configuration.
 *
 * The Twilio bridge builds the same config and passes it directly, because it
 * connects with the raw API key server-side and has no token in between.
 */
export interface LiveConfigOptions extends PromptOptions {
  voice?: string;
  /** Resume an interrupted conversation instead of starting a new one. */
  resumeHandle?: string;
  /**
   * Telephony carries 8 kHz audio and no browser echo cancellation, so the
   * bridge widens the end-of-speech window to avoid clipping the caller.
   */
  channel?: "browser" | "phone";
  /**
   * Emotion-aware dialogue. Only safe on the raw-key path — see the note where
   * it is applied below.
   */
  affectiveDialog?: boolean;
}

export function buildLiveConfig(opts: LiveConfigOptions = {}): LiveConnectConfig {
  const { voice = DEFAULT_VOICE, resumeHandle, channel = "browser", affectiveDialog = false, ...promptOpts } = opts;

  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: buildSystemInstruction(promptOpts),
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },

    // Both directions transcribed: the console renders a live bilingual
    // transcript from this, and the summariser needs real text to work from.
    inputAudioTranscription: {},
    outputAudioTranscription: {},

    tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],

    realtimeInputConfig: {
      automaticActivityDetection: {
        // A buyer pauses mid-sentence doing arithmetic on a budget. The default
        // end-of-speech window cuts them off, so widen it — more so on a phone
        // line, where the codec and network add their own gaps.
        silenceDurationMs: channel === "phone" ? 900 : 700,
        prefixPaddingMs: 200,
      },
    },

    // Emotion-aware dialogue: the model tracks tone — hesitant, annoyed, keen —
    // and answers to it. Off, and that is measured rather than an oversight.
    //
    // With this flag set, every session on gemini-3.1-flash-live-preview dies
    // on connect with a bare "Internal error encountered". Bisecting the config
    // field by field isolated this one flag: remove it and the identical config
    // connects and speaks. It fails the same way on v1alpha and v1beta, through
    // an ephemeral token and with a raw API key, on both the browser and the
    // telephony path. It only appears to work with a minimal config (no tools,
    // short system instruction), which is what made it look transport-specific
    // at first.
    //
    // Left behind an opt-in flag so it is one argument to re-test when the
    // preview model stabilises — the naturalness gain is worth having.
    ...(affectiveDialog ? { enableAffectiveDialog: true } : {}),

    // Without this, a long call eventually hits the context ceiling and the
    // server drops the session mid-conversation.
    contextWindowCompression: { slidingWindow: {} },

    // Returns a handle we can reconnect with after a network blip.
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},

    temperature: 0.85,
  };
}
