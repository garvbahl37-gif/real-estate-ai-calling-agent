/**
 * Model catalogue. Deliberately free of any `process.env` access so it can be
 * imported by client components without pulling server config — and therefore
 * server secrets — into the browser bundle.
 */

/**
 * Live (native-audio) models: speech in, speech out, with no ASR/TTS pipeline
 * in between. Both entries are listed "Free of charge" on the Gemini Developer
 * API free tier and were verified against a freshly issued key.
 *
 * 3.1-flash-live is the default because it opened noticeably better Hindi in
 * side-by-side testing ("Namaste! Aarambh Realty mein aapka swagat hai…" versus
 * 2.5's more anglicised "Hello! Main Priya from Aarambh Realty."), and it emits
 * session-resumption handles without being asked.
 */
export const LIVE_MODELS = [
  {
    id: "gemini-3.1-flash-live-preview",
    label: "Gemini 3.1 Flash Live",
    note: "Default — most natural Hindi",
  },
  {
    id: "gemini-2.5-flash-native-audio-preview-12-2025",
    label: "Gemini 2.5 Native Audio",
    note: "Stable fallback",
  },
  {
    id: "gemini-2.5-flash-native-audio-latest",
    label: "Gemini 2.5 Native Audio (latest)",
    note: "Rolling alias",
  },
] as const;

export type LiveModelId = (typeof LIVE_MODELS)[number]["id"];

export const DEFAULT_LIVE_MODEL: LiveModelId = "gemini-3.1-flash-live-preview";

export function isKnownLiveModel(id: string): id is LiveModelId {
  return LIVE_MODELS.some((m) => m.id === id);
}
