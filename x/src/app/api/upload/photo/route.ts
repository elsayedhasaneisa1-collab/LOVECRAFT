import { NextRequest, NextResponse } from "next/server";
import { readStudioActor } from "@/lib/studio-session";
import { uploadSitePhoto } from "@/lib/site-media";
import { checkRateLimit, constantTimeCompare, getClientIp, verifySameOrigin } from "@/lib/security";
import { MAX_SITE_UPLOAD_REQUEST_BYTES } from "@/lib/upload-limits";
import { readTelegramDelivery } from "@/lib/telegram-delivery";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const errors = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const header = req.headers.get("x-bot-secret");
  const botSecret = process.env.BOT_API_SECRET?.trim();
  const telegram = header !== null;
  if (telegram && (!botSecret || !constantTimeCompare(header, botSecret))) return errors(401, "غير مصرح.");
  if (!telegram && !verifySameOrigin(req)) return errors(403, "مصدر الطلب غير مصرح.");
  if (!checkRateLimit(`photo:${getClientIp(req)}`, 25, 60_000).allowed) return errors(429, "طلبات رفع كثيرة. انتظر قليلًا.");
  if (Number(req.headers.get("content-length") || 0) > MAX_SITE_UPLOAD_REQUEST_BYTES) return errors(413, "الحد الأقصى للصورة 4 ميجابايت.");
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data;")) return errors(415, "أرسل الصورة بصيغة ملف.");

  const actor = telegram ? null : await readStudioActor(req);
  if (!telegram && !actor) return errors(401, "جلسة الاستوديو مطلوبة.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return errors(400, "أرفق صورة سليمة.");
  const identity = actor?.telegramUserId ?? Number(form?.get("telegramUserId"));
  if (telegram) {
    const updateId = Number(form?.get("updateId"));
    const lease = form?.get("lease");
    if (!Number.isSafeInteger(identity) || identity < 1 || !Number.isSafeInteger(updateId) || updateId < 1 ||
      typeof lease !== "string" || !/^[a-f0-9-]{36}$/.test(lease) ||
      !await readTelegramDelivery({ updateId, chatId: identity, lease })) return errors(403, "جلسة الرفع غير صالحة.");
  }
  if (!checkRateLimit(`photo-user:${identity}`, 12, 60_000).allowed) return errors(429, "طلبات رفع كثيرة. انتظر قليلًا.");
  const result = await uploadSitePhoto(identity, file);
  if (!result.ok) return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
