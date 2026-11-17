import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  sites,
  siteData,
  siteExpirations,
  siteReferralRequirements,
  siteEvents,
  users,
  templates,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { getClientIp, logAdminAudit, sanitizePlainText } from "@/lib/security";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "all").trim();
  const eventsSiteId = Number(sp.get("eventsSiteId") || 0);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(sp.get("pageSize")) || 12));

  if (eventsSiteId > 0) {
    const evs = await db
      .select()
      .from(siteEvents)
      .where(eq(siteEvents.siteId, eventsSiteId))
      .orderBy(desc(siteEvents.createdAt))
      .limit(40);
    return NextResponse.json({ events: evs });
  }

  const conds = [];
  if (status === "all") {
    conds.push(ne(sites.status, "deleted"));
  } else {
    conds.push(eq(sites.status, status));
  }

  if (q) {
    const pat = `%${q.slice(0, 60)}%`;
    conds.push(
      or(
        ilike(sites.slug, pat),
        ilike(sites.title, pat),
        ilike(users.firstName, pat),
        ilike(users.username, pat),
        ilike(templates.nameAr, pat)
      )!
    );
  }

  const whereClause = and(...conds);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(sites)
    .innerJoin(users, eq(sites.userId, users.id))
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .where(whereClause);

  const rows = await db
    .select({
      site: sites,
      headline: siteData.headline,
      mainMessage: siteData.mainMessage,
      ownerFirstName: users.firstName,
      ownerUsername: users.username,
      ownerTelegramId: users.telegramUserId,
      templateNameAr: templates.nameAr,
      templateSlug: templates.slug,
      expiresAt: siteExpirations.expiresAt,
      reqWeekly: siteReferralRequirements.requiredWeeklyCount,
      doneWeekly: siteReferralRequirements.completedInWindow,
      windowEndAt: siteReferralRequirements.windowEndAt,
    })
    .from(sites)
    .innerJoin(siteData, eq(siteData.siteId, sites.id))
    .innerJoin(users, eq(sites.userId, users.id))
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .leftJoin(siteExpirations, eq(siteExpirations.siteId, sites.id))
    .leftJoin(siteReferralRequirements, eq(siteReferralRequirements.siteId, sites.id))
    .where(whereClause)
    .orderBy(desc(sites.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json({
    sites: rows.map((r) => ({
      id: r.site.id,
      slug: r.site.slug,
      title: r.site.title,
      headline: r.headline,
      mainMessage: r.mainMessage,
      status: r.site.status,
      isHidden: r.site.isHidden,
      isShowcase: r.site.isShowcase,
      durationMode: r.site.durationMode,
      durationDays: r.site.durationDays,
      pinnedVersion: r.site.pinnedVersion,
      viewsCount: r.site.viewsCount,
      createdAt: r.site.createdAt,
      expiresAt: r.expiresAt,
      requiredWeekly: r.reqWeekly,
      completedWeekly: r.doneWeekly,
      windowEndAt: r.windowEndAt,
      ownerFirstName: r.ownerFirstName,
      ownerUsername: r.ownerUsername,
      ownerTelegramId: r.ownerTelegramId,
      templateNameAr: r.templateNameAr,
      templateSlug: r.templateSlug,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

const SiteAdminActionSchema = z.object({
  siteId: z.number().int().positive(),
  action: z.enum(["pause", "resume", "hide", "unhide", "delete", "edit"]),
  title: z.string().max(140).optional(),
  mainMessage: z.string().max(2000).optional(),
  extendDays: z.number().int().min(1).max(365).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = SiteAdminActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات التعديل غير صالحة." }, { status: 400 });
  }

  const { siteId, action, extendDays } = parsed.data;
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) {
    return NextResponse.json({ error: "الموقع غير موجود." }, { status: 404 });
  }

  const now = new Date();
  const ip = getClientIp(req);

  if (action === "pause") {
    await db
      .update(sites)
      .set({ status: "paused_admin", updatedAt: now })
      .where(eq(sites.id, siteId));
  } else if (action === "resume") {
    const graceDays = extendDays ?? 7;
    const newWindow = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
    await db
      .update(sites)
      .set({
        status: "active",
        isHidden: false,
        manualOverrideUntil: newWindow,
        updatedAt: now,
      })
      .where(eq(sites.id, siteId));

    if (site.durationMode === "fixed") {
      await db
        .update(siteExpirations)
        .set({ expiresAt: newWindow, autoStoppedAt: null, lastCheckedAt: now })
        .where(eq(siteExpirations.siteId, siteId));
    } else {
      await db
        .update(siteReferralRequirements)
        .set({
          isPausedForShortfall: false,
          pausedAt: null,
          windowStartAt: now,
          windowEndAt: newWindow,
          lastResumedAt: now,
          manualOverrideByAdminId: auth.admin.id,
        })
        .where(eq(siteReferralRequirements.siteId, siteId));
    }
  } else if (action === "hide" || action === "unhide") {
    await db
      .update(sites)
      .set({ isHidden: action === "hide", updatedAt: now })
      .where(eq(sites.id, siteId));
  } else if (action === "delete") {
    // Strictly NEVER restores user credit on deletion
    await db
      .update(sites)
      .set({ status: "deleted", isHidden: true, deletedAt: now, updatedAt: now })
      .where(eq(sites.id, siteId));
  } else if (action === "edit") {
    const cleanTitle = parsed.data.title
      ? sanitizePlainText(parsed.data.title, 140) || site.title
      : site.title;
    await db
      .update(sites)
      .set({ title: cleanTitle, updatedAt: now })
      .where(eq(sites.id, siteId));
    const dataPatch: Partial<typeof siteData.$inferInsert> = {
      headline: cleanTitle,
      updatedAt: now,
    };
    if (parsed.data.mainMessage) {
      dataPatch.mainMessage = sanitizePlainText(parsed.data.mainMessage, 2000);
    }
    await db.update(siteData).set(dataPatch).where(eq(siteData.siteId, siteId));
  }

  await db.insert(siteEvents).values({
    siteId,
    actorType: "admin",
    actorId: auth.admin.id,
    eventType: action === "pause" ? "paused_admin" : action === "resume" ? "resumed" : action,
    details: { adminUsername: auth.admin.username, creditRefunded: 0 },
  });

  await logAdminAudit({
    adminId: auth.admin.id,
    action: `site_${action}`,
    targetType: "site",
    targetId: siteId,
    metadata: { slug: site.slug },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, message: "تم تنفيذ الإجراء الإداري على الموقع بنجاح." });
}
