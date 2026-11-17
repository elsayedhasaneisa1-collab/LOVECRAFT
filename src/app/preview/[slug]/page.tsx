import {getAdminSession} from "@/lib/admin-auth";
import React from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, templates, templateCategories } from "@/db";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import {
  MultiTenantSiteRenderer,
  type RenderedSitePayload,
} from "@/components/renderer/MultiTenantSiteRenderer";
import type { ThemeColors } from "@/components/renderer/ComponentShowcaseBlocks";

export const dynamic = "force-dynamic";

interface PreviewProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ journey?: string }>;
}

export default async function TemplateLivePreviewPage({ params, searchParams }: PreviewProps) {
  const [{slug},query] = await Promise.all([params,searchParams]);
  await ensurePlatformSeeded();

  const admin=await getAdminSession();
  const rows = await db
    .select({ tpl: templates, cat: templateCategories })
    .from(templates)
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .where(and(eq(templates.slug, slug), admin ? undefined : eq(templates.isPublished, true)))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const cfg = row.tpl.defaultConfig as {
    themeColors: ThemeColors;
    componentsConfig: RenderedSitePayload["componentsConfig"];
    musicTrack: string;
    sampleCustomFields?: Record<string, unknown>;
  };

  const isPortfolio = row.cat.slug === "portfolio";
  const previewPayload: RenderedSitePayload = {
    siteId: 0,
    slug: row.tpl.slug,
    title: `معاينة: ${row.tpl.nameAr}`,
    pinnedVersion: row.tpl.currentVersion,
    durationMode: "fixed",
    viewsCount: row.tpl.usageCount,
    categorySlug: row.cat.slug,
    categoryNameAr: row.cat.nameAr,
    templateSlug: row.tpl.slug,
    templateNameAr: row.tpl.nameAr,
    experienceType: row.tpl.experienceType,
    senderName: isPortfolio ? "استوديو إبداعي — القاهرة" : "أحمد",
    recipientName: isPortfolio ? "سارة النجار" : "ليان",
    headline: row.tpl.nameAr,
    subheadline: row.tpl.descriptionAr,
    mainMessage: isPortfolio
      ? "نصمم ونطوّر تجارب رقمية متكاملة تجمع بين البساطة المعمارية والعمق البصري. يمكنك تخصيص جميع النصوص والصور والألوان والمؤثرات الخاصة بهذا القالب مباشرة من LOVECRAFT BOT."
      : "هذه معاينة حية وتفاعلية لقالب «" +
        row.tpl.nameAr +
        "». عند اختيار هذا القالب من البوت ستظهر هنا كلماتك الخاصة، أسماؤكم، صوركم المرفوعة، وألوانكم المفضلة في رابط مستقل خاص بك تماماً.",
    finalSurpriseText: "كل تفصيلة في هذا القالب قابلة للتخصيص الكامل لتعبر عن لحظتك بأجمل صورة!",
    eventDate: "2026-08-15",
    themeColors: cfg.themeColors,
    componentsConfig: cfg.componentsConfig,
    musicTrack: cfg.musicTrack || "romantic-piano",
    customFields: { ...(cfg.sampleCustomFields ?? {}), ...(row.tpl.experienceType==='links-showcase'?{links:[{label:'Behance — معرض الأعمال',url:'https://www.behance.net/',tag:'Portfolio'},{label:'GitHub — المشاريع',url:'https://github.com/',tag:'Code'}]}:{}) },
    images: [
      { url: row.tpl.previewImage, caption: row.tpl.nameAr, role: "hero" },
      { url: "/images/gallery-memories-1.jpg", caption: "لقطة تفاعلية أولى", role: "gallery" },
      { url: "/images/gallery-memories-2.jpg", caption: "لقطة تفاعلية ثانية", role: "gallery" },
    ],
    isPreview: true,
  };

  return <MultiTenantSiteRenderer site={previewPayload} startJourney={query.journey === "1"} />;
}
