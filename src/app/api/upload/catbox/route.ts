import { readStudioActor } from "@/lib/studio-session";
import { NextRequest, NextResponse } from "next/server";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { uploadImageToCatbox } from "@/lib/catbox";
import { registerOrTouchTelegramUser } from "@/lib/site-engine";
import {
  checkRateLimit,
  constantTimeCompare,
  getClientIp,
  logSecurityEvent,
  verifySameOrigin,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`catbox-upload:${ip}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "تم تجاوز حد رفع الصور في الدقيقة. يرجى الانتظار." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const botSecretHeader = req.headers.get("x-bot-secret");
  const configuredBotSecret = process.env.BOT_API_SECRET?.trim();
  if (botSecretHeader !== null) {
    if (!configuredBotSecret || !constantTimeCompare(botSecretHeader, configuredBotSecret)) {
      await logSecurityEvent({
        severity: "high",
        eventType: "invalid_bot_secret_upload",
        ipAddress: ip,
      });
      return NextResponse.json({ ok: false, error: "غير مصرح." }, { status: 401 });
    }
  } else if (!verifySameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "مصدر الطلب غير مصرح." }, { status: 403 });
  }

  const actor = botSecretHeader === null ? await readStudioActor(req) : null;
  if (botSecretHeader === null && !actor) return NextResponse.json({ok:false,error:"جلسة الاستوديو مطلوبة."},{status:401});
  if (Number(req.headers.get('content-length')||0)>11*1024*1024) return NextResponse.json({ok:false,error:"الصورة أكبر من الحد المسموح."},{status:413});
  await ensurePlatformSeeded();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "تعذر قراءة ملف الصورة المرفوع." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (actor && Number(form.get("telegramUserId")) !== actor.telegramUserId) return NextResponse.json({ok:false,error:"هوية غير مطابقة للجلسة."},{status:403});
  const telegramUserId = actor?.telegramUserId ?? Number(form.get("telegramUserId"));
  const telegramChatId = actor?.telegramUserId ?? Number(form.get("telegramChatId") || telegramUserId);
  const firstName = actor?.firstName ?? String(form.get("firstName") || "مستخدم").slice(0, 80);

  if (!Number.isInteger(telegramUserId) || (!actor && telegramUserId <= 0)) {
    return NextResponse.json({ ok: false, error: "معرّف المستخدم غير صالح." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "يرجى إرفاق ملف صورة صالح." }, { status: 400 });
  }

  const reg = await registerOrTouchTelegramUser({
    telegramUserId,
    telegramChatId,
    firstName,
    ipAddress: ip,
  });

  if (reg.ban.isBanned) {
    return NextResponse.json(
      { ok: false, error: "لا يمكن رفع الصور أثناء حظر الحساب." },
      { status: 403 }
    );
  }

  if(file.size>10*1024*1024) return NextResponse.json({ok:false,error:"تجاوز الملف الحد الأقصى للحجم."},{status:413});
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const uploaded = await uploadImageToCatbox({
    userId: reg.user.id,
    fileBytes: bytes,
    declaredMime: file.type,
    assetRole: "gallery",
  });

  if (!uploaded.ok) {
    const status =
      uploaded.code === "INVALID_IMAGE_TYPE" ||
      uploaded.code === "EMPTY_FILE" ||
      uploaded.code === "FILE_TOO_LARGE"
        ? 400
        : 502;
    return NextResponse.json(
      { ok: false, code: uploaded.code, error: uploaded.message },
      { status }
    );
  }

  return NextResponse.json(uploaded);
}
