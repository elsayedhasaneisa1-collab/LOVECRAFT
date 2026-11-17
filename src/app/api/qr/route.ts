import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, sites, templateCategories, templates } from "@/db";
import { buildReferralQr, buildSiteQr, getBotHandle } from "@/lib/qr-service";
import {
  checkRateLimit,
  constantTimeCompare,
  getClientIp,
  logSecurityEvent,
  verifySameOrigin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

const BodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("site"), slug: z.string().min(3).max(80) }),
  z.object({ mode: z.literal("referral") }),
]);

/**
 * Generates a branded QR card.
 * - The bot calls this through the secured engine (X-Bot-Secret).
 * - The web studio calls it from the same origin with its own session.
 * Cards are cached on disk, so repeat requests cost nothing.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`qr:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "طلبات كثيرة جدًا. يرجى الانتظار قليلًا." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const botSecret = process.env.BOT_API_SECRET?.trim();
  const header = req.headers.get("x-bot-secret");
  if (header !== null) {
    if (!botSecret || !constantTimeCompare(header, botSecret)) {
      await logSecurityEvent({
        severity: "high",
        eventType: "invalid_bot_secret_qr",
        ipAddress: ip,
      });
      return NextResponse.json({ ok: false, error: "غير مصرح." }, { status: 401 });
    }
  } else if (!verifySameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "مصدر الطلب غير مصرح." }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "طلب غير صالح." }, { status: 400 });
  }

  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${proto}://${host}`;
  const handle = await getBotHandle();

  if (parsed.data.mode === "referral") {
    const referralUrl = `https://t.me/${handle}?start=WEB${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const qr = await buildReferralQr({ referralUrl, botHandle: `@${handle}`, origin });
    return NextResponse.json(qr, { status: qr.ok ? 200 : 500 });
  }

  const rows = await db
    .select({ slug: sites.slug, title: sites.title })
    .from(sites)
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(and(eq(sites.slug, parsed.data.slug), ne(sites.status, "deleted")))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ ok: false, error: "الموقع غير موجود." }, { status: 404 });
  }

  const qr = await buildSiteQr({
    slug: rows[0].slug,
    siteUrl: `${origin}/s/${rows[0].slug}`,
    botHandle: `@${handle}`,
    origin,
  });
  return NextResponse.json(qr, { status: qr.ok ? 200 : 500 });
}
