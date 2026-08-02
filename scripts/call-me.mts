/**
 * Ask Priya to ring a phone.
 *
 *   npx tsx scripts/call-me.mts 9810012345
 *   npx tsx scripts/call-me.mts +919810012345
 *
 * Requires the telephony bridge to be running and publicly reachable, because
 * Twilio fetches the TwiML from it the moment the callee answers:
 *
 *   pnpm telephony
 *   ngrok http 5050            # then set TELEPHONY_PUBLIC_HOST to the https URL
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { explainTwilioError, normaliseIndianNumber, placeOutboundCall } from "../telephony/outbound";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npx tsx scripts/call-me.mts <phone number>");
  process.exit(1);
}

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const apiKeySid = process.env.TWILIO_API_KEY_SID ?? "";
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET ?? "";
const from = process.env.TWILIO_PHONE_NUMBER ?? "";
const host = (process.env.TELEPHONY_PUBLIC_HOST ?? "").replace(/\/$/, "");

const missing = [
  !accountSid && "TWILIO_ACCOUNT_SID",
  !authToken && !(apiKeySid && apiKeySecret) && "TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET)",
  !from && "TWILIO_PHONE_NUMBER",
  !host && "TELEPHONY_PUBLIC_HOST",
].filter(Boolean);

if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}
if (!host.startsWith("https://")) {
  console.error(`TELEPHONY_PUBLIC_HOST must be https (Twilio will not fetch http). Got: ${host}`);
  process.exit(1);
}

const answerUrl = `${host}/voice`;
const normalised = normaliseIndianNumber(to);

console.log(`Calling  ${normalised}`);
console.log(`From     ${from}`);
console.log(`TwiML    ${answerUrl}`);

try {
  const call = await placeOutboundCall({ accountSid, authToken, apiKeySid, apiKeySecret, from, to: normalised, answerUrl });
  console.log(`\nRinging — call SID ${call.sid} (${call.status})`);
  console.log("Pick up and Priya will open the conversation in Hinglish.");
  console.log("The transcript and lead land at /leads while you talk.");
} catch (err) {
  console.error(`\nCall failed.\n${explainTwilioError(err)}`);
  process.exit(1);
}
