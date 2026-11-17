import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { constantTimeCompare } from "@/lib/security";
import { claimTelegramDelivery, finishTelegramDelivery, releaseTelegramDelivery } from "@/lib/telegram-delivery";

const id = z.number().int().min(1).max(9_999_999_999_999);
const common = { updateId: id, chatId: id };
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), ...common }),
  z.object({ action: z.literal("finish"), ...common, lease: z.uuid(), messageId: id.max(2_147_483_647) }),
  z.object({ action: z.literal("release"), ...common, lease: z.uuid() }),
]);

export async function POST(req: NextRequest) {
  const secret = process.env.BOT_API_SECRET?.trim();
  const headers = { "Cache-Control": "no-store" };
  if (!secret || !constantTimeCompare(req.headers.get("x-bot-secret") || "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (Number(req.headers.get("content-length") || 0) > 2048) {
    return NextResponse.json({ error: "Request too large" }, { status: 413, headers });
  }
  const action = Action.safeParse(await req.json().catch(() => null));
  if (!action.success) return NextResponse.json({ error: "Invalid delivery request" }, { status: 400, headers });
  const data = action.data;
  if (data.action === "claim") return NextResponse.json(await claimTelegramDelivery(data.updateId, data.chatId), { headers });
  if (data.action === "release") {
    await releaseTelegramDelivery(data);
    return NextResponse.json({ ok: true }, { headers });
  }
  const ok = await finishTelegramDelivery(data, data.messageId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 409, headers });
}
