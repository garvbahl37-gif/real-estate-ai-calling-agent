/**
 * Checks whether this Twilio account can actually place the demo call, and says
 * precisely what is missing when it cannot.
 *
 *   npx tsx scripts/twilio-doctor.mts
 *
 * Written because Twilio's failures are opaque at exactly the wrong moment: a
 * restricted API key returns 20003 "Policy evaluation failed" for a permissions
 * problem, an unverified number returns 21219, and a disabled destination
 * returns 21212 — none of which say what to do next.
 */
import "./load-env.mts";

import { twilioClient } from "../telephony/outbound";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const apiKeySid = process.env.TWILIO_API_KEY_SID ?? "";
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET ?? "";
const mobile = process.env.DEMO_MOBILE ?? "";
const fromNumber = process.env.TWILIO_PHONE_NUMBER ?? "";
const publicHost = process.env.TELEPHONY_PUBLIC_HOST ?? "";

if (!accountSid) {
  console.error("TWILIO_ACCOUNT_SID is not set in .env.local");
  process.exit(1);
}

const usingKey = Boolean(apiKeySid && apiKeySecret) && !authToken;
const client = twilioClient({ accountSid, authToken, apiKeySid, apiKeySecret });

const todo: string[] = [];
const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string, fix: string) => {
  console.log(`  ✗ ${s}`);
  todo.push(fix);
};

console.log(`\nTwilio readiness — ${accountSid}`);
console.log(`Credential: ${usingKey ? `API key ${apiKeySid}` : "account Auth Token"}\n`);

let trial = false;
try {
  const acct = await client.api.v2010.accounts(accountSid).fetch();
  trial = acct.type === "Trial";
  ok(`Account reachable — ${acct.friendlyName} (${acct.type}, ${acct.status})`);
} catch (e) {
  bad(`Cannot read the account: ${(e as Error).message}`, "Check TWILIO_ACCOUNT_SID and the auth token / key secret.");
}

// A number to call FROM.
try {
  const nums = await client.incomingPhoneNumbers.list({ limit: 20 });
  const voice = nums.filter((n) => n.capabilities.voice);
  if (voice.length === 0) {
    bad(
      "No phone number on this account",
      "Buy a voice-capable US number (free on trial):\n" +
        "     https://console.twilio.com/us1/develop/phone-numbers/manage/search\n" +
        "     Twilio stopped selling Indian numbers in Aug 2024 — a US number can still call +91.",
    );
  } else {
    ok(`Voice number available: ${voice.map((n) => n.phoneNumber).join(", ")}`);
    if (!fromNumber) {
      todo.push(`Set TWILIO_PHONE_NUMBER=${voice[0].phoneNumber} in .env.local`);
    } else if (!voice.some((n) => n.phoneNumber === fromNumber)) {
      bad(`TWILIO_PHONE_NUMBER (${fromNumber}) is not on this account`, `Set it to ${voice[0].phoneNumber}`);
    } else {
      ok(`TWILIO_PHONE_NUMBER matches an owned number`);
    }
  }
} catch (e) {
  const code = (e as { code?: number }).code;
  bad(
    `Cannot list phone numbers${code ? ` (${code})` : ""}`,
    code === 20003
      ? "The API key is Restricted and lacks phone-number permissions. Use the account Auth Token instead:\n" +
        "     https://console.twilio.com/us1/account/manage-account/general-settings"
      : "Check the credentials.",
  );
}

// The number to call TO must be verified while the account is on trial.
if (trial) {
  try {
    const verified = await client.outgoingCallerIds.list({ limit: 20 });
    const list = verified.map((v) => v.phoneNumber);
    if (mobile && list.includes(mobile)) ok(`${mobile} is a verified caller ID`);
    else if (mobile) {
      bad(
        `${mobile} is not verified (trial accounts can only call verified numbers)`,
        `Verify ${mobile} — Twilio reads out a 6-digit code you enter on the keypad:\n` +
          "     https://console.twilio.com/us1/develop/phone-numbers/manage/verified",
      );
    }
    if (list.length) console.log(`    verified: ${list.join(", ")}`);
  } catch (e) {
    const code = (e as { code?: number }).code;
    bad(
      `Cannot read verified caller IDs${code ? ` (${code})` : ""}`,
      code === 20003
        ? "Restricted API key — needs the account Auth Token to read or add verified caller IDs."
        : "Check the credentials.",
    );
  }
}

// Calling +91 needs India enabled, which is off by default on new accounts.
try {
  const india = await client.voice.v1.dialingPermissions.countries("IN").fetch();
  if (india.lowRiskNumbersEnabled) ok("India (+91) is enabled in Voice geo permissions");
  else
    bad(
      "India (+91) is disabled in Voice geo permissions",
      "Enable India:\n     https://console.twilio.com/us1/develop/voice/settings/geo-permissions",
    );
} catch (e) {
  const code = (e as { code?: number }).code;
  bad(
    `Cannot read geo permissions${code ? ` (${code})` : ""}`,
    code === 20003
      ? "Restricted API key — needs the account Auth Token to read geo permissions."
      : "Check India is enabled at https://console.twilio.com/us1/develop/voice/settings/geo-permissions",
  );
}

// The bridge has to be reachable by Twilio.
if (!publicHost) {
  todo.push(
    "Expose the bridge and set TELEPHONY_PUBLIC_HOST:\n" +
      "     pnpm telephony      (terminal 1)\n" +
      "     ngrok http 5050     (terminal 2, copy the https URL)",
  );
} else if (!publicHost.startsWith("https://")) {
  bad(`TELEPHONY_PUBLIC_HOST is not https (${publicHost})`, "Twilio will not fetch TwiML over http.");
} else {
  try {
    const res = await fetch(`${publicHost.replace(/\/$/, "")}/health`);
    if (res.ok) ok(`Bridge reachable at ${publicHost}`);
    else bad(`Bridge returned ${res.status} at ${publicHost}/health`, "Is `pnpm telephony` running?");
  } catch {
    bad(`Bridge unreachable at ${publicHost}`, "Start it with `pnpm telephony` and check the tunnel is up.");
  }
}

console.log("");
if (todo.length === 0) {
  console.log(`Ready. Place the call with:\n  npx tsx scripts/call-me.mts ${mobile || "<number>"}\n`);
  process.exit(0);
}
console.log(`${todo.length} thing(s) to do:\n`);
todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}\n`));
process.exit(1);
