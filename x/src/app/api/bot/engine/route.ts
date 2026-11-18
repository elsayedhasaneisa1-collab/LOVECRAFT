import { readStudioActor } from "@/lib/studio-session";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { processBotInteraction } from "@/lib/bot-fsm";
import { checkRateLimit, constantTimeCompare, getClientIp, verifySameOrigin } from "@/lib/security";
import { processTelegramDelivery } from "@/lib/telegram-delivery";
import { websiteOrigin } from "@/lib/deployment-origin";

export const maxDuration = 30;

const BotInteractSchema = z.object({
  telegramUserId: z.number().int().min(-(2 ** 46)).max(9_999_999_999_999),
  telegramChatId: z.number().int().max(9_999_999_999_999),
  username: z.string().max(64).nullish(), firstName: z.string().min(1).max(100), lastName: z.string().max(100).nullish(),
  actionType: z.enum(["start", "callback", "text", "photo_uploaded", "photo_error"]),
  startPayload: z.string().max(120).nullish(), callbackData: z.string().max(120).nullish(), textInput: z.string().max(2200).nullish(),
  uploadedAsset: z.object({ assetId: z.number().int().positive(), url: z.string().url().max(300) }).nullish(),
  photoError: z.enum(["size", "storage", "file"]).optional(),
  delivery: z.object({ updateId: z.number().int().positive().max(9_999_999_999_999), lease: z.uuid() }).optional(),
});

export async function POST(req: NextRequest) {
  const json = (body: unknown, status = 200, retryAfter?: number) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
  const ip = getClientIp(req);
  const header = req.headers.get("x-bot-secret");
  const suppliedByBot = header !== null;
  const secret = process.env.BOT_API_SECRET?.trim();
  if (suppliedByBot && (!secret || !constantTimeCompare(header, secret))) return json({ error: "مصادقة البوت غير صالحة." }, 401);
  if (!suppliedByBot && !verifySameOrigin(req)) return json({ error: "طلب غير مصرح به." }, 403);
  const rl = checkRateLimit(`bot-engine:${suppliedByBot ? "worker" : ip}`, suppliedByBot ? 800 : 60, 60_000);
  if (!rl.allowed) return json({ error: "تم تجاوز الحد المسموح للطلبات في الدقيقة." }, 429, rl.retryAfterSec);
  if (Number(req.headers.get("content-length") || 0) > 32768) return json({ error: "الطلب أكبر من الحد المسموح." }, 413);
  const actor = suppliedByBot ? null : await readStudioActor(req);
  if (!suppliedByBot && !actor) return json({ error: "جلسة الاستوديو مطلوبة." }, 401);

  let body: unknown = await req.json().catch(() => null);
  if (actor && body && typeof body === "object") {
    const input = body as Record<string, unknown>;
    if (input.telegramUserId !== undefined && input.telegramUserId !== actor.telegramUserId) return json({ error: "لا يمكنك الوصول إلى حساب آخر." }, 403);
    body = { ...input, telegramUserId: actor.telegramUserId, telegramChatId: actor.telegramUserId, firstName: actor.firstName,
      username: actor.username, lastName: null, startPayload: null, delivery: undefined, photoError: undefined };
  }
  const parsed = BotInteractSchema.safeParse(body);
  if (!parsed.success) return json({ error: "مدخلات الطلب غير صالحة." }, 400);
  const { delivery, ...interaction } = parsed.data;
  if (suppliedByBot && (!delivery || interaction.telegramUserId <= 0 || interaction.telegramUserId !== interaction.telegramChatId)) {
    return json({ error: "جلسة تسليم Telegram مطلوبة." }, 403);
  }
  if (!suppliedByBot && interaction.actionType === "photo_error") return json({ error: "طلب غير صالح." }, 400);
  if (suppliedByBot && !checkRateLimit(`telegram-user:${interaction.telegramUserId}`, 75, 60_000).allowed) {
    return json({ error: "طلبات كثيرة لهذا الحساب." }, 429, 60);
  }

  await ensurePlatformSeeded();
  const handle = () => processBotInteraction({ ...interaction, baseUrl: websiteOrigin(req), ipAddress: actor ? ip : undefined });
  const view = delivery ? await processTelegramDelivery({ ...delivery, chatId: interaction.telegramChatId }, handle) : await handle();
  if (!view) return json({ error: "انتهت جلسة تسليم Telegram." }, 409);
  return json(view);
}
