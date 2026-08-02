import { EndSensitivity, Modality, StartSensitivity, type LiveConnectConfig } from "@google/genai";
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
/**
 * Terms a general-purpose ASR reliably mangles and this agent cannot afford to
 * get wrong: sector numbers, unit configurations, Indian money units and the
 * project names themselves.
 */
const SPEECH_VOCABULARY = [
  "Aarambh Realty",
  "Skyline Greens",
  "Riverfront Residences",
  "Urbania",
  "Green Acres",
  "Sector 150",
  "Sector 128",
  "Sector 16B",
  "Noida Expressway",
  "Greater Noida West",
  "Yamuna Expressway",
  "Jewar Airport",
  "Noida Extension",
  "1BHK",
  "2BHK",
  "3BHK",
  "4BHK",
  "5BHK",
  "lakh",
  "crore",
  "carpet area",
  "saleable area",
  "possession",
  "RERA",
  "ready to move",
  "under construction",
  "site visit",
  "booking amount",
  "home loan",
  "EMI",
  "registry",
  "clubhouse",
  "subvention",
];

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
    //
    // `languageCodes` is not optional in practice. Left empty, transcription
    // falls back to automatic language detection, and on Hindi speech — or on
    // room noise — that detector drifts to entirely unrelated scripts. In
    // testing it produced Chinese characters for a caller speaking Hindi, and
    // invented a full Devanagari sentence out of near-silence. Pinning the
    // languages removes the guesswork.
    inputAudioTranscription: {
      languageCodes: ["hi-IN", "en-IN"],
      // Sector numbers, configurations and Indian money units are exactly what
      // a general ASR mangles, and exactly what has to be right on a sales call.
      customVocabulary: SPEECH_VOCABULARY,
    },
    outputAudioTranscription: { languageCodes: ["hi-IN", "en-IN"] },

    tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],

    realtimeInputConfig: {
      automaticActivityDetection: {
        // The Live API defaults to START_SENSITIVITY_HIGH — "detect the start of
        // speech more often". On a real microphone in a real room that means a
        // fan, a keyboard or traffic gets committed as a user turn, the ASR
        // hallucinates words out of it, and the agent answers something nobody
        // said. Two symptoms, one cause: junk text in the transcript, and a call
        // that will not wind down because the agent keeps replying to phantoms.
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
        // Ending a turn less eagerly, for the same reason in reverse: a buyer
        // pausing mid-sentence to do arithmetic on a budget should not be cut off.
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        // A phone line adds codec and network gaps on top of the human ones.
        silenceDurationMs: channel === "phone" ? 1100 : 800,
        // Require a bit more sustained sound before opening a turn. Raising this
        // is the single most effective guard against a short noise burst being
        // treated as speech.
        prefixPaddingMs: 300,
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
