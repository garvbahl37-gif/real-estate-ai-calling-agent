/**
 * Simulates a Twilio Media Stream against the telephony bridge.
 *
 * Speaks the exact protocol Twilio speaks — connected / start / media / stop,
 * 8 kHz μ-law in 20 ms base64 frames — so the whole phone path can be verified
 * without buying a number or making a call: TwiML, the WebSocket handshake,
 * μ-law → PCM upsampling, the Gemini session, and the 24 kHz → 8 kHz → μ-law
 * return leg.
 *
 * Usage:  npx tsx scripts/simulate-twilio-call.mts
 */
import WebSocket from "ws";
import { muLawBufferToPcm16, pcm16ToMuLawBuffer } from "../telephony/audio";

const URL = process.env.BRIDGE_WS || "ws://localhost:5050/stream";
const STREAM_SID = "MZsimulated0000000000000000000000";
const CALL_SID = "CAsimulated000000000000000000000";

const ws = new WebSocket(URL);

let inboundFrames = 0;
let inboundBytes = 0;
let clears = 0;
let firstAudioAt = 0;
const started = Date.now();

/** 20 ms of near-silence with a little dither, so VAD sees a live line. */
function silenceFrame(): string {
  const pcm = new Int16Array(160);
  for (let i = 0; i < pcm.length; i++) pcm[i] = (Math.random() * 12 - 6) | 0;
  return pcm16ToMuLawBuffer(pcm).toString("base64");
}

ws.on("open", () => {
  console.log(`→ connected to ${URL}`);
  ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
  ws.send(
    JSON.stringify({
      event: "start",
      sequenceNumber: "1",
      start: {
        streamSid: STREAM_SID,
        callSid: CALL_SID,
        accountSid: "ACsimulated",
        tracks: ["inbound"],
        customParameters: { from: "+919810012345" },
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
      },
      streamSid: STREAM_SID,
    }),
  );
  console.log("→ sent start, streaming silence…");

  // Twilio paces at one 20 ms frame per 20 ms; matching that matters because
  // the model's VAD reads timing, not just content.
  let sent = 0;
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return clearInterval(timer);
    ws.send(JSON.stringify({ event: "media", streamSid: STREAM_SID, media: { payload: silenceFrame() } }));
    if (++sent >= 750) {
      // 15 s
      clearInterval(timer);
      ws.send(JSON.stringify({ event: "stop", streamSid: STREAM_SID }));
      setTimeout(() => ws.close(), 1500);
    }
  }, 20);
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.event === "media") {
    const buf = Buffer.from(msg.media.payload, "base64");
    inboundFrames++;
    inboundBytes += buf.length;
    if (!firstAudioAt) {
      firstAudioAt = Date.now() - started;
      const pcm = muLawBufferToPcm16(buf);
      const peak = Math.max(...Array.from(pcm).map(Math.abs));
      console.log(`← first audio frame after ${firstAudioAt} ms (${buf.length} bytes, peak ${peak})`);
    }
  } else if (msg.event === "clear") {
    clears++;
    console.log("← clear (barge-in)");
  } else {
    console.log(`← ${msg.event}`);
  }
});

ws.on("close", () => {
  const seconds = inboundBytes / 8000; // 8000 μ-law bytes = 1 s of audio
  console.log("\n=== RESULT ===");
  console.log(`frames returned : ${inboundFrames}`);
  console.log(`audio returned  : ${seconds.toFixed(2)} s`);
  console.log(`time to first   : ${firstAudioAt || "—"} ms`);
  console.log(`barge-in clears : ${clears}`);
  const ok = inboundFrames > 0 && inboundBytes > 8000;
  console.log(ok ? "\nPASS — the bridge returned real speech over the phone path." : "\nFAIL — no usable audio came back.");
  process.exit(ok ? 0 : 1);
});

ws.on("error", (e) => {
  console.error("socket error:", e.message);
  process.exit(1);
});
