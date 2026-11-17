import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import {
  db,
  users,
  sites,
  templates,
  templateComponents,
  referrals,
  securityEvents,
  templateCategories,
  siteAnalyticsDaily,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { ensurePlatformSeeded } from "@/lib/bootstrap";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  await ensurePlatformSeeded();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [{ value: totalUsers }],
    [{ value: bannedUsers }],
    [{ value: activeSites }],
    [{ value: totalSites }],
    [{ value: pausedSites }],
    [{ value: publishedTemplates }],
    [{ value: totalTemplates }],
    [{ value: totalComponents }],
    [{ value: pendingReferrals }],
    [{ value: approvedReferrals }],
    [{ value: totalVisits }],
    [{ value: unresolvedSecurity }],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(ne(users.accountStatus, "active")),
    db.select({ value: count() }).from(sites).where(and(eq(sites.status, "active"), eq(sites.isHidden, false))),
    db.select({ value: count() }).from(sites).where(ne(sites.status, "deleted")),
    db
      .select({ value: count() })
      .from(sites)
      .where(sql`${sites.status} IN ('paused_referrals', 'paused_admin', 'expired')`),
    db.select({ value: count() }).from(templates).where(eq(templates.isPublished, true)),
    db.select({ value: count() }).from(templates),
    db.select({ value: count() }).from(templateComponents).where(eq(templateComponents.isActive, true)),
    db
      .select({ value: count() })
      .from(referrals)
      .where(sql`${referrals.status} IN ('pending', 'suspicious')`),
    db.select({ value: count() }).from(referrals).where(eq(referrals.status, "approved")),
    db.select({ value: count() }).from(siteAnalyticsDaily),
    db.select({ value: count() }).from(securityEvents).where(eq(securityEvents.isResolved, false)),
  ]);

  // Build 7-day visits & sites chart data
  // The daily rollup keeps this chart off the high-churn raw event log.
  const recentVisits = await db
    .select({
      day: siteAnalyticsDaily.day,
      cnt: sql<number>`COALESCE(SUM(${siteAnalyticsDaily.views}), 0)::int`,
    })
    .from(siteAnalyticsDaily)
    .where(gte(siteAnalyticsDaily.day, sevenDaysAgo.toISOString().slice(0, 10)))
    .groupBy(siteAnalyticsDaily.day);

  const recentSiteCreations = await db
    .select({
      day: sql<string>`to_char(${sites.createdAt}, 'YYYY-MM-DD')`,
      cnt: count(),
    })
    .from(sites)
    .where(gte(sites.createdAt, sevenDaysAgo))
    .groupBy(sql`to_char(${sites.createdAt}, 'YYYY-MM-DD')`);

  const visitMap = new Map(recentVisits.map((r) => [r.day, r.cnt]));
  const siteMap = new Map(recentSiteCreations.map((r) => [r.day, r.cnt]));

  const dailySeries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      label: key.slice(5),
      visits: visitMap.get(key) ?? 0,
      sites: siteMap.get(key) ?? 0,
    };
  });

  // Templates & sites distribution by category
  const catDist = await db
    .select({
      nameAr: templateCategories.nameAr,
      slug: templateCategories.slug,
      accentColor: templateCategories.accentColor,
      templatesCount: count(templates.id),
    })
    .from(templateCategories)
    .leftJoin(templates, eq(templates.categoryId, templateCategories.id))
    .groupBy(
      templateCategories.id,
      templateCategories.nameAr,
      templateCategories.slug,
      templateCategories.accentColor,
      templateCategories.sortOrder
    )
    .orderBy(templateCategories.sortOrder);

  const latestSites = await db
    .select({
      id: sites.id,
      slug: sites.slug,
      title: sites.title,
      status: sites.status,
      durationMode: sites.durationMode,
      viewsCount: sites.viewsCount,
      createdAt: sites.createdAt,
      ownerName: users.firstName,
      templateName: templates.nameAr,
    })
    .from(sites)
    .innerJoin(users, eq(sites.userId, users.id))
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .where(ne(sites.status, "deleted"))
    .orderBy(desc(sites.createdAt))
    .limit(6);

  const notifications: Array<{ id: string; level: string; title: string; targetTab: string }> = [];
  if (pendingReferrals > 0) {
    notifications.push({
      id: "pending-refs",
      level: "warning",
      title: `توجد ${pendingReferrals} إحالات بانتظار المراجعة والاعتماد`,
      targetTab: "referrals",
    });
  }
  if (unresolvedSecurity > 0) {
    notifications.push({
      id: "sec-events",
      level: "danger",
      title: `تم رصد ${unresolvedSecurity} أحداث أمنية غير مراجعة`,
      targetTab: "system",
    });
  }
  if (pausedSites > 0) {
    notifications.push({
      id: "paused-sites",
      level: "info",
      title: `${pausedSites} مواقع متوقفة أو منتهية المدة`,
      targetTab: "sites",
    });
  }

  return NextResponse.json({
    stats: {
      totalUsers,
      bannedUsers,
      activeSites,
      totalSites,
      pausedSites,
      publishedTemplates,
      totalTemplates,
      totalComponents,
      pendingReferrals,
      approvedReferrals,
      totalVisits,
      unresolvedSecurity,
    },
    dailySeries,
    categoryDistribution: catDist,
    latestSites,
    notifications,
  });
}
