import type { ActionResult } from "./actions/types";
/**
 * Shared domain types for the real-estate voice agent.
 *
 * These are used in three places, so they live in one file:
 *  - the browser voice client (live, in-call state)
 *  - the API routes (persistence + summarisation)
 *  - the dashboard UI (rendering)
 */

export type Language = "hi" | "en" | "hinglish";

/**
 * Which language a call opens in.
 *
 * Deliberately separate from `Language`, which labels what was *detected* in a
 * transcript turn. This is a request, not an observation, and the two were
 * drifting apart in the spellings they used ("hi" vs "hindi") until a profile
 * had to feed one into the other.
 */
export type OpeningLanguage = "hindi" | "hinglish" | "english";

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
  /** Measured during the call. */
  telemetry?: CallTelemetry;
  /** Written after the call, by verifying her claims against the catalogue. */
  groundedness?: GroundednessReport;
  /** How the caller's engagement moved over the call. */
  sentiment?: SentimentTrajectory;
  /** Set when the caller asked for a human. */
  handoff?: HandoffRequest;
  /** What was delivered downstream after the call ended. */
  actions?: ActionResult[];
  /** Which agent profile handled the call. */
  profileId?: string;
  /** Set when the call came from a campaign. */
  campaignId?: string;
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

/* ------------------------------------------------------------------ */
/* Telemetry                                                           */
/* ------------------------------------------------------------------ */

/**
 * What a voice call is actually judged on, measured rather than felt.
 *
 * Time-to-first-audio is the number a caller experiences as "is she slow?" —
 * everything else is context for explaining it. Barge-ins and reconnects are
 * here because both were the cause of regressions that took a long time to
 * find by ear.
 */
export interface TurnMetric {
  /** ms from the caller's turn ending to the first byte of her audio. */
  timeToFirstAudioMs: number;
  /** ms of audio she produced for this turn. */
  spokenMs: number;
  at: number;
}

export interface ToolMetric {
  name: string;
  durationMs: number;
  at: number;
}

export interface CallTelemetry {
  turns: TurnMetric[];
  tools: ToolMetric[];
  bargeIns: number;
  reconnects: number;
  /** Populated from the Live API's usageMetadata when it arrives. */
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
  /** Set once the call ends; derived, not measured. */
  medianTtfaMs?: number;
  p95TtfaMs?: number;
  estimatedCostUsd?: number;
}

/* ------------------------------------------------------------------ */
/* Groundedness                                                        */
/* ------------------------------------------------------------------ */

export type ClaimVerdict = "grounded" | "unsupported" | "contradicted" | "unverifiable";

/**
 * One factual assertion the agent made, checked against the catalogue.
 *
 * A wrong possession date is a RERA liability, not a cosmetic error, so claims
 * are extracted and verified rather than trusted.
 */
export interface FactClaim {
  /** Her words, quoted. */
  quote: string;
  /** What is being asserted, normalised. */
  claim: string;
  kind: "price" | "possession" | "distance" | "amenity" | "rera" | "availability" | "other";
  projectId?: string;
  verdict: ClaimVerdict;
  /** The catalogue value it was checked against, when there is one. */
  evidence?: string;
  note?: string;
}

export interface GroundednessReport {
  claims: FactClaim[];
  grounded: number;
  unsupported: number;
  contradicted: number;
  /** 0–100. 100 means every checkable claim matched the catalogue. */
  score: number;
  checkedAt: string;
}

/* ------------------------------------------------------------------ */
/* Sentiment                                                           */
/* ------------------------------------------------------------------ */

export type SentimentLabel = "engaged" | "neutral" | "hesitant" | "annoyed" | "disengaged";

export interface SentimentPoint {
  /** Index into the transcript this reading covers. */
  turnIndex: number;
  label: SentimentLabel;
  /** −1 (cold) … +1 (warm). */
  score: number;
}

export interface SentimentTrajectory {
  points: SentimentPoint[];
  /** Positive means the caller warmed over the call. */
  drift: number;
  opening: SentimentLabel;
  closing: SentimentLabel;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Human handoff                                                       */
/* ------------------------------------------------------------------ */

export interface HandoffRequest {
  requestedAt: number;
  reason: string;
  urgency: "now" | "callback";
  /** Set once a human picks it up. */
  acceptedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Agent profiles — one deployment, many developers                    */
/* ------------------------------------------------------------------ */

export interface AgentProfile {
  id: string;
  agentName: string;
  companyName: string;
  /** Markets this agent may claim to operate in. */
  markets: string[];
  voice: string;
  defaultLanguage: OpeningLanguage;
  /** Project ids from the catalogue this profile is allowed to sell. */
  projectIds: string[];
  /** Free text appended to the system instruction. */
  personaNote?: string;
}

/* ------------------------------------------------------------------ */
/* Outbound campaigns                                                  */
/* ------------------------------------------------------------------ */

export type ContactStatus = "queued" | "calling" | "completed" | "failed" | "no_answer" | "suppressed";

export interface CampaignContact {
  id: string;
  campaignId: string;
  name?: string;
  phone: string;
  status: ContactStatus;
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  callId?: string;
  failureReason?: string;
}

export interface Campaign {
  id: string;
  name: string;
  profileId: string;
  status: "draft" | "running" | "paused" | "completed";
  createdAt: string;
  /** Concurrency ceiling — telephony providers rate-limit hard. */
  maxConcurrent: number;
  maxAttempts: number;
  /** Local calling window, inclusive of start, exclusive of end. */
  callWindowStartHour: number;
  callWindowEndHour: number;
}
