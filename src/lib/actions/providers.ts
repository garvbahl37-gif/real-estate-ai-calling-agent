import { formatInr, getProject } from "../projects";
import type { CallRecord } from "../types";
import type { ActionContext, ActionProvider } from "./types";

/**
 * The built-in post-call actions.
 *
 * Two of these do real work with no paid dependency; the third cannot, and says
 * so rather than pretending. That split is deliberate — a provider interface
 * whose only implementations are stubs proves nothing about whether the
 * interface is the right shape.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** The lead, flattened to what a downstream system actually wants. */
function leadPayload(call: CallRecord) {
  const r = call.requirements;
  return {
    callId: call.id,
    channel: call.channel,
    startedAt: call.startedAt,
    durationSec: call.durationSec,
    name: r.name,
    phone: r.phone ?? call.fromNumber,
    email: r.email,
    intent: r.intent,
    locations: r.preferredLocations,
    propertyType: r.propertyType,
    configurations: r.configurations,
    budget:
      r.budgetMinInr || r.budgetMaxInr
        ? { minInr: r.budgetMinInr, maxInr: r.budgetMaxInr, label: budgetLabel(call) }
        : undefined,
    purpose: r.purpose,
    timeline: r.timeline,
    financing: r.financing,
    interestedProjects: (r.interestedProjectIds ?? []).map((id) => ({ id, name: getProject(id)?.name })),
    siteVisit: r.siteVisitRequested ? { requested: true, preference: r.siteVisitPreference } : undefined,
    qualification: call.summary?.qualification,
    headline: call.summary?.headline,
    nextAction: call.summary?.nextAction,
    objections: call.summary?.objections,
    // Included because a lead that scored well on a call where she misquoted a
    // price is not the same lead, and the CRM should be able to see that.
    groundednessScore: call.groundedness?.score,
    handoffRequested: Boolean(call.handoff),
  };
}

function budgetLabel(call: CallRecord): string {
  const { budgetMinInr: lo, budgetMaxInr: hi } = call.requirements;
  if (lo && hi) return `${formatInr(lo)} – ${formatInr(hi)}`;
  if (hi) return `up to ${formatInr(hi)}`;
  if (lo) return `${formatInr(lo)}+`;
  return "not stated";
}

/** A lead worth acting on at all. */
function isQualified(call: CallRecord): boolean {
  return Boolean(call.requirements.phone || call.fromNumber || call.requirements.name);
}

/* ------------------------------------------------------------------ */
/* CRM webhook — fully functional                                       */
/* ------------------------------------------------------------------ */

