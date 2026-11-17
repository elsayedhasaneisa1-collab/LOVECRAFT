import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSiteQr, getBotHandle, getSiteQrCategory } from "@/lib/qr-service";
import { readStudioActor } from "@/lib/studio-session";
import { checkRateLimit, getClientIp, verifySameOrigin } from "@/lib/security";
import { websiteOrigin } from "@/lib/deployment-origin";
import { checkUserBanStatus } from "@/lib/site-engine";

const Body = z.object({ mode: z.literal("site"), slug: z.string().regex(/^[a-z0-9-]{3,80}$/) });

export async function POST(req: NextRequest) {
  const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!verifySameOrigin(req)) return json({ ok: false, error: "مصدر الطلب غير مصرح." }, 403);
  if (!checkRateLimit(`qr:${getClientIp(req)}`, 20, 60_000).allowed) return json({ ok: false, error: "طلبات QR كثيرة. انتظر قليلًا." }, 429);
  const actor = await readStudioActor(req);
  if (!actor) return json({ ok: false, error: "جلسة الاستوديو مطلوبة." }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "طلب غير صالح." }, 400);
  if ((await checkUserBanStatus(actor.id)).isBanned) return json({ ok: false, error: "الحساب موقوف." }, 403);
  const { slug } = parsed.data;
  const categorySlug = await getSiteQrCategory(slug, actor.id);
  if (!categorySlug) return json({ ok: false, error: "الموقع غير موجود." }, 404);
  const origin = websiteOrigin(req);
  const card = buildSiteQr({ siteUrl: `${origin}/s/${slug}`, origin, botHandle: await getBotHandle(), categorySlug });
  return json(card, card.ok ? 200 : 503);
}
