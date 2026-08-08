import { NextResponse } from "next/server";
import { settleContactByCallId } from "@/lib/campaigns/store";
import { isOperator, requireOpsAuth } from "@/lib/ops-auth";
import { RULES, checkRateLimit } from "@/lib/rate-limit";
import { redactCall } from "@/lib/redact";
import { deleteCall, getCall, updateCall } from "@/lib/store";
import { callIdSchema, formatZodError, updateCallSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function readId(ctx: Ctx) {
  const { id } = await ctx.params;
  return callIdSchema.safeParse(id);
}

export async function GET(req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const call = await getCall(id.data);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  return NextResponse.json({ call: isOperator(req) ? call : redactCall(call) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const limit = await checkRateLimit(req, RULES.writePerIp);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const parsed = updateCallSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const { twilioCallSid, ...patch } = parsed.data;

  try {
    const call = await updateCall(id.data, patch);
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    // Closing the loop for a campaign dial. The dispatcher knows the contact by
    // Twilio's call SID; the bridge is what knows the call has ended. A contact
    // is only completed here — when the call is over — rather than when it was
    // placed, so a number that rang out is not counted as a contact made.
    if (twilioCallSid && patch.status === "completed") {
      await settleContactByCallId(twilioCallSid, "completed").catch(() => {});
    }
    return NextResponse.json({ call });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  // Destructive and used by nothing in the app. Closed by default rather than
  // left open on the reasoning that no one will find it.
  const limit = await checkRateLimit(req, RULES.opsPerIp);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const auth = requireOpsAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });
  const ok = await deleteCall(id.data);
  return NextResponse.json({ ok });
}
