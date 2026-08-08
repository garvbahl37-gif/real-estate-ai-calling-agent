/**
 * Records clean, agent-only samples of Priya's speech for the README.
 *
 *   npx tsx scripts/capture-voice-samples.mts
 *
 * A screen recording captures both voices mixed into the same channels, so the
 * agent cannot be isolated from it afterwards — measured, the L−R difference is
 * −65 dB, i.e. the channels are identical. These samples come straight from a
 * live session instead: real replies, using the shipped prompt, voice and
 * catalogue, with nothing else on the track.
 */
import "./load-env.mts";

import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { runAgentTool } from "../src/lib/agent-tools";
import { GEMINI_API_KEYS, LIVE_MODEL } from "../src/lib/config";
import { buildLiveConfig } from "../src/lib/live-config";

const RATE = 24_000;

const SAMPLES = [
  {
    file: "priya-hindi",
    language: "hindi" as const,
    ask: "मुझे नोएडा में 3BHK चाहिए, बजट डेढ़ करोड़ तक। क्या options हैं?",
  },
  {
    file: "priya-hinglish",
    language: "hinglish" as const,
    ask: "Investment ke liye dekh raha hoon. Sector 150 mein kya milega, aur possession kab tak hai?",
  },
  {
    file: "priya-english",
    language: "english" as const,
    ask: "I'm looking for a ready-to-move 3BHK. What do you have, and is it RERA registered?",
  },
];

function toWav(pcm: Float32Array): Buffer {
  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + pcm.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    buf.writeInt16LE(v < 0 ? v * 0x8000 : v * 0x7fff, 44 + i * 2);
  }
  return buf;
}

function decode(b64: string): Float32Array {
  const raw = Buffer.from(b64, "base64");
  const out = new Float32Array(Math.floor(raw.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = raw.readInt16LE(i * 2) / 0x8000;
  return out;
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEYS[0] });

for (const s of SAMPLES) {
  const chunks: Float32Array[] = [];
  let text = "";
  let asked = false;

  // Declared before connect and assigned after. The callbacks fire during the
  // handshake, and a `const` bound by `await` is still in its temporal dead zone
  // at that point — referencing it from onmessage throws inside the SDK, which
  // swallows the error and leaves the session mute. That is what produced
  // zero-length samples on the first attempt.
  let session: Session | undefined;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 45_000);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };

    void ai.live
      .connect({
        model: LIVE_MODEL,
        config: buildLiveConfig({ openingLanguage: s.language }),
        callbacks: {
          onopen: () => {},
          onmessage: (m: LiveServerMessage) => {
            // Tool calls must be answered or she never speaks. Asked a real
            // question she calls search_projects first and then waits for the
            // result — which is exactly what the first version of this script
            // failed to send, so every sample came back zero-length.
            if (m.toolCall?.functionCalls?.length) {
              void Promise.all(
                m.toolCall.functionCalls.map(async (fc) => ({
                  id: fc.id,
                  name: fc.name,
                  response: (await runAgentTool(fc.name ?? "", (fc.args ?? {}) as Record<string, unknown>))
                    .response,
                })),
              ).then((functionResponses) => session?.sendToolResponse({ functionResponses }));
            }

            // Skip her greeting; we want the answer to a real question.
            if (asked) {
              for (const part of m.serverContent?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) chunks.push(decode(part.inlineData.data));
              }
              if (m.serverContent?.outputTranscription?.text) text += m.serverContent.outputTranscription.text;
            }
            if (m.serverContent?.turnComplete) {
              if (!asked) {
                asked = true;
                session?.sendRealtimeInput({ text: s.ask });
              } else {
                finish();
              }
            }
          },
          onerror: finish,
          onclose: finish,
        },
      })
      .then((sess) => {
        session = sess;
        sess.sendRealtimeInput({ text: "[SYSTEM: The call has connected. Give your one-line opening now.]" });
      })
      .catch(finish);
  });

  try {
    session?.close();
  } catch {
    /* already gone */
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total < RATE) {
    console.log(`${s.file.padEnd(16)} FAILED — captured ${total} samples`);
    continue;
  }
  const joined = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    joined.set(c, o);
    o += c.length;
  }

  const wav = `docs/audio/${s.file}.wav`;
  const mp3 = `docs/audio/${s.file}.mp3`;
  writeFileSync(wav, toWav(joined));
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", wav,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-codec:a", "libmp3lame", "-b:a", "96k", mp3,
  ]);
  unlinkSync(wav);
  writeFileSync(`docs/audio/${s.file}.txt`, text.trim() + "\n");

  console.log(`${s.file.padEnd(16)} ${(total / RATE).toFixed(1)}s  "${text.trim().slice(0, 80)}"`);
}
process.exit(0);
