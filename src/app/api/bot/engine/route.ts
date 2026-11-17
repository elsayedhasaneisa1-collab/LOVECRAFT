import { readStudioActor } from "@/lib/studio-session";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { processBotInteraction } from "@/lib/bot-fsm";
import {
  checkRateLimit,
  constantTimeCompare,
  getClientIp,
  logSecurityEvent,
  verifySameOrigin,
} from "@/lib/security";

const BotInteractSchema = z.object({
  telegramUserId: z.number().int().min(-(2 ** 46)).max(9_999_999_999_999),
  telegramChatId: z.number().int().max(9_999_999_999_999),
  username: z.string().max(64).nullish(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).nullish(),
  actionType: z.enum(["start", "callback", "text", "photo_uploaded"]),
  startPayload: z.string().max(120).nullish(),
  callbackData: z.string().max(120).nullish(),
  textInput: z.string().max(2200).nullish(),
  uploadedAsset: z
    .object({
      assetId: z.number().int().positive(),
      url: z.string().url().max(300),
    })
    .nullish(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bot-engine:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    await logSecurityEvent({
      severity: "medium",
      eventType: "bot_engine_rate_limited",
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: "تم تجاوز الحد المسموح للطلبات في الدقيقة. يرجى الانتظار قليلاً." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // Authenticate either Python aiogram Bot (via X-Bot-Secret) OR same-origin web bot client
  const botSecretHeader = req.headers.get("x-bot-secret");
  const configuredBotSecret = process.env.BOT_API_SECRET?.trim();

  if (botSecretHeader !== null) {
    if (!configuredBotSecret || !constantTimeCompare(botSecretHeader, configuredBotSecret)) {
      await logSecurityEvent({
        severity: "high",
        eventType: "invalid_bot_secret_header",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json({ error: "مصادقة البوت غير صالحة." }, { status: 401 });
    }
  } else if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "طلب غير مصرح به." }, { status: 403 });
  }

  const actor = botSecretHeader === null ? await readStudioActor(req) : null;
  if (botSecretHeader === null && !actor) return NextResponse.json({error:"جلسة الاستوديو مطلوبة."},{status:401});
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "صيغة البيانات غير صالحة." }, { status: 400 });
  }

  if (actor && typeof body === "object" && body !== null) {
    const input = body as Record<string,unknown>;
    if (input.telegramUserId !== undefined && input.telegramUserId !== actor.telegramUserId) return NextResponse.json({error:"لا يمكنك الوصول إلى حساب آخر."},{status:403});
    body = {...input, telegramUserId:actor.telegramUserId,telegramChatId:actor.telegramUserId,firstName:actor.firstName,username:actor.username,lastName:null,startPayload:null};
  }
  const parsed = BotInteractSchema.safeParse(body);
  if (!parsed.success || (!actor && parsed.data.telegramUserId <= 0)) {
    return NextResponse.json({ error: "مدخلات الطلب غير مكتملة أو غير صالحة." }, { status: 400 });
  }

  await ensurePlatformSeeded();

  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${proto}://${host}`;

  const response = await processBotInteraction({
    ...parsed.data,
    baseUrl,
    ipAddress: actor ? ip : undefined,
  });

  return NextResponse.json(response, {headers:{"Cache-Control":"no-store"}});
}
