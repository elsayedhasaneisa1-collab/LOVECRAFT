import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  botSettings,
  systemSettings,
  templateCategories,
  templates,
  sites,
  siteData,
  users,
  referrals,
  creditTransactions,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { getClientIp, logAdminAudit } from "@/lib/security";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const now = new Date();
  const [[bot], [sys], cats, tpls, usrs, sts, sData, refs, txs] = await Promise.all([
    db.select().from(botSettings).limit(1),
    db.select().from(systemSettings).limit(1),
    db.select().from(templateCategories),
    db.select().from(templates),
    db.select().from(users),
    db.select().from(sites),
    db.select().from(siteData),
    db.select().from(referrals),
    db.select().from(creditTransactions),
  ]);

  if (sys) {
    await db
      .update(systemSettings)
      .set({ lastBackupAt: now })
      .where(eq(systemSettings.id, sys.id));
  }

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "system_backup_exported",
    targetType: "backup",
    metadata: { sitesCount: sts.length, usersCount: usrs.length, templatesCount: tpls.length },
    ipAddress: getClientIp(req),
  });

  // Note: NEVER includes admin password hashes, session tokens, or env secrets!
  // Bounded export: only the newest rows per table are included, keeping memory flat.
  const LIMIT = 5000;
  const cap = <T>(rows: T[]) => (rows.length > LIMIT ? rows.slice(0, LIMIT) : rows);
  const snapshot = {
    platform: "LOVECRAFT_BOT",
    backupVersion: "1.0.0",
    exportedAt: now.toISOString(),
    counts: {
      exportedRowsAreCappedAt: LIMIT,
      categories: cats.length,
      templates: tpls.length,
      users: usrs.length,
      sites: sts.length,
      referrals: refs.length,
      creditTransactions: txs.length,
    },
    data: {
      botSettings: bot ?? null,
      systemSettings: sys ?? null,
      categories: cap(cats),
      templates: cap(tpls),
      users: cap(usrs),
      sites: cap(sts),
      siteData: cap(sData),
      referrals: cap(refs),
      creditTransactions: cap(txs),
    },
  };

  return NextResponse.json(snapshot);
}

const RestoreSchema = z.object({
  platform: z.literal("LOVECRAFT_BOT"),
  backupVersion: z.string(),
  data: z.object({
    botSettings: z
      .object({
        botUsername: z.string().min(3).max(64),
        referralsPerCredit: z.number().int().min(1).max(50),
        weeklyReferralsForContinuous: z.number().int().min(1).max(50),
        dailySiteLimitPerUser: z.number().int().min(1).max(100),
        monthlySiteLimitPerUser: z.number().int().min(1).max(500),
        siteCreationEnabled: z.boolean(),
        continuousSitesEnabled: z.boolean(),
      })
      .nullable()
      .optional(),
    systemSettings: z
      .object({
        primaryDomain: z.string().url().max(200),
        githubOwner: z.string().min(1).max(80),
        githubRepo: z.string().min(1).max(80),
        githubBranch: z.string().min(1).max(60),
        maxUploadMb: z.number().int().min(1).max(10),
      })
      .nullable()
      .optional(),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = RestoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ملف النسخة الاحتياطية غير صالح أو لا يتطابق مع بنية LOVECRAFT BOT." },
      { status: 400 }
    );
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const b = parsed.data.data.botSettings;
    if (b) {
      const [cur] = await tx.select().from(botSettings).limit(1);
      if (cur) {
        await tx
          .update(botSettings)
          .set({
            botUsername: b.botUsername,
            referralsPerCredit: b.referralsPerCredit,
            weeklyReferralsForContinuous: b.weeklyReferralsForContinuous,
            dailySiteLimitPerUser: b.dailySiteLimitPerUser,
            monthlySiteLimitPerUser: b.monthlySiteLimitPerUser,
            siteCreationEnabled: b.siteCreationEnabled,
            continuousSitesEnabled: b.continuousSitesEnabled,
            updatedAt: now,
          })
          .where(eq(botSettings.id, cur.id));
      }
    }

    const s = parsed.data.data.systemSettings;
    if (s) {
      const [curSys] = await tx.select().from(systemSettings).limit(1);
      if (curSys) {
        await tx
          .update(systemSettings)
          .set({
            primaryDomain: s.primaryDomain,
            githubOwner: s.githubOwner,
            githubRepo: s.githubRepo,
            githubBranch: s.githubBranch,
            maxUploadMb: s.maxUploadMb,
            updatedAt: now,
          })
          .where(eq(systemSettings.id, curSys.id));
      }
    }
  });

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "system_backup_restored",
    targetType: "backup",
    metadata: { backupVersion: parsed.data.backupVersion },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    ok: true,
    message: "تم التحقق من النسخة الاحتياطية واستعادة إعدادات المنصة بنجاح.",
  });
}
