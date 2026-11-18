import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  botSettings,
  systemSettings,
  adminAuditLogs,
  securityEvents,
  adminUsers,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { getClientIp, logAdminAudit, sanitizePlainText } from "@/lib/security";
import { hasBlobStorage } from "@/lib/site-media";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const [[bot], [sys], audits, secEvents] = await Promise.all([
    db.select().from(botSettings).limit(1),
    db.select().from(systemSettings).limit(1),
    db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        metadata: adminAuditLogs.metadata,
        ipAddress: adminAuditLogs.ipAddress,
        createdAt: adminAuditLogs.createdAt,
        adminUsername: adminUsers.username,
      })
      .from(adminAuditLogs)
      .leftJoin(adminUsers, eq(adminAuditLogs.adminId, adminUsers.id))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(35),
    db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.createdAt))
      .limit(35),
  ]);

  // NEVER expose raw secret values or tokens — return boolean presence flags only!
  const envStatus = {
    botApiSecretConfigured: Boolean(process.env.BOT_API_SECRET?.trim()),
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
    vercelBlobConfigured: hasBlobStorage(),
    qrSigningConfigured: (process.env.QR_SIGNING_SECRET?.trim() || process.env.BOT_API_SECRET?.trim() || "").length >= 32,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    databaseConnected: true,
  };

  return NextResponse.json({
    botSettings: bot,
    systemSettings: sys ? { ...sys, maxUploadMb: Math.min(sys.maxUploadMb, 4) } : sys,
    envStatus,
    auditLogs: audits,
    securityEvents: secEvents,
    currentAdmin: {
      username: auth.admin.username,
      email: auth.admin.email,
      role: auth.admin.role,
    },
  });
}

const SettingsPatchSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("bot"),
    botUsername: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_]+$/),
    welcomeMessageAr: z.string().min(5).max(1500),
    helpMessageAr: z.string().min(5).max(2000),
    notificationsEnabled: z.boolean(),
    siteCreationEnabled: z.boolean(),
    continuousSitesEnabled: z.boolean(),
    catboxUploadsEnabled: z.boolean(),
    musicFeatureEnabled: z.boolean(),
    effects3dEnabled: z.boolean(),
    allowedDurationsDays: z.array(z.number().int().min(1).max(365)).min(1).max(8),
    dailySiteLimitPerUser: z.number().int().min(1).max(100),
    monthlySiteLimitPerUser: z.number().int().min(1).max(500),
  }),
  z.object({
    section: z.literal("system"),
    primaryDomain: z.string().url().max(200),
    githubOwner: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
    githubRepo: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
    githubBranch: z.string().min(1).max(60).regex(/^[a-zA-Z0-9/_.-]+$/),
    githubSyncEnabled: z.boolean(),
    maxUploadMb: z.number().int().min(1).max(4),
    apiRateLimitPerMin: z.number().int().min(15).max(600),
    loginMaxAttempts: z.number().int().min(3).max(15),
    loginLockoutMinutes: z.number().int().min(5).max(180),
  }),
  z.object({
    section: z.literal("resolve_security"),
    eventId: z.number().int().positive(),
  }),
]);

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = SettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "تحقق من صحة قيم الإعدادات المدخلة." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const now = new Date();

  if (parsed.data.section === "bot") {
    const [existing] = await db.select().from(botSettings).limit(1);
    if (existing) {
      // Allow safe Telegram HTML tags <b>, <i>, <code>, <u> only
      const safeWelcome = sanitizePlainText(parsed.data.welcomeMessageAr, 1500);
      const safeHelp = sanitizePlainText(parsed.data.helpMessageAr, 2000);
      await db
        .update(botSettings)
        .set({
          botUsername: parsed.data.botUsername,
          welcomeMessageAr: safeWelcome,
          helpMessageAr: safeHelp,
          notificationsEnabled: parsed.data.notificationsEnabled,
          siteCreationEnabled: parsed.data.siteCreationEnabled,
          continuousSitesEnabled: parsed.data.continuousSitesEnabled,
          catboxUploadsEnabled: parsed.data.catboxUploadsEnabled,
          musicFeatureEnabled: parsed.data.musicFeatureEnabled,
          effects3dEnabled: parsed.data.effects3dEnabled,
          allowedDurationsDays: Array.from(new Set(parsed.data.allowedDurationsDays)).sort(
            (a, b) => a - b
          ),
          dailySiteLimitPerUser: parsed.data.dailySiteLimitPerUser,
          monthlySiteLimitPerUser: parsed.data.monthlySiteLimitPerUser,
          updatedAt: now,
        })
        .where(eq(botSettings.id, existing.id));
    }
    await logAdminAudit({
      adminId: auth.admin.id,
      action: "bot_settings_updated",
      targetType: "bot_settings",
      ipAddress: ip,
    });
    return NextResponse.json({ ok: true, message: "تم حفظ إعدادات البوت بنجاح." });
  }

  if (parsed.data.section === "system") {
    const [existing] = await db.select().from(systemSettings).limit(1);
    if (existing) {
      await db
        .update(systemSettings)
        .set({
          primaryDomain: parsed.data.primaryDomain.replace(/\/+$/, ""),
          githubOwner: parsed.data.githubOwner,
          githubRepo: parsed.data.githubRepo,
          githubBranch: parsed.data.githubBranch,
          githubSyncEnabled: parsed.data.githubSyncEnabled,
          maxUploadMb: parsed.data.maxUploadMb,
          apiRateLimitPerMin: parsed.data.apiRateLimitPerMin,
          loginMaxAttempts: parsed.data.loginMaxAttempts,
          loginLockoutMinutes: parsed.data.loginLockoutMinutes,
          updatedAt: now,
        })
        .where(eq(systemSettings.id, existing.id));
    }
    await logAdminAudit({
      adminId: auth.admin.id,
      action: "system_settings_updated",
      targetType: "system_settings",
      ipAddress: ip,
    });
    return NextResponse.json({ ok: true, message: "تم حفظ إعدادات النظام والأمان بنجاح." });
  }

  await db
    .update(securityEvents)
    .set({ isResolved: true })
    .where(eq(securityEvents.id, parsed.data.eventId));

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "security_event_resolved",
    targetType: "security_event",
    targetId: parsed.data.eventId,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, message: "تم تعليم الحدث الأمني كمُراجَع." });
}
