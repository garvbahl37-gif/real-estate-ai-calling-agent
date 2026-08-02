import twilio from "twilio";

/**
 * Placing an outbound call.
 *
 * This is the mode that matches the product: a sales executive rings a
 * prospect, not the other way round. It is also the only reliable demo on a
 * Twilio trial account — since October 2023, *inbound* calls to a trial number
 * are rejected unless the caller's own number is verified on that account,
 * which you cannot ask an interviewer to do mid-interview. Outbound only
 * requires the number being called to be verified, and the number you signed up
 * with is verified automatically.
 *
 * Twilio fetches TwiML from `answerUrl` once the callee picks up; that TwiML
 * opens the Media Stream back to our bridge, and from there it is the identical
 * code path as an inbound call.
 */

export interface TwilioAuth {
  accountSid: string;
  /**
   * Either the account's Auth Token, or an API Key SID + secret.
   *
   * API keys are the better practice — they can be revoked without rotating the
   * account credential — but a *Restricted* key only carries the permissions it
   * was granted, and a key that cannot reach the phone-number or caller-ID
   * resources will fail account setup with a 20003 "Policy evaluation failed"
   * long before it fails at placing a call.
   */
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
}

export function twilioClient(auth: TwilioAuth) {
  if (auth.apiKeySid && auth.apiKeySecret) {
    return twilio(auth.apiKeySid, auth.apiKeySecret, { accountSid: auth.accountSid });
  }
  if (!auth.authToken) throw new Error("Provide TWILIO_AUTH_TOKEN, or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET.");
  return twilio(auth.accountSid, auth.authToken);
}

export interface PlaceCallOptions extends TwilioAuth {
  /** The Twilio number to call from. Must be a non-Indian number to reach +91. */
  from: string;
  /** E.164, e.g. +919810012345. */
  to: string;
  /** Public https URL of this bridge's /voice endpoint. */
  answerUrl: string;
  /** Seconds to let it ring before giving up. */
  timeoutSec?: number;
}

export interface PlacedCall {
  sid: string;
  status: string;
  to: string;
  from: string;
}

export function normaliseIndianNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Bare 10-digit Indian mobile — the most common way someone types their own
  // number. Anything else is passed through and left to Twilio to reject.
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+91${digits.slice(1)}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function placeOutboundCall(opts: PlaceCallOptions): Promise<PlacedCall> {
  const client = twilioClient(opts);
  const to = normaliseIndianNumber(opts.to);

  const call = await client.calls.create({
    to,
    from: opts.from,
    url: opts.answerUrl,
    method: "POST",
    timeout: opts.timeoutSec ?? 30,
    // If it goes to voicemail there is no one to sell to; hanging up saves the
    // Gemini session and the trial credit.
    machineDetection: "Enable",
  });

  return { sid: call.sid, status: call.status, to, from: opts.from };
}

/**
 * Turns Twilio's error codes into something actionable. These three account for
 * almost every failed first call on a trial account, and the raw messages do
 * not make the fix obvious.
 */
export function explainTwilioError(err: unknown): string {
  const e = err as { code?: number; message?: string; status?: number };
  const code = e?.code;

  if (code === 21219 || code === 21210 || code === 21608) {
    return (
      `Twilio rejected the call because the number is not verified on this trial account.\n` +
      `  Verify it at https://console.twilio.com/us1/develop/phone-numbers/manage/verified\n` +
      `  (Twilio calls or texts you a 6-digit code. Trials allow up to 5 verified numbers.)`
    );
  }
  if (code === 21212 || code === 21215) {
    return (
      `Twilio will not dial this destination.\n` +
      `  If you are calling +91, enable India under Voice → Settings → Geo Permissions:\n` +
      `  https://console.twilio.com/us1/develop/voice/settings/geo-permissions`
    );
  }
  if (code === 21606 || code === 21205) {
    return (
      `The "from" number is not a voice-capable Twilio number on this account.\n` +
      `  Note that Twilio stopped selling Indian numbers in August 2024 — use a US number.\n` +
      `  Buy one at https://console.twilio.com/us1/develop/phone-numbers/manage/search`
    );
  }
  if (code === 20003) {
    return (
      `Twilio accepted the credentials but refused the operation (20003, "Policy evaluation failed").\n` +
      `  This is a Restricted API Key without permission for this resource — not a wrong secret.\n` +
      `  Use the account Auth Token, or create a Standard key at\n` +
      `  https://console.twilio.com/us1/account/keys-credentials/api-keys`
    );
  }
  if (e?.status === 401) {
    return "Twilio rejected the credentials. Check TWILIO_ACCOUNT_SID and the auth token / API key secret.";
  }
  return e?.message ?? String(err);
}
