import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { syncTemplateRegistry } from "@/lib/template-registry";
import { revalidateTag } from "next/cache";
import {
  db,
  templates,
  templateVersions,
  templateCategories,
  systemSettings,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import {
  getClientIp,
  logAdminAudit,
  sanitizePlainText,
  sanitizeSafeImageUrl,
} from "@/lib/security";
import {
  buildTemplateDefaultConfig,
  buildTemplateFieldsSchema,
  DEFAULT_COMPATIBILITY,
  type ExperienceType,
} from "@/lib/templates-catalog";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const categoryId = Number(sp.get("categoryId") || 0);
  const versionsForId = Number(sp.get("versionsFor") || 0);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(60, Math.max(5, Number(sp.get("pageSize")) || 15));

  if (versionsForId > 0) {
    const vers = await db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, versionsForId))
      .orderBy(desc(templateVersions.publishedAt));
    return NextResponse.json({ versions: vers });
  }

  const cats = await db.select().from(templateCategories).orderBy(templateCategories.sortOrder);

  const conds = [];
  if (categoryId > 0) conds.push(eq(templates.categoryId, categoryId));
  if (q) {
    const pat = `%${q.slice(0, 60)}%`;
    conds.push(
      or(
        ilike(templates.nameAr, pat),
        ilike(templates.nameEn, pat),
        ilike(templates.slug, pat),
        ilike(templates.githubPath, pat)
      )!
    );
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [{ value: total }] = await db.select({ value: count() }).from(templates).where(whereClause);
  const rows = await db
    .select()
    .from(templates)
    .where(whereClause)
    .orderBy(templates.categoryId, templates.sortOrder, templates.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json({
    categories: cats,
    templates: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

const CreateTplSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    categoryId: z.number().int().positive(),
    slug: z
      .string()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9-]+$/),
    nameAr: z.string().min(2).max(100),
    nameEn: z.string().min(2).max(100),
    descriptionAr: z.string().min(5).max(500),
    previewImage: z.string().min(3).max(300),
    githubPath: z.string().min(5).max(200),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .default("1.0.0"),
    tier: z.enum(["free", "premium"]),
    creditCost: z.number().int().min(0).max(20),
    sortOrder: z.number().int().min(0).max(999).default(50),
    experienceType: z.string().min(3).max(50),
    paletteId: z.string().default("crimson-velvet"),
    hero: z.string().default("cinematic"),
    background: z.string().default("stars"),
    gallery: z.string().default("memory-gallery"),
    isPublished: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal("sync_github"),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateTplSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "تحقق من صحة حقول القالب (slug بحروف إنجليزية صغيرة وشرطات)." }, { status: 400 });
  }

  const ip = getClientIp(req);

  if (parsed.data.mode === "sync_github") {
    try {
      const result=await syncTemplateRegistry();
      await logAdminAudit({adminId:auth.admin.id,action:'github_templates_synced',targetType:'templates',metadata:result,ipAddress:ip});
      revalidateTag('template-catalog',{expire:0});
      return NextResponse.json({ok:true,...result,message:`تم استيراد ${result.imported} إصدار للمراجعة. ${result.unchanged} إصدار دون تغيير.`});
    }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'تعذرت المزامنة. لم يتم النشر.'},{status:502});}
  }

  const d = parsed.data;
  const [cat] = await db
    .select()
    .from(templateCategories)
    .where(eq(templateCategories.id, d.categoryId))
    .limit(1);

  if (!cat) {
    return NextResponse.json({ error: "التصنيف المختار غير موجود." }, { status: 404 });
  }

  const safeImg = sanitizeSafeImageUrl(d.previewImage) || cat.coverImage;
  const seedLike = {
    categorySlug: cat.slug,
    slug: d.slug,
    nameAr: sanitizePlainText(d.nameAr, 100),
    nameEn: sanitizePlainText(d.nameEn, 100),
    descriptionAr: sanitizePlainText(d.descriptionAr, 500),
    previewImage: safeImg,
    githubPath: d.githubPath.replace(/[^a-zA-Z0-9/_.-]/g, ""),
    tier: d.tier,
    creditCost: d.creditCost,
    isFeatured: false,
    sortOrder: d.sortOrder,
    experienceType: d.experienceType as ExperienceType,
    paletteId: d.paletteId,
    hero: d.hero,
    background: d.background,
    typography: "cinematic-text",
    button: "gradient",
    gallery: d.gallery,
    sections: ["interactive-messages", "timeline", "final-surprise"],
    effects: ["confetti", "stars", "scroll-reveal"],
    introStyle: "curtain",
    musicTrack: "romantic-piano",
  };

  const defaultConfig = buildTemplateDefaultConfig(seedLike);
  const fieldsSchema = buildTemplateFieldsSchema(seedLike);

  try {
    const [created] = await db
      .insert(templates)
      .values({
        categoryId: cat.id,
        slug: seedLike.slug,
        nameAr: seedLike.nameAr,
        nameEn: seedLike.nameEn,
        descriptionAr: seedLike.descriptionAr,
        previewImage: seedLike.previewImage,
        githubPath: seedLike.githubPath,
        currentVersion: d.version,
        tier: d.tier,
        creditCost: d.creditCost,
        isPublished: d.isPublished,
        sortOrder: d.sortOrder,
        experienceType: seedLike.experienceType,
        defaultConfig,
        fieldsSchema,
        dependencies: ["motion-engine"],
        compatibility: DEFAULT_COMPATIBILITY,
      })
      .returning();

    await db.insert(templateVersions).values({
      templateId: created!.id,
      version: d.version,
      changelog: "إصدار مسجّل ومعتمد من لوحة الإدارة",
      configSnapshot: defaultConfig,
      schemaSnapshot: fieldsSchema,
      isVerified: true,
    });

    await logAdminAudit({
      adminId: auth.admin.id,
      action: "template_created",
      targetType: "template",
      targetId: created!.id,
      metadata: { slug: created!.slug, version: d.version },
      ipAddress: ip,
    });

    return NextResponse.json({
      ok: true,
      templateId: created!.id,
      message: "تم تسجيل القالب الجديد ونشره فوراً في البوت والموقع دون إعادة بناء!",
    });
  } catch {
    return NextResponse.json({ error: "معرّف القالب (slug) مستخدم مسبقاً." }, { status: 409 });
  }
}

