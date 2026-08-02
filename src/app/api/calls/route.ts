import { NextResponse } from "next/server";
import { RULES, checkRateLimit } from "@/lib/rate-limit";
import { createCall, listCalls, storageBackend } from "@/lib/store";
import { createCallSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const calls = await listCalls(200);
    return NextResponse.json({ calls, backend: storageBackend() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), calls: [], backend: storageBackend() },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const limit = await checkRateLimit(req, RULES.writePerIp);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const raw = await req.json().catch(() => ({}));
  const parsed = createCallSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const id = parsed.data.id || `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const call = await createCall({
      id,
      channel: parsed.data.channel ?? "browser",
      fromNumber: parsed.data.fromNumber,
    });
    return NextResponse.json({ call });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
