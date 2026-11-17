import { db, systemSettings, botSettings, siteAssets } from "@/db";

export interface CatboxUploadResult {
  ok: true;
  assetId: number;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
  notice: string;
}

export interface CatboxUploadError {
  ok: false;
  code: string;
  message: string;
}

/**
 * Inspect binary magic bytes to verify genuine image format (prevents spoofed MIME / SVG XSS / polyglots)
 */
export function detectImageMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF: GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadImageToCatbox(params: {
  userId: number;
  siteId?: number | null;
  fileBytes: Uint8Array;
  declaredMime?: string;
  assetRole?: string;
  caption?: string;
}): Promise<CatboxUploadResult | CatboxUploadError> {
  const [botCfg] = await db.select().from(botSettings).limit(1);
  if (botCfg && !botCfg.catboxUploadsEnabled) {
    return {
      ok: false,
      code: "UPLOADS_DISABLED",
      message: "رفع الصور متوقف مؤقتاً من إعدادات المنصة.",
    };
  }

  const [sysCfg] = await db.select().from(systemSettings).limit(1);
  const maxMb = Math.min(10, Math.max(1, sysCfg?.maxUploadMb ?? 8));
  const maxBytes = maxMb * 1024 * 1024;
  const allowedMimes = sysCfg?.allowedImageMimes ?? [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const endpoint = sysCfg?.catboxEndpoint || "https://catbox.moe/user/api.php";

  if (params.fileBytes.byteLength === 0) {
    return { ok: false, code: "EMPTY_FILE", message: "الملف المرفق فارغ." };
  }
  if (params.fileBytes.byteLength > maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `حجم الصورة يتجاوز الحد الأقصى المسموح (${maxMb} ميجابايت).`,
    };
  }

  const verifiedMime = detectImageMimeFromBytes(params.fileBytes);
  if (!verifiedMime || !allowedMimes.includes(verifiedMime)) {
    return {
      ok: false,
      code: "INVALID_IMAGE_TYPE",
      message: "صيغة الملف غير مدعومة. يُسمح فقط بصور JPG وPNG وWebP وGIF الحقيقية.",
    };
  }

  const ext = MIME_TO_EXT[verifiedMime] ?? "jpg";
  const form = new FormData();
  form.append("reqtype", "fileupload");

  const userhash = process.env.CATBOX_USERHASH?.trim();
  if (userhash) {
    form.append("userhash", userhash);
  }

  const safeCopy = new Uint8Array(params.fileBytes.byteLength);
  safeCopy.set(params.fileBytes);
  const blob = new Blob([safeCopy], { type: verifiedMime });
  form.append("fileToUpload", blob, `lovecraft-asset.${ext}`);

  let uploadedUrl = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(endpoint, {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: {
        "User-Agent": "LOVECRAFT-BOT/1.0",
      },
    });
    clearTimeout(timeout);

    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith("https://files.catbox.moe/")) {
      return {
        ok: false,
        code: "CATBOX_UPSTREAM_ERROR",
        message:
          "تعذر رفع الصورة إلى خدمة الاستضافة الخارجية (Catbox) حالياً. يمكنك إعادة المحاولة أو المتابعة بالصور الجاهزة للقالب.",
      };
    }
    uploadedUrl = text;
  } catch {
    return {
      ok: false,
      code: "CATBOX_NETWORK_FAILURE",
      message:
        "فشل الاتصال بخدمة Catbox لاستضافة الصور. لم يتم فقدان بياناتك — يمكنك المحاولة مجدداً أو إكمال الإنشاء بدون هذه الصورة.",
    };
  }

  // Persist ONLY the Catbox URL and light metadata — ZERO binary stored in PostgreSQL
  const [saved] = await db
    .insert(siteAssets)
    .values({
      siteId: params.siteId ?? null,
      userId: params.userId,
      catboxUrl: uploadedUrl,
      provider: "catbox",
      assetRole: params.assetRole || "gallery",
      caption: params.caption ? params.caption.slice(0, 200) : null,
      mimeType: verifiedMime,
      fileSizeBytes: params.fileBytes.byteLength,
      sortOrder: 0,
    })
    .returning({ id: siteAssets.id });

  return {
    ok: true,
    assetId: saved!.id,
    url: uploadedUrl,
    mimeType: verifiedMime,
    fileSizeBytes: params.fileBytes.byteLength,
    notice:
      "تم رفع الصورة عبر Catbox كرابط عام. تنبيه: خدمة Catbox خارجية ولا تضمن الخصوصية التامة أو بقاء الملفات للأبد، لذا تجنب رفع صور حساسة.",
  };
}
