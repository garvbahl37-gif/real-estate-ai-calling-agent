import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import twilio from "twilio";
import { WebSocketServer } from "ws";
import { PhoneCallBridge } from "./bridge";

/**
 * Standalone telephony bridge.
 *
 * Runs as its own long-lived process rather than inside the Next.js app,
 * because a Twilio Media Stream holds one WebSocket open for the whole call and
 * serverless functions are the wrong shape for that. It only needs to be
 * reachable by Twilio — locally that means an ngrok/cloudflared tunnel; in
 * production, any host that will keep a process alive.
 *
 * Two endpoints:
 *   POST /voice   — Twilio's webhook. Returns TwiML that opens the stream.
 *   WS   /stream  — the media stream itself.
 */

const PORT = Number(process.env.TELEPHONY_PORT || 5050);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
const APP_URL = process.env.PUBLIC_BASE_URL || process.env.APP_URL || "http://localhost:3000";
const PUBLIC_HOST = process.env.TELEPHONY_PUBLIC_HOST || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const VALIDATE_SIGNATURE = process.env.TWILIO_VALIDATE_SIGNATURE !== "false";

const log = (line: string) => console.log(`${new Date().toISOString().slice(11, 19)}  ${line}`);

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set. Add it to .env.local before starting the bridge.");
  process.exit(1);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      // A Twilio webhook body is a few hundred bytes; anything larger is not ours.
      if (data.length > 64_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        model: LIVE_MODEL,
        appUrl: APP_URL,
        publicHost: PUBLIC_HOST || "(not set — TwiML will use the request host)",
        signatureValidation: VALIDATE_SIGNATURE && Boolean(TWILIO_AUTH_TOKEN),
      }),
    );
    return;
  }

  if (url.pathname === "/voice" && (req.method === "POST" || req.method === "GET")) {
    const body = req.method === "POST" ? await readBody(req).catch(() => "") : "";
    const params = Object.fromEntries(new URLSearchParams(body));

    // Twilio signs every webhook. Without this check anyone who finds the URL
    // can make the bridge place Gemini sessions on your quota.
    if (VALIDATE_SIGNATURE && TWILIO_AUTH_TOKEN) {
      const signature = req.headers["x-twilio-signature"];
      const host = PUBLIC_HOST || `https://${req.headers.host}`;
      const fullUrl = `${host.replace(/\/$/, "")}/voice`;
      const valid =
        typeof signature === "string" && twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, fullUrl, params);
      if (!valid) {
        log(`rejected unsigned request to /voice (expected url ${fullUrl})`);
        res.writeHead(403).end("Invalid Twilio signature");
        return;
      }
    }

    const host = (PUBLIC_HOST || `https://${req.headers.host}`).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const wsUrl = `wss://${host}/stream`;
    const response = new twilio.twiml.VoiceResponse();

    // With machineDetection enabled, Twilio tells us who picked up. There is no
    // one to sell to on a voicemail greeting, so hang up rather than open a
    // Gemini session and talk to an answering machine.
    const answeredBy = params.AnsweredBy ?? "";
    if (/^machine/.test(answeredBy) || answeredBy === "fax") {
      log(`answered by ${answeredBy} — hanging up`);
      response.hangup();
      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(response.toString());
      return;
    }

    // On an inbound call the prospect is `From`. On an outbound one we dialled
    // them, so they are `To` and `From` is our own Twilio number — recording the
    // wrong one would file every outbound lead under the Twilio number.
    const outbound = (params.Direction ?? "").startsWith("outbound");
    const prospect = (outbound ? params.To : params.From) ?? "";

    const connect = response.connect();
    const stream = connect.stream({ url: wsUrl });
    // The stream `start` event carries no phone number, so pass it through.
    stream.parameter({ name: "from", value: prospect });

    log(`${outbound ? "outbound" : "inbound"} call · prospect ${prospect || "unknown"} → ${wsUrl}`);
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(response.toString());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found. Try /health or POST /voice.");
});

const wss = new WebSocketServer({ server, path: "/stream" });

wss.on("connection", (ws) => {
  log("media stream opened");
  new PhoneCallBridge(ws, {
    apiKey: GEMINI_API_KEY,
    model: LIVE_MODEL,
    appUrl: APP_URL,
    voice: process.env.AGENT_VOICE || "Aoede",
    log,
  });
});

server.listen(PORT, () => {
  log(`telephony bridge listening on :${PORT}`);
  log(`  model      ${LIVE_MODEL}`);
  log(`  app        ${APP_URL}`);
  log(`  public     ${PUBLIC_HOST || "(set TELEPHONY_PUBLIC_HOST to your tunnel URL)"}`);
  log(`  signature  ${VALIDATE_SIGNATURE && TWILIO_AUTH_TOKEN ? "validated" : "NOT validated"}`);
  log("");
  log("Point your Twilio number's Voice webhook at:");
  log(`  ${PUBLIC_HOST || "https://<your-tunnel>"}/voice   (HTTP POST)`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig} — closing`);
    wss.clients.forEach((c) => c.close());
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
