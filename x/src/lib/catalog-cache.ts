import { unstable_cache } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db, templateCategories, templateComponents, templates, botSettings } from "@/db";
import { ensurePlatformSeeded } from "./bootstrap";

export type PublicTemplate = {
  id: number; slug: string; nameAr: string; nameEn: string; descriptionAr: string;
  previewImage: string; currentVersion: string; tier: string; creditCost: number;
  isFeatured: boolean; experienceType: string; usageCount: number; categorySlug: string;
  categoryNameAr: string; categoryEmoji: string; accentColor: string;
  hero: string; background: string; gallery: string; effects: string[];
};
export type PublicCategory = {
  id: number; slug: string; nameAr: string; nameEn: string; emoji: string;
  descriptionAr: string; coverImage: string; accentColor: string; sortOrder: number; templateCount: number;
};

const loadCatalog = async () => {
  await ensurePlatformSeeded();
  const [rows, cats, components, bots] = await Promise.all([
    db.select({
      id: templates.id, slug: templates.slug, nameAr: templates.nameAr, nameEn: templates.nameEn,
      descriptionAr: templates.descriptionAr, previewImage: templates.previewImage,
      currentVersion: templates.currentVersion, tier: templates.tier, creditCost: templates.creditCost,
      isFeatured: templates.isFeatured, experienceType: templates.experienceType, usageCount: templates.usageCount,
      defaultConfig: templates.defaultConfig, categoryId: templates.categoryId,
      categorySlug: templateCategories.slug, categoryNameAr: templateCategories.nameAr,
      categoryEmoji: templateCategories.emoji, accentColor: templateCategories.accentColor,
    })
      .from(templates)
      .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
      .where(and(eq(templates.isPublished, true), eq(templateCategories.isPublished, true)))
      .orderBy(templates.categoryId, templates.sortOrder, templates.id),
    db.select().from(templateCategories).where(eq(templateCategories.isPublished, true)).orderBy(templateCategories.sortOrder),
    db.select().from(templateComponents).where(eq(templateComponents.isActive, true)).orderBy(templateComponents.componentGroup, templateComponents.sortOrder),
    db.select({ username: botSettings.botUsername }).from(botSettings).limit(1),
  ]);

  const countMap = new Map<number, number>();
  for (const row of rows) countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + 1);

  return {
    templates: rows.map((row): PublicTemplate => {
      const config = row.defaultConfig as { componentsConfig?: { hero?: string; background?: string; gallery?: string; effects?: string[] } };
      return {
        id: row.id, slug: row.slug, nameAr: row.nameAr, nameEn: row.nameEn,
        descriptionAr: row.descriptionAr, previewImage: row.previewImage,
        currentVersion: row.currentVersion, tier: row.tier, creditCost: row.creditCost,
        isFeatured: row.isFeatured, experienceType: row.experienceType, usageCount: row.usageCount,
        categorySlug: row.categorySlug, categoryNameAr: row.categoryNameAr,
        categoryEmoji: row.categoryEmoji, accentColor: row.accentColor,
        hero: config.componentsConfig?.hero || "cinematic",
        background: config.componentsConfig?.background || "stars",
        gallery: config.componentsConfig?.gallery || "memory-gallery",
        effects: config.componentsConfig?.effects || [],
      };
    }),
    categories: cats.map((cat): PublicCategory => ({ ...cat, templateCount: countMap.get(cat.id) ?? 0 })),
    components,
    botUsername: bots[0]?.username ?? "LoveCraftMakerBot",
  };
};

/**
 * The public catalogue is identical for every reader, so it is served from a shared cache
 * instead of hitting PostgreSQL on each request. The tag is invalidated when the owner
 * publishes or edits a template.
 */
export const getCachedPublicCatalog = unstable_cache(loadCatalog, ["public-catalog-v4"], {
  revalidate: 300,
  tags: ["template-catalog"],
});

export const CATALOG_TAG = "template-catalog";
