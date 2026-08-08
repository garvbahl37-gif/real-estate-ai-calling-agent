/**
 * Phone-number redaction.
 *
 * This demo is public, and the numbers in it are real: whoever tries the agent
 * types their own mobile, and a campaign list is bulk-uploaded third parties
 * who never touched the system at all. Neither group agreed to have their
 * number published, and "it's only a demo" is not a defence once the data is
 * real.
 *
 * The number is also the only genuinely sensitive field on a lead. Everything
 * else — the requirement, the budget, the qualification score — is what makes
 * the demo worth looking at, so masking the number costs nothing and keeps the
 * rest visible. Full numbers require the operator token.
 */

/**
 * `+919810012345` → `+9198100•••45`
 *
 * Keeps the country code and enough of the head and tail that an operator can
 * recognise a number they already know, while leaving too little to dial.
 */
export function maskPhone(phone: string | undefined): string | undefined {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return "•".repeat(trimmed.length);
  const head = trimmed.slice(0, Math.max(4, trimmed.length - 5));
  const tail = trimmed.slice(-2);
  return `${head}•••${tail}`;
}

/**
 * Masks a phone number spoken aloud inside free text.
 *
 * Masking the structured fields is not enough on its own: the caller reads
 * their number out, so it lands verbatim in the transcript — "Mera naam Rahul
 * Verma hai, number 9810012345" — and in the arguments of the tool call that
 * captured it. An audit of this project found exactly that surviving after the
 * `phone` fields were already masked.
 *
 * Ten or more digits, optionally separated by spaces or dashes. Deliberately
 * not fewer: "Sector 150" and "1.5 crore" are the numbers this agent is
 * supposed to say, and mangling them would make a transcript useless to read.
 */
export function scrubSpokenNumbers(text: string): string {
  return text.replace(/(?:\d[\s-]?){9}\d/g, (m) => {
    const digits = m.replace(/\D/g, "");
    return `${digits.slice(0, 5)}•••${digits.slice(-2)}`;
  });
}

/** Recursively masks anything phone-shaped in a tool call's arguments or result. */
function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return scrubSpokenNumbers(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        // Identifiers are long digit runs that are not phone numbers — a tool
        // call id like `fc_5859909964309661584` would otherwise be mangled into
        // something that no longer correlates with anything.
        if (/^(id|callId|projectId|reraId|sid)$/i.test(k)) return [k, v];
        if (/phone|mobile|number/i.test(k) && typeof v === "string") return [k, maskPhone(v)];
        return [k, redactDeep(v)];
      }),
    );
  }
  return value;
}

interface RedactableCall {
  fromNumber?: string;
  requirements?: { phone?: string };
  summary?: unknown;
  transcript?: { text: string }[];
  toolCalls?: unknown[];
}

/**
 * Applies the mask everywhere a number hides on a call record.
 *
 * `includeConversation: false` drops the transcript and tool calls entirely,
 * which is what the list endpoint wants — a list view has no use for them, and
 * not sending them is both the safer and the very much smaller response.
 */
export function redactCall<T extends RedactableCall>(call: T, includeConversation = true): T {
  return {
    ...call,
    fromNumber: maskPhone(call.fromNumber),
    // `notes` is free text the agent wrote, so this needs the deep scrub too.
    ...(call.requirements ? { requirements: redactDeep(call.requirements) } : {}),
    // The summary is model-written prose, so a number the caller read out can
    // land in the headline, the next action or the agent's notes as easily as
    // in the phone field. Scrub the whole object rather than named fields.
    ...(call.summary ? { summary: redactDeep(call.summary) } : {}),
    ...(includeConversation
      ? {
          transcript: (call.transcript ?? []).map((t) => ({ ...t, text: scrubSpokenNumbers(t.text) })),
          toolCalls: (call.toolCalls ?? []).map(redactDeep),
        }
      : { transcript: [], toolCalls: [] }),
  } as T;
}
