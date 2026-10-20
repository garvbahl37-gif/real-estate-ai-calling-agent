import { formatInr, getProject } from "./projects";
import type { LeadRequirements } from "./types";

/**
 * The lead record as the UI shows it: one labelled row per thing Priya can
 * learn on a call. Shared by the live panel and the CRM pages so "6/14 fields
 * captured" means the same fourteen fields everywhere.
 */

const TIMELINE_LABEL: Record<string, string> = {
  immediate: "Immediately",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  beyond_12_months: "12 months +",
  unknown: "Not established",
};

const INTENT_LABEL: Record<string, string> = {
  buy: "Buying",
  invest: "Investing",
  rent: "Renting",
  just_browsing: "Browsing",
  not_interested: "Not interested",
  unknown: "Not established",
};

const PURPOSE_LABEL: Record<string, string> = {
  self_use: "Self-use",
  investment: "Investment",
  both: "Self-use + investment",
  unknown: "Not established",
};

export function budgetLabel(req: LeadRequirements): string | undefined {
  const { budgetMinInr: lo, budgetMaxInr: hi } = req;
  if (lo == null && hi == null) return undefined;
  if (lo != null && hi != null) return lo === hi ? formatInr(lo) : `${formatInr(lo)} – ${formatInr(hi)}`;
  return lo != null ? `${formatInr(lo)} +` : `Up to ${formatInr(hi!)}`;
}

export interface LeadField {
  key: string;
  label: string;
  value?: string;
}

export function leadFields(req: LeadRequirements): LeadField[] {
  return [
    { key: "name", label: "Name", value: req.name },
    { key: "phone", label: "Phone", value: req.phone },
    { key: "email", label: "Email", value: req.email },
    { key: "intent", label: "Intent", value: req.intent ? INTENT_LABEL[req.intent] : undefined },
    { key: "locations", label: "Location", value: req.preferredLocations?.join(", ") || undefined },
    {
      key: "type",
      label: "Property type",
      value: req.propertyType && req.propertyType !== "unknown" ? req.propertyType : undefined,
    },
    { key: "config", label: "Configuration", value: req.configurations?.join(", ") || undefined },
    { key: "budget", label: "Budget", value: budgetLabel(req) },
    { key: "purpose", label: "Purpose", value: req.purpose ? PURPOSE_LABEL[req.purpose] : undefined },
    { key: "timeline", label: "Timeline", value: req.timeline ? TIMELINE_LABEL[req.timeline] : undefined },
    {
      key: "financing",
      label: "Financing",
      value: req.financing === "loan" ? "Home loan" : req.financing === "self_funded" ? "Self-funded" : undefined,
    },
    {
      key: "project",
      label: "Matched project",
      value: req.interestedProjectIds?.map((id) => getProject(id)?.name ?? id).join(", ") || undefined,
    },
    {
      key: "visit",
      label: "Site visit",
      value: req.siteVisitRequested ? req.siteVisitPreference || "Requested" : undefined,
    },
    { key: "callback", label: "Call back", value: req.callbackPreference },
  ];
}

export function captureProgress(req: LeadRequirements): { filled: number; total: number } {
  const fields = leadFields(req);
  return { filled: fields.filter((f) => f.value).length, total: fields.length };
}
