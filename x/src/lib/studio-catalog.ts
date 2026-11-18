import { unstable_cache } from 'next/cache';
import { and, count, eq } from 'drizzle-orm';
import { db, templates, templateCategories, templateComponents, botSettings } from '@/db';
import { ensurePlatformSeeded } from './bootstrap';
import { templateMotion, type TemplateMotion } from './template-motion';

export type LibraryItem = {
  id: number; slug: string; title: string; english: string; description: string; image: string;
  category: string; tier: string; version: string; experience: string; featured: boolean; order: number;
  motion: TemplateMotion;
};
export type LibraryCategory = { slug: string; title: string; total: number };
export type LibraryData = { items: LibraryItem[]; categories: LibraryCategory[]; components: number; botUsername: string };

export const getStudioCatalog = unstable_cache(async (): Promise<LibraryData> => {
  await ensurePlatformSeeded();
  const [rows, categories, componentRows, bots] = await Promise.all([
    db.select({ id: templates.id, slug: templates.slug, title: templates.nameAr, english: templates.nameEn,
      description: templates.descriptionAr, image: templates.previewImage, tier: templates.tier,
      version: templates.currentVersion, experience: templates.experienceType, featured: templates.isFeatured,
      category: templateCategories.slug, order: templates.sortOrder, config: templates.defaultConfig,
    }).from(templates).innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
      .where(and(eq(templates.isPublished, true), eq(templateCategories.isPublished, true))).orderBy(templates.id),
    db.select({ slug: templateCategories.slug, title: templateCategories.nameAr }).from(templateCategories)
      .where(eq(templateCategories.isPublished, true)).orderBy(templateCategories.sortOrder),
    db.select({ total: count() }).from(templateComponents).where(eq(templateComponents.isActive, true)),
    db.select({ username: botSettings.botUsername }).from(botSettings).limit(1),
  ]);
  const items = rows.map(({config,...item})=>({...item,motion:templateMotion(config.componentsConfig)}));
  return { items, categories: categories.map(c => ({ ...c, total: items.filter(t => t.category === c.slug).length })),
    components: componentRows[0]?.total ?? 0, botUsername: bots[0]?.username ?? 'LoveCraftMakerBot' };
}, ['lovecraft-studio-motion-catalog-v4'], { revalidate: 300, tags: ['template-catalog'] });
