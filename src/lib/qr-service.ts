import { and, eq, ne } from "drizzle-orm";
import { db, sites, templateCategories, templates, botSettings } from "@/db";
import { qrCacheDir, renderQrArtifact, themeForCategory, type QrShapeKey } from "./qr-studio";
import { publishFileToGithub } from "./github-publish";

const OUTPUT_DIR = qrCacheDir();

export interface QrResult {
  ok: boolean;
  imageUrl: string | null;
  pageUrl: string;
  shape: QrShapeKey;
  shapeLabelAr: string;
  siteTitle: string;
  githubUrl: string | null;
  cached: boolean;
  message?: string;
}

/**
 * Builds the branded QR card for a published site.
 * The card is cached on disk, so repeated requests never re-encode or re-rasterise.
 */
export async function buildSiteQr(params: {
  slug: string;
  siteUrl: string;
  botHandle: string;
  origin: string;
}): Promise<QrResult> {
  const rows = await db
    .select({
      siteId: sites.id,
      title: sites.title,
      slug: sites.slug,
      categorySlug: templateCategories.slug,
      templateName: templates.nameAr,
    })
    .from(sites)
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(and(eq(sites.slug, params.slug), ne(sites.status, "deleted")))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      imageUrl: null,
      pageUrl: params.siteUrl,
      shape: "bot",
      shapeLabelAr: "عام",
      siteTitle: "",
      githubUrl: null,
      cached: false,
      message: "الموقع غير موجود.",
    };
  }

  const theme = themeForCategory(row.categorySlug);
  const artifact = await renderQrArtifact({
    url: params.siteUrl,
    theme,
    title: row.title || row.templateName,
    handle: params.botHandle,
    outputDir: OUTPUT_DIR,
    publicPrefix: "/qr",
  });

  // The card is also archived in the repository root when a token is configured.
  const published = await publishFileToGithub(
    artifact.fileName,
    artifact.buffer,
    `feat(qr): branded card for ${row.slug} (${theme.key})`,
  );

  return {
    ok: true,
    // On serverless hosts the writable cache is ephemeral. Prefer the durable
    // public GitHub asset when publishing succeeded; fall back to the local cache.
    imageUrl: published.ok && published.url
      ? published.url
      : `${params.origin}/api/qr/image/${artifact.fileName}`,
    pageUrl: params.siteUrl,
    shape: theme.key,
    shapeLabelAr: theme.labelAr,
    siteTitle: row.title,
    githubUrl: published.url,
    cached: artifact.reused,
    message: published.ok
      ? undefined
      : `تم إنشاء البطاقة محليًا. ${published.reason ?? ""}`.trim(),
  };
}

/**
 * Builds the QR card that carries the owner's personal referral link.
 */
export async function buildReferralQr(params: {
  referralUrl: string;
  botHandle: string;
  origin: string;
}): Promise<QrResult> {
  const theme = themeForCategory("bot");
  const artifact = await renderQrArtifact({
    url: params.referralUrl,
    theme,
    title: "LoveCraft",
    handle: params.botHandle,
    outputDir: OUTPUT_DIR,
    publicPrefix: "/qr",
  });

  const published = await publishFileToGithub(
    artifact.fileName,
    artifact.buffer,
    `feat(qr): referral card for ${params.botHandle}`,
  );

  return {
    ok: true,
    imageUrl: `${params.origin}/api/qr/image/${artifact.fileName}`,
    pageUrl: params.referralUrl,
    shape: theme.key,
    shapeLabelAr: theme.labelAr,
    siteTitle: "رابط الإحالة",
    githubUrl: published.url,
    cached: artifact.reused,
    message: published.ok ? undefined : `تم إنشاء البطاقة محليًا. ${published.reason ?? ""}`.trim(),
  };
}

export async function getBotHandle(): Promise<string> {
  const [cfg] = await db.select().from(botSettings).limit(1);
  return cfg?.botUsername || process.env.TELEGRAM_BOT_USERNAME?.trim() || "LoveCraftMakerBot";
}
