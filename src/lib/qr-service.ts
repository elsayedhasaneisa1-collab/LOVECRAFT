import { and, eq, ne } from "drizzle-orm";
import { db, sites, templateCategories, templates, botSettings } from "@/db";
import { qrThemes, signQrCard, type QrCardTheme } from "./qr-card-url";

const labels: Record<QrCardTheme, string> = { love: "شكل قلب", events: "شكل هدية", friends: "شكل حلقتين", games: "شكل ذراع تحكم", portfolio: "شكل لوحة ألوان", messages: "شكل ظرف", bot: "شكل نجمة" };

function buildQr(url: string, origin: string, botHandle: string, shape: QrCardTheme) {
  const file = signQrCard({ url, handle: botHandle.replace(/^@/, ""), theme: shape });
  return {
    ok: Boolean(file),
    imageUrl: file ? `${origin}/api/qr/image/${file}` : null,
    pageUrl: url,
    shape,
    shapeLabelAr: labels[shape],
    message: file ? undefined : "تعذر إنشاء رابط بطاقة QR. تأكد من إعداد نطاق الموقع ومفتاح توقيع البطاقات.",
  };
}

export function buildSiteQr(params: { siteUrl: string; botHandle: string; origin: string; categorySlug: string }) {
  const category = params.categorySlug as QrCardTheme;
  return buildQr(params.siteUrl, params.origin, params.botHandle, qrThemes.includes(category) && category !== "bot" ? category : "portfolio");
}

export function buildReferralQr(params: { referralUrl: string; botHandle: string; origin: string }) {
  return buildQr(params.referralUrl, params.origin, params.botHandle, "bot");
}

export async function getSiteQrCategory(slug: string, ownerId: number) {
  const [row] = await db.select({ categorySlug: templateCategories.slug }).from(sites)
    .innerJoin(templates, eq(sites.templateId, templates.id)).innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(and(eq(sites.slug, slug), eq(sites.userId, ownerId), ne(sites.status, "deleted"))).limit(1);
  return row?.categorySlug;
}

export async function getBotHandle(): Promise<string> {
  const [cfg] = await db.select({ name: botSettings.botUsername }).from(botSettings).limit(1);
  return cfg?.name || process.env.TELEGRAM_BOT_USERNAME?.trim() || "LoveCraftMakerBot";
}