export const crmWebhookProvider: ActionProvider = {
  name: "crm-webhook",
  description: "POSTs the qualified lead as JSON to any CRM, Zapier catch hook or n8n workflow.",

  isConfigured: () => Boolean(process.env.CRM_WEBHOOK_URL),
  configurationHint: () => "Set CRM_WEBHOOK_URL to any endpoint that accepts a JSON POST.",

  shouldRun: ({ call }) => isQualified(call),

  async run({ call, idempotencyKey }: ActionContext) {
    const url = process.env.CRM_WEBHOOK_URL!;

    // A hung webhook would otherwise hold the function open until the platform
    // kills it, and the summary would look like it failed for its own reasons.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          // Lets the receiver drop a duplicate rather than creating a second
          // lead. The summary route can legitimately run twice with `force`.
          "Idempotency-Key": idempotencyKey,
          ...(process.env.CRM_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.CRM_WEBHOOK_SECRET}` } : {}),
        },
        body: JSON.stringify({ event: "call.qualified", idempotencyKey, lead: leadPayload(call) }),
      });

      return res.ok
        ? { status: "sent" as const, detail: `Lead delivered (HTTP ${res.status}).`, data: { status: res.status } }
        : { status: "failed" as const, detail: `Webhook returned HTTP ${res.status}.`, data: { status: res.status } };
    } catch (err) {
      const aborted = (err as Error).name === "AbortError";
      return {
        status: "failed" as const,
        detail: aborted ? "Webhook did not respond within 8s." : `Webhook error: ${(err as Error).message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Site-visit calendar invite — fully functional                        */
/* ------------------------------------------------------------------ */

/** Escapes the characters iCalendar treats as structure. */
function ics(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsStamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Folds a line to 75 octets, as RFC 5545 requires.
 *
 * Not pedantry: Outlook and several Android calendar clients reject an
 * unfolded long line outright, and a project name plus a Noida sector plus a
 * developer name is comfortably past 75 characters.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // Continuation lines carry a leading space, so they get one octet less.
    let take = Math.min(start === 0 ? 75 : 74, bytes.length - start);
    // The limit is in octets but the content is UTF-8, and this catalogue is
    // full of ₹ (3 bytes) and Devanagari. Splitting mid-character would emit a
    // replacement character on unfold, so back off to a lead byte — anything
    // matching 0b10xxxxxx is a continuation and cannot start a line.
    while (take > 1 && start + take < bytes.length && (bytes[start + take] & 0xc0) === 0x80) take--;
    out.push((start === 0 ? "" : " ") + bytes.subarray(start, start + take).toString("utf8"));
    start += take;
  }
  return out.join("\r\n");
}

export const calendarInviteProvider: ActionProvider = {
  name: "site-visit-invite",
  description: "Builds an RFC 5545 calendar invite for the site visit she booked, attachable to any email.",

  // No credential and no vendor: this is a text format.
  isConfigured: () => true,
  configurationHint: () => "Always available — generating an .ics file needs no external service.",

  shouldRun: ({ call }) => Boolean(call.requirements.siteVisitRequested) && isQualified(call),

  async run({ call, idempotencyKey }: ActionContext) {
    const r = call.requirements;
    const project = r.interestedProjectIds?.length ? getProject(r.interestedProjectIds[0]) : undefined;

    // The agent takes a preference in words ("Saturday morning"), not a
    // timestamp — asking a caller to fix a slot on a first call is the wrong
    // conversation. So the invite is a placeholder the sales team moves, and
    // the caller's own words go in the description rather than being guessed at.
    const start = new Date(Date.now() + 3 * 24 * 3600_000);
    start.setUTCHours(5, 30, 0, 0); // 11:00 IST
    const end = new Date(start.getTime() + 60 * 60_000);

    const title = project ? `Site visit — ${project.name}` : "Site visit — Aarambh Realty";
    const location = project ? `${project.locality}, ${project.city}` : "Aarambh Realty sales office";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aarambh Realty//Voice Agent//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${idempotencyKey}@aarambh-realty.demo`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${ics(title)}`,
      `LOCATION:${ics(location)}`,
      `DESCRIPTION:${ics(
        [
          `Lead: ${r.name ?? "Unnamed"} (${r.phone ?? call.fromNumber ?? "no number"})`,
          `Requirement: ${[r.configurations?.join("/"), r.propertyType, budgetLabel(call)].filter(Boolean).join(" · ")}`,
          r.siteVisitPreference ? `Caller's preference: ${r.siteVisitPreference}` : "",
          "",
          "PROVISIONAL — confirm the slot with the caller before sending.",
        ]
          .filter(Boolean)
          .join("\n"),
      )}`,
      "STATUS:TENTATIVE",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const content = lines.map(fold).join("\r\n") + "\r\n";
    return {
      status: "sent" as const,
      detail: `Invite prepared for ${title}${r.siteVisitPreference ? ` (caller asked for ${r.siteVisitPreference})` : ""}.`,
      data: { filename: `site-visit-${call.id}.ics`, ics: content },
    };
  },
};

/* ------------------------------------------------------------------ */
/* WhatsApp — honestly unimplemented                                    */
/* ------------------------------------------------------------------ */

export const whatsappProvider: ActionProvider = {
  name: "whatsapp-recap",
  description: "Sends the caller a WhatsApp recap with the shortlisted projects and price bands.",

  // WhatsApp Business messaging has no free tier and requires a verified
  // business. Rather than fake a send, this reports honestly and the runner
  // records it as skipped — which is the state this project ships in.
  isConfigured: () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
  configurationHint: () =>
    "Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_ID from a WhatsApp Business account. " +
    "Not free, so it is unconfigured in this deployment.",

  shouldRun: ({ call }) => Boolean(call.requirements.phone ?? call.fromNumber),

  async run({ call }: ActionContext) {
    const to = call.requirements.phone ?? call.fromNumber!;
    const projects = (call.requirements.interestedProjectIds ?? [])
      .map((id) => getProject(id))
      .filter(Boolean)
      .map((p) => `${p!.name} — ${p!.priceRangeLabel}`);

    const body = [
      `Namaste ${call.requirements.name ?? ""}`.trim() + ",",
      "",
      "Aaj ki baat ke liye dhanyavaad. Ye rahe options jo humne discuss kiye:",
      ...projects.map((p) => `• ${p}`),
      "",
      "Koi bhi sawaal ho to reply kar dijiye.",
      "— Aarambh Realty",
    ].join("\n");

    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(8000),
    });

    return res.ok
      ? { status: "sent" as const, detail: `Recap sent to ${to}.` }
      : { status: "failed" as const, detail: `WhatsApp API returned HTTP ${res.status}.` };
  },
};

export const BUILT_IN_PROVIDERS: ActionProvider[] = [
  crmWebhookProvider,
  calendarInviteProvider,
  whatsappProvider,
];
