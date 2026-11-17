import { count, eq, sql } from "drizzle-orm";
import {
  db,
  botSettings,
  systemSettings,
  templateCategories,
  templateComponents,
  templates,
  templateVersions,
  platformState,
} from "@/db";
import { COMPONENT_LIBRARY } from "./components-catalog";
import {
  TEMPLATE_CATEGORIES_SEED,
  buildAllTemplateSeeds,
  buildTemplateDefaultConfig,
  buildTemplateFieldsSchema,
  DEFAULT_COMPATIBILITY,
} from "./templates-catalog";

let bootstrapPromise: Promise<void> | null = null;

export async function ensurePlatformSeeded(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runSeed().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function runSeed(): Promise<void> {
  // 1. Ensure bot_settings exists
  const existingBot = await db.select({ id: botSettings.id }).from(botSettings).limit(1);
  if (existingBot.length === 0) {
    await db.insert(botSettings).values({
      botUsername: process.env.TELEGRAM_BOT_USERNAME || "LoveCraftMakerBot",
      welcomeMessageAr:
        "<b>أهلاً بك في LOVECRAFT BOT</b> ✨\n<i>Your Moments. Your Website.</i>\n\nاصنع موقعاً مستقلاً فاخراً للحظاتك ومناسباتك وأعمالك خلال دقائق، وشاركه برابط خاص مع من تحب.",
      helpMessageAr:
        "<b>دليل استخدام LOVECRAFT BOT</b>\n\n1️⃣ اختر <b>إنشاء موقع جديد</b> أو <b>تصفح القوالب</b>.\n2️⃣ اختر التصنيف ثم القالب وعاين تصميمه.\n3️⃣ أدخل الأسماء والرسالة والصور والألوان والمؤثرات.\n4️⃣ اختر مدة الموقع وأكّد الإنشاء للحصول على رابطك المستقل.\n\n📌 <b>نظام الرصيد والإحالات:</b>\n• المواقع محددة المدة تعمل حتى انتهاء صلاحيتها تلقائياً.\n• المواقع المستمرة تتطلب إحالات أسبوعية معتمدة لاستمرار عملها.\n• رصيد الإنشاء يزداد فقط عبر الإحالات المعتمدة ولا يُستعاد عند حذف الموقع.",
      notificationsEnabled: true,
      siteCreationEnabled: true,
      continuousSitesEnabled: true,
      catboxUploadsEnabled: true,
      musicFeatureEnabled: true,
      effects3dEnabled: true,
      referralsEnabled: true,
      autoApproveCleanReferrals: false,
      referralsPerCredit: 2,
      creditsPerReward: 1,
      weeklyReferralsForContinuous: 2,
      allowedDurationsDays: [1, 4, 7, 30],
      fixedDurationRequiresCredit: false,
      maxFixedSitesWithoutReferral: 2,
      dailySiteLimitPerUser: 5,
      monthlySiteLimitPerUser: 20,
    });
  }

  // Keep the published handle aligned with the deployment configuration.
  const configuredHandle = process.env.TELEGRAM_BOT_USERNAME?.trim() || "LoveCraftMakerBot";
  await db
    .update(botSettings)
    .set({ botUsername: configuredHandle, updatedAt: new Date() })
    .where(sql`${botSettings.botUsername} <> ${configuredHandle}`);

  // 2. Ensure system_settings exists. Update the old starter defaults only;
  // never overwrite a repository chosen by the owner in the admin console.
  const githubOwner = process.env.GITHUB_TEMPLATES_OWNER?.trim() || "elsayedhasaneisa1-collab";
  const githubRepo = process.env.GITHUB_TEMPLATES_REPO?.trim() || "LOVECRAFT";
  const existingSys = await db
    .select({ id: systemSettings.id, githubOwner: systemSettings.githubOwner, githubRepo: systemSettings.githubRepo })
    .from(systemSettings)
    .limit(1);
  if (existingSys.length === 0) {
    await db.insert(systemSettings).values({
      primaryDomain: process.env.NEXT_PUBLIC_APP_URL || "https://lovecraft.app",
      githubOwner,
      githubRepo,
      githubBranch: process.env.GITHUB_TEMPLATES_BRANCH || "main",
      githubSyncEnabled: true,
      lastGithubSyncAt: null,
      catboxEndpoint: "https://catbox.moe/user/api.php",
      maxUploadMb: 8,
      allowedImageMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      apiRateLimitPerMin: 60,
      loginMaxAttempts: 5,
      loginLockoutMinutes: 15,
    });
  } else if (existingSys[0].githubOwner === "lovecraft-bot" && existingSys[0].githubRepo === "templates") {
    await db
      .update(systemSettings)
      .set({ githubOwner, githubRepo, updatedAt: new Date() })
      .where(eq(systemSettings.id, existingSys[0].id));
  }

  // Correct placeholder repository metadata for bundled templates without changing
  // versions, custom templates, or sites that already exist.
  await db
    .update(templates)
    .set({ githubRepo: `${githubOwner}/${githubRepo}` })
    .where(eq(templates.githubRepo, "lovecraft-bot/templates"));

  // 3. Ensure template_categories exist
  const [{ value: catCount }] = await db.select({ value: count() }).from(templateCategories);
  if (catCount === 0) {
    await db
      .insert(templateCategories)
      .values(TEMPLATE_CATEGORIES_SEED)
      .onConflictDoNothing();
  }

  // 4. Ensure template_components exist (all 75 interior design variants)
  const [{ value: compCount }] = await db.select({ value: count() }).from(templateComponents);
  if (compCount < COMPONENT_LIBRARY.length) {
    await db
      .insert(templateComponents)
      .values(
        COMPONENT_LIBRARY.map((c) => ({
          componentGroup: c.componentGroup,
          variantKey: c.variantKey,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          descriptionAr: c.descriptionAr,
          githubPath: c.githubPath,
          configSchema: { customizable: true, responsive: true },
          supportsLiteMode: c.supportsLiteMode,
          requires3d: c.requires3d,
          sortOrder: c.sortOrder,
          isActive: true,
        }))
      )
      .onConflictDoNothing();
  }

  // 5. Ensure every built-in template and its pinned version exist.
  // One multi-row insert each, so a cold start costs a handful of round trips instead of hundreds.
  const expectedTemplates = buildAllTemplateSeeds().length;
  const [{ value: tplCount }] = await db.select({ value: count() }).from(templates);
  if (tplCount < expectedTemplates) {
    const cats = await db.select().from(templateCategories);
    const catMap = new Map(cats.map((c) => [c.slug, c.id]));

    const prepared = buildAllTemplateSeeds().flatMap((seed) => {
      const categoryId = catMap.get(seed.categorySlug);
      if (!categoryId) return [];
      const defaultConfig = buildTemplateDefaultConfig(seed);
      const fieldsSchema = buildTemplateFieldsSchema(seed);
      const version = seed.experienceType === "links-showcase" ? "1.1.0" : "1.0.0";
      const dependencies = [
        ...(seed.hero === "3d" || seed.background === "3d" || seed.effects.includes("3d-objects")
          ? ["three"]
          : []),
        ...(seed.effects.includes("confetti") || seed.effects.includes("fireworks")
          ? ["canvas-confetti"]
          : []),
        "motion-engine",
      ];
      return [{
        seed, categoryId, defaultConfig, fieldsSchema, dependencies, version,
        template: {
          categoryId,
          slug: seed.slug,
          nameAr: seed.nameAr,
          nameEn: seed.nameEn,
          descriptionAr: seed.descriptionAr,
          previewImage: seed.previewImage,
          githubPath: seed.githubPath,
          githubRepo: `${githubOwner}/${githubRepo}`,
          currentVersion: version,
          tier: seed.tier,
          creditCost: seed.creditCost,
          isPublished: true,
          isFeatured: seed.isFeatured,
          sortOrder: seed.sortOrder,
          experienceType: seed.experienceType,
          defaultConfig,
          fieldsSchema,
          dependencies,
          compatibility: DEFAULT_COMPATIBILITY,
        },
      }];
    });

    await db.insert(templates).values(prepared.map((p) => p.template)).onConflictDoNothing();

    const allTemplates = await db.select({ id: templates.id, slug: templates.slug }).from(templates);
    const bySlug = new Map(allTemplates.map((t) => [t.slug, t.id]));
    const versionRows = prepared.flatMap(({ seed, defaultConfig, fieldsSchema, version }) => {
      const templateId = bySlug.get(seed.slug);
      if (!templateId) return [];
      return [{
        templateId,
        version,
        changelog: "الإصدار الأول من مكتبة الاستوديو",
        githubCommitSha: null,
        configSnapshot: { ...defaultConfig, experienceType: seed.experienceType, previewImage: seed.previewImage },
        schemaSnapshot: fieldsSchema,
        isVerified: true,
      }];
    });
    if (versionRows.length) {
      await db.insert(templateVersions).values(versionRows).onConflictDoNothing();
    }
  }

  // A single marker row lets later boots skip catalogue inspection entirely.
  await db
    .insert(platformState)
    .values({ key: "catalog_seeded", value: String(expectedTemplates) })
    .onConflictDoUpdate({
      target: platformState.key,
      set: { value: String(expectedTemplates), updatedAt: new Date() },
    });
}
