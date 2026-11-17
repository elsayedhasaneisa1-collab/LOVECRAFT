import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db, botSettings, siteAssets, systemSettings, users, userSessions } from "@/db";
import { checkUserBanStatus } from "./site-engine";
import { MAX_DRAFT_PHOTOS, MAX_SITE_IMAGE_BYTES } from "./upload-limits";

const accepted = new Map([["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"], ["gif", "image/gif"]]);
export const SITE_MEDIA_NOTICE = "الصور مرتبطة بمواقع قابلة للمشاركة. أي شخص لديه رابط الصورة يمكنه فتحها؛ تجنّب رفع الصور الخاصة.";
export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function prepareSitePhoto(file: Uint8Array, allowed: string[]): Promise<Buffer | null> {
  if (!file.byteLength || file.byteLength > MAX_SITE_IMAGE_BYTES) return null;
  try {
    const input = sharp(file, { limitInputPixels: 18_000_000, failOn: "error", animated: false });
    const { format } = await input.metadata();
    const mime = accepted.get(format ?? "");
    if (!mime || !allowed.includes(mime)) return null;
    // Only the decoded pixels are published. Strip metadata and the animation frames.
    return await input.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 3 }).toBuffer();
  } catch {
    return null;
  }
}

export async function getPhotoOwner(telegramUserId: number) {
  const [row] = await db.select({ userId: users.id, step: userSessions.wizardStep, draft: userSessions.draftPayload })
    .from(users).innerJoin(userSessions, eq(userSessions.userId, users.id))
    .where(and(eq(users.telegramUserId, telegramUserId), gt(userSessions.expiresAt, new Date())))
    .orderBy(desc(userSessions.updatedAt), desc(userSessions.id)).limit(1);
  return row;
}

export type SitePhotoResult =
  | { ok: true; assetId: number; url: string; mimeType: string; fileSizeBytes: number; notice: string }
  | { ok: false; code: string; message: string; status: number };

export async function uploadSitePhoto(telegramUserId: number, file: File): Promise<SitePhotoResult> {
  const err = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });
  if (!file.size) return err(400, "EMPTY_FILE", "الملف المرفق فارغ.");
  if (file.size > MAX_SITE_IMAGE_BYTES) return err(413, "FILE_TOO_LARGE", "الحد الأقصى للصورة 4 ميجابايت.");

  const [owner, [bot], [settings]] = await Promise.all([
    getPhotoOwner(telegramUserId),
    db.select({ uploadsEnabled: botSettings.catboxUploadsEnabled }).from(botSettings).limit(1),
    db.select({ allowed: systemSettings.allowedImageMimes, maxMb: systemSettings.maxUploadMb }).from(systemSettings).limit(1),
  ]);
  if (bot?.uploadsEnabled === false) return err(403, "UPLOADS_DISABLED", "رفع الصور متوقف من إعدادات المنصة.");
  if (!owner || owner.step !== "photos" || !owner.draft.templateSlug) return err(409, "PHOTO_STEP_REQUIRED", "افتح خطوة إضافة الصور أولًا.");
  if (await checkUserBanStatus(owner.userId).then((ban) => ban.isBanned)) return err(403, "BANNED", "لا يمكن رفع الصور أثناء حظر الحساب.");
  if (Array.isArray(owner.draft.assetIds) && owner.draft.assetIds.length >= MAX_DRAFT_PHOTOS) return err(409, "PHOTO_LIMIT", "وصلت للحد الأقصى للصور في هذا الموقع.");
  const maxMb = Math.min(settings?.maxMb ?? 4, 4);
  if (file.size > maxMb * 1024 * 1024) return err(413, "FILE_TOO_LARGE", `الحد الأقصى للصورة ${maxMb} ميجابايت.`);
  const image = await prepareSitePhoto(new Uint8Array(await file.arrayBuffer()), settings?.allowed ?? Array.from(accepted.values()));
  if (!image) return err(400, "INVALID_IMAGE", "تعذر قراءة الصورة. أرسل صورة JPG أو PNG أو WebP أو GIF سليمة.");
  if (!hasBlobStorage()) return err(503, "STORAGE_NOT_CONFIGURED", "Vercel Blob غير متصل بالمشروع. يمكنك المتابعة بدون صور.");
  if (image.byteLength > MAX_SITE_IMAGE_BYTES) return err(413, "FILE_TOO_LARGE", "الصورة كبيرة بعد المعالجة. جرّب صورة أصغر.");

  let url: string;
  try {
    const result = await put(`site-media/${randomUUID()}.webp`, image, {
      access: "public", contentType: "image/webp", addRandomSuffix: false, abortSignal: AbortSignal.timeout(12_000),
    });
    url = result.url;
  } catch {
    return err(502, "STORAGE_UNAVAILABLE", "تعذر رفع الصورة إلى Vercel Blob. جرّب مجددًا أو تابع بدونها.");
  }
  try {
    const [saved] = await db.insert(siteAssets).values({
      userId: owner.userId, catboxUrl: url, provider: "vercel-blob", mimeType: "image/webp",
      fileSizeBytes: image.byteLength, assetRole: "gallery",
    }).returning({ id: siteAssets.id });
    return { ok: true, assetId: saved.id, url, mimeType: "image/webp", fileSizeBytes: image.byteLength, notice: SITE_MEDIA_NOTICE };
  } catch {
    await del(url, { abortSignal: AbortSignal.timeout(4000) }).catch(() => null);
    return err(503, "PHOTO_NOT_SAVED", "تعذر حفظ رابط الصورة. أعد المحاولة.");
  }
}

export async function attachablePhoto(userId: number, assetId: number) {
  const [photo] = await db.select({ id: siteAssets.id }).from(siteAssets).where(and(
    eq(siteAssets.id, assetId), eq(siteAssets.userId, userId), isNull(siteAssets.siteId), ne(siteAssets.provider, "vercel-blob-deleting"),
  )).limit(1);
  return Boolean(photo);
}
