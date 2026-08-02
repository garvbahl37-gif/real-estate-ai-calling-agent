/**
 * Shared domain types for the real-estate voice agent.
 *
 * These are used in three places, so they live in one file:
 *  - the browser voice client (live, in-call state)
 *  - the API routes (persistence + summarisation)
 *  - the dashboard UI (rendering)
 */

export type Language = "hi" | "en" | "hinglish";

export type Intent = "buy" | "invest" | "rent" | "just_browsing" | "not_interested" | "unknown";

export type Purpose = "self_use" | "investment" | "both" | "unknown";

export type Timeline =
  | "immediate" // within 1 month
  | "1_3_months"
  | "3_6_months"
  | "6_12_months"
  | "beyond_12_months"
  | "unknown";

export type PropertyType = "apartment" | "villa" | "plot" | "commercial" | "unknown";

export type Configuration = "1BHK" | "2BHK" | "3BHK" | "3BHK+S" | "4BHK" | "5BHK" | "plot" | "shop" | "office";

/** Everything the agent is trying to qualify during the call. */
export interface LeadRequirements {
  name?: string;
  phone?: string;
  email?: string;
  intent?: Intent;
  preferredLocations?: string[];
  propertyType?: PropertyType;
  configurations?: Configuration[];
  budgetMinInr?: number;
  budgetMaxInr?: number;
  purpose?: Purpose;
  timeline?: Timeline;
  financing?: "loan" | "self_funded" | "unknown";
  notes?: string;
  interestedProjectIds?: string[];
  siteVisitRequested?: boolean;
  siteVisitPreference?: string;
}

export type TranscriptRole = "agent" | "customer" | "system";

export interface TranscriptTurn {
  id: string;
  role: TranscriptRole;
  text: string;
  /** ms since call start */
  at: number;
  /** BCP-47 code detected by the model, when available */
  languageCode?: string;
  /** true while the model is still streaming this turn */
  partial?: boolean;
}

export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  at: number;
}

export type CallChannel = "browser" | "phone";

export type CallStatus = "in_progress" | "completed" | "failed";

export interface CallSummary {
  headline: string;
  summary: string;
  languagesUsed: string[];
  qualification: {
    score: number; // 0-100
    band: "hot" | "warm" | "cold";
    reasoning: string;
  };
  requirements: LeadRequirements;
  objections: string[];
  nextAction: string;
  agentNotes: string;
}

export interface CallRecord {
  id: string;
  channel: CallChannel;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  fromNumber?: string;
  transcript: TranscriptTurn[];
  toolCalls: ToolInvocation[];
  requirements: LeadRequirements;
  summary?: CallSummary;
}

/* ------------------------------------------------------------------ */
/* Project catalogue                                                   */
/* ------------------------------------------------------------------ */

export interface UnitOption {
  configuration: Configuration;
  carpetAreaSqft: number;
  saleableAreaSqft: number;
  priceMinInr: number;
  priceMaxInr: number;
  available: boolean;
}

export interface Project {
  id: string;
  name: string;
  developer: string;
  tagline: string;
  city: string;
  locality: string;
  microMarket: string;
  propertyType: PropertyType;
  status: "under_construction" | "ready_to_move" | "new_launch";
  reraId: string;
  possession: string;
  priceRangeLabel: string;
  priceMinInr: number;
  priceMaxInr: number;
  units: UnitOption[];
  amenities: string[];
  locationAdvantages: { label: string; distance: string }[];
  paymentPlans: string[];
  bookingAmountInr: number;
  usps: string[];
  bestFor: Purpose[];
  /** short, spoken-friendly Hindi/Hinglish blurb the agent can read out */
  pitchHinglish: string;
}
