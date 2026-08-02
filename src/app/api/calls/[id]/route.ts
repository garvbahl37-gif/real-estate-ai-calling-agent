import { NextResponse } from "next/server";
import { RULES, checkRateLimit } from "@/lib/rate-limit";
import { deleteCall, getCall, updateCall } from "@/lib/store";
import { callIdSchema, formatZodError, updateCallSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function readId(ctx: Ctx) {
  const { id } = await ctx.params;
  return callIdSchema.safeParse(id);
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const call = await getCall(id.data);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  return NextResponse.json({ call });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const limit = await checkRateLimit(req, RULES.writePerIp);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const parsed = updateCallSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  try {
    const call = await updateCall(id.data, parsed.data);
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    return NextResponse.json({ call });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await readId(ctx);
  if (!id.success) return NextResponse.json({ error: "Invalid call id" }, { status: 400 });
  const ok = await deleteCall(id.data);
  return NextResponse.json({ ok });
}