const PatchTplSchema = z.object({
  templateId: z.number().int().positive(),
  nameAr: z.string().min(2).max(100).optional(),
  descriptionAr: z.string().min(5).max(500).optional(),
  githubPath: z.string().min(5).max(200).optional(),
  previewImage: z.string().max(300).optional(),
  isPublished: z.boolean().optional(),
  tier: z.enum(["free", "premium"]).optional(),
  creditCost: z.number().int().min(0).max(20).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  newVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  changelog: z.string().max(300).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = PatchTplSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات تحديث القالب غير صالحة." }, { status: 400 });
  }

  const d = parsed.data;
  const [tpl] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, d.templateId))
    .limit(1);

  if (!tpl) {
    return NextResponse.json({ error: "القالب غير موجود." }, { status: 404 });
  }

  const patch: Partial<typeof templates.$inferInsert> = { updatedAt: new Date() };
  if (d.nameAr !== undefined) patch.nameAr = sanitizePlainText(d.nameAr, 100);
  if (d.descriptionAr !== undefined) patch.descriptionAr = sanitizePlainText(d.descriptionAr, 500);
  if (d.githubPath !== undefined) patch.githubPath = d.githubPath.replace(/[^a-zA-Z0-9/_.-]/g, "");
  if (d.previewImage !== undefined) {
    const safe = sanitizeSafeImageUrl(d.previewImage);
    if (safe) patch.previewImage = safe;
  }
  if (d.isPublished !== undefined) patch.isPublished = d.isPublished;
  if (d.tier !== undefined) patch.tier = d.tier;
  if (d.creditCost !== undefined) patch.creditCost = d.creditCost;
  if (d.sortOrder !== undefined) patch.sortOrder = d.sortOrder;

  // Publish immutable new version while preserving existing sites' pinned versions
  if (d.newVersion && d.newVersion !== tpl.currentVersion) {
    patch.currentVersion = d.newVersion;
    await db
      .insert(templateVersions)
      .values({
        templateId: tpl.id,
        version: d.newVersion,
        changelog: sanitizePlainText(d.changelog || `تحديث الإصدار ${d.newVersion}`, 300),
        configSnapshot: tpl.defaultConfig,
        schemaSnapshot: tpl.fieldsSchema,
        isVerified: true,
      })
      .onConflictDoNothing();
  }

  await db.transaction(async tx=>{
    await tx.update(templates).set(patch).where(eq(templates.id,tpl.id));
    if(d.isPublished===true)await tx.update(templateVersions).set({isVerified:true}).where(and(eq(templateVersions.templateId,tpl.id),eq(templateVersions.version,d.newVersion||tpl.currentVersion)));
  });
  revalidateTag('template-catalog',{expire:0});

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "template_updated",
    targetType: "template",
    targetId: tpl.id,
    metadata: { slug: tpl.slug, newVersion: d.newVersion, isPublished: d.isPublished },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true, message: "تم تحديث إعدادات القالب بنجاح." });
}
