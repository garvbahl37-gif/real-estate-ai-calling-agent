import { z } from "zod";

/**
 * Request schemas. Everything crossing the network boundary is parsed, not
 * cast — the live client writes transcripts straight into storage, so an
 * unvalidated PATCH is a direct path from the browser into the CRM.
 *
 * Sizes are capped deliberately: a 40-minute call is a few hundred turns, so
 * anything an order of magnitude past that is abuse, not usage.
 */

export const languageSchema = z.enum(["hindi", "hinglish", "english"]);

export const tokenRequestSchema = z.object({
  voice: z
    .string()
    .max(32)
    // Voice names go into a request to Google; keep them to the known shape.
    .regex(/^[A-Za-z]+$/, "Voice must be a prebuilt voice name")
    .optional(),
  openingLanguage: languageSchema.optional(),
  customerName: z.string().trim().max(80).optional(),
  scenarioOverride: z.string().trim().max(2000).optional(),
  // Checked against the allow-list in config, not just the shape — this string
  // is forwarded to Google as the model to bill against.
  model: z.string().max(80).optional(),
  // Session-resumption handle from a dropped connection. Because the session
  // config is locked at mint time, a reconnect has to ask for a new token that
  // carries the handle.
  resumeHandle: z.string().max(4096).optional(),
});

export const transcriptTurnSchema = z.object({
  id: z.string().max(64),
  role: z.enum(["agent", "customer", "system"]),
  text: z.string().max(8000),
  at: z.number().finite().nonnegative().max(24 * 60 * 60 * 1000),
  languageCode: z.string().max(16).optional(),
  partial: z.boolean().optional(),
});

export const toolInvocationSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(64),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
  at: z.number().finite().nonnegative(),
});

export const leadRequirementsSchema = z
  .object({
    name: z.string().max(120).optional(),
    phone: z.string().max(32).optional(),
    email: z.string().max(160).optional(),
    intent: z.enum(["buy", "invest", "rent", "just_browsing", "not_interested", "unknown"]).optional(),
    preferredLocations: z.array(z.string().max(120)).max(20).optional(),
    propertyType: z.enum(["apartment", "villa", "plot", "commercial", "unknown"]).optional(),
    configurations: z
      .array(z.enum(["1BHK", "2BHK", "3BHK", "3BHK+S", "4BHK", "5BHK", "plot", "shop", "office"]))
      .max(20)
      .optional(),
    budgetMinInr: z.number().finite().nonnegative().max(1e12).optional(),
    budgetMaxInr: z.number().finite().nonnegative().max(1e12).optional(),
    purpose: z.enum(["self_use", "investment", "both", "unknown"]).optional(),
    timeline: z
      .enum(["immediate", "1_3_months", "3_6_months", "6_12_months", "beyond_12_months", "unknown"])
      .optional(),
    financing: z.enum(["loan", "self_funded", "unknown"]).optional(),
    notes: z.string().max(4000).optional(),
    interestedProjectIds: z.array(z.string().max(64)).max(10).optional(),
    siteVisitRequested: z.boolean().optional(),
    siteVisitPreference: z.string().max(200).optional(),
  })
  .strip();

export const createCallSchema = z.object({
  id: z
    .string()
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  channel: z.enum(["browser", "phone"]).optional(),
  fromNumber: z.string().max(24).optional(),
});

export const updateCallSchema = z
  .object({
    transcript: z.array(transcriptTurnSchema).max(2000).optional(),
    toolCalls: z.array(toolInvocationSchema).max(1000).optional(),
    requirements: leadRequirementsSchema.optional(),
    status: z.enum(["in_progress", "completed", "failed"]).optional(),
    endedAt: z.iso.datetime().optional(),
    durationSec: z.number().int().nonnegative().max(86_400).optional(),
  })
  .strip();

/** Route params — ids are used in SQL, so constrain the charset at the edge. */
export const callIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid call id");

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
