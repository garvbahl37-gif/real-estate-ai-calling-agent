import { NextResponse } from "next/server";
import { campaignProgress, getCampaign, listContacts, setCampaignStatus } from "@/lib/campaigns/store";
import { requireOpsAuth } from "@/lib/ops-auth";
import type { Campaign } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "No such campaign." }, { status: 404 });
  return NextResponse.json({
    campaign,
    progress: await campaignProgress(id),
    contacts: await listContacts(id),
  });
}

const ALLOWED: Record<string, Campaign["status"]> = {
  start: "running",
  pause: "paused",
};

/** Start and pause only. A campaign's list and limits are fixed once created. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireOpsAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const status = ALLOWED[action ?? ""];
  if (!status) return NextResponse.json({ error: "action must be 'start' or 'pause'." }, { status: 400 });

  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "No such campaign." }, { status: 404 });
  if (campaign.status === "completed") {
    return NextResponse.json({ error: "That campaign has already finished." }, { status: 409 });
  }

  await setCampaignStatus(id, status);
  return NextResponse.json({ campaign: { ...campaign, status } });
}
