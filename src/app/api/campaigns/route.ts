import { NextResponse } from "next/server";
import { parseContactCsv } from "@/lib/campaigns/contacts";
import { addContacts, campaignProgress, createCampaign, listCampaigns } from "@/lib/campaigns/store";
import { DEFAULT_WINDOW } from "@/lib/campaigns/window";
import { callingEnabled, requireOpsAuth } from "@/lib/ops-auth";
import { RULES, checkRateLimit } from "@/lib/rate-limit";
import type { Campaign } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Listing is open — it is the ops dashboard's data source and exposes nothing
 * that can dial anyone. Creating is not.
 */
export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const withProgress = await Promise.all(
      campaigns.map(async (c) => ({ ...c, progress: await campaignProgress(c.id) })),
    );
    return NextResponse.json({ campaigns: withProgress, callingEnabled: callingEnabled() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

export async function POST(req: Request) {
  const auth = requireOpsAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = await checkRateLimit(req, RULES.writePerIp);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    csv?: string;
    maxConcurrent?: number;
    maxAttempts?: number;
    callWindowStartHour?: number;
    callWindowEndHour?: number;
    suppressed?: string[];
  };

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A campaign needs a name." }, { status: 400 });
  if (!body.csv?.trim()) return NextResponse.json({ error: "No contact list was uploaded." }, { status: 400 });

  const parsed = parseContactCsv(body.csv, new Set(body.suppressed ?? []));
  if (!parsed.contacts.length) {
    return NextResponse.json(
      { error: "No dialable numbers in that list.", rejected: parsed.rejected },
      { status: 400 },
    );
  }

  // The window can be narrowed but never widened past what TRAI permits — a
  // campaign is not allowed to configure its way out of the regulation.
  const startHour = Math.max(DEFAULT_WINDOW.startHour, clamp(body.callWindowStartHour, 0, 23, DEFAULT_WINDOW.startHour));
  const endHour = Math.min(DEFAULT_WINDOW.endHour, clamp(body.callWindowEndHour, 1, 24, DEFAULT_WINDOW.endHour));
  if (endHour <= startHour) {
    return NextResponse.json({ error: "The calling window closes before it opens." }, { status: 400 });
  }

  const id = `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const campaign: Campaign = {
    id,
    name,
    profileId: "default",
    // Starts paused. Uploading a list is not the same as consenting to dial it.
    status: "draft",
    createdAt: new Date().toISOString(),
    maxConcurrent: clamp(body.maxConcurrent, 1, 10, 2),
    maxAttempts: clamp(body.maxAttempts, 1, 5, 3),
    callWindowStartHour: startHour,
    callWindowEndHour: endHour,
  };

  try {
    await createCampaign(campaign);
    const added = await addContacts(id, parsed.contacts, (i) => `${id}_c${i}`);
    return NextResponse.json({
      campaign,
      added,
      duplicates: parsed.duplicates,
      rejected: parsed.rejected,
      callingEnabled: callingEnabled(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
