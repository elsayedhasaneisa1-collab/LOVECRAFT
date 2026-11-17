import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  db,
  referrals,
  creditTransactions,
  users,
  botSettings,
  sites,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { reviewReferralDecision } from "@/lib/site-engine";
import { getClientIp, logAdminAudit } from "@/lib/security";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") || "all").trim();
  const purpose = (sp.get("purpose") || "all").trim();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(sp.get("pageSize")) || 12));

  const conds = [];
  if (["pending", "approved", "rejected", "suspicious"].includes(status)) {
    conds.push(eq(referrals.status, status));
  }
  if (["creation_credit", "weekly_renewal"].includes(purpose)) {
    conds.push(eq(referrals.purpose, purpose));
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const referrerAlias = alias(users, "referrer_u");
  const referredAlias = alias(users, "referred_u");

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(referrals)
    .where(whereClause);

  const rows = await db
    .select({
      ref: referrals,
      referrerName: referrerAlias.firstName,
      referrerUsername: referrerAlias.username,
      referrerTgId: referrerAlias.telegramUserId,
      referredName: referredAlias.firstName,
      referredUsername: referredAlias.username,
      referredTgId: referredAlias.telegramUserId,
      targetSiteSlug: sites.slug,
    })
    .from(referrals)
    .innerJoin(referrerAlias, eq(referrals.referrerUserId, referrerAlias.id))
    .innerJoin(referredAlias, eq(referrals.referredUserId, referredAlias.id))
    .leftJoin(sites, eq(referrals.targetSiteId, sites.id))
    .where(whereClause)
    .orderBy(desc(referrals.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ledger = await db
    .select({
      tx: creditTransactions,
      userFirstName: users.firstName,
      username: users.username,
      tgId: users.telegramUserId,
    })
    .from(creditTransactions)
    .innerJoin(users, eq(creditTransactions.userId, users.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(25);

  const [cfg] = await db.select().from(botSettings).limit(1);

  return NextResponse.json({
    referrals: rows.map((r) => ({
      id: r.ref.id,
      purpose: r.ref.purpose,
      status: r.ref.status,
      referralCodeUsed: r.ref.referralCodeUsed,
      suspicionReason: r.ref.suspicionReason,
      reviewNote: r.ref.reviewNote,
      createdAt: r.ref.createdAt,
      verifiedAt: r.ref.verifiedAt,
      targetSiteSlug: r.targetSiteSlug,
      referrer: {
        name: r.referrerName,
        username: r.referrerUsername,
        telegramUserId: r.referrerTgId,
      },
      referred: {
        name: r.referredName,
        username: r.referredUsername,
        telegramUserId: r.referredTgId,
      },
    })),
    ledger: ledger.map((l) => ({
      id: l.tx.id,
      txType: l.tx.txType,
      amount: l.tx.amount,
      balanceBefore: l.tx.balanceBefore,
      balanceAfter: l.tx.balanceAfter,
      description: l.tx.description,
      idempotencyKey: l.tx.idempotencyKey,
      createdAt: l.tx.createdAt,
      userName: l.userFirstName,
      username: l.username,
      telegramUserId: l.tgId,
    })),
    rules: {
      referralsEnabled: cfg?.referralsEnabled ?? true,
      autoApproveCleanReferrals: cfg?.autoApproveCleanReferrals ?? false,
      referralsPerCredit: cfg?.referralsPerCredit ?? 2,
      creditsPerReward: cfg?.creditsPerReward ?? 1,
      weeklyReferralsForContinuous: cfg?.weeklyReferralsForContinuous ?? 2,
      fixedDurationRequiresCredit: cfg?.fixedDurationRequiresCredit ?? false,
      maxFixedSitesWithoutReferral: cfg?.maxFixedSitesWithoutReferral ?? 2,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

const ReferralPostSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("review"),
    referralId: z.number().int().positive(),
    decision: z.enum(["approved", "rejected", "suspicious"]),
    note: z.string().max(300).optional(),
  }),
  z.object({
    mode: z.literal("update_rules"),
    referralsEnabled: z.boolean(),
    autoApproveCleanReferrals: z.boolean(),
    referralsPerCredit: z.number().int().min(1).max(50),
    creditsPerReward: z.number().int().min(1).max(20),
    weeklyReferralsForContinuous: z.number().int().min(1).max(50),
    fixedDurationRequiresCredit: z.boolean(),
    maxFixedSitesWithoutReferral: z.number().int().min(0).max(20),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = ReferralPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }

  const ip = getClientIp(req);

  if (parsed.data.mode === "review") {
    const out = await reviewReferralDecision({
      referralId: parsed.data.referralId,
      decision: parsed.data.decision,
      adminId: auth.admin.id,
      note: parsed.data.note,
      ipAddress: ip,
    });
    return NextResponse.json(out, { status: out.ok ? 200 : 400 });
  }

  const [cfg] = await db.select().from(botSettings).limit(1);
  if (cfg) {
    await db
      .update(botSettings)
      .set({
        referralsEnabled: parsed.data.referralsEnabled,
        autoApproveCleanReferrals: parsed.data.autoApproveCleanReferrals,
        referralsPerCredit: parsed.data.referralsPerCredit,
        creditsPerReward: parsed.data.creditsPerReward,
        weeklyReferralsForContinuous: parsed.data.weeklyReferralsForContinuous,
        fixedDurationRequiresCredit: parsed.data.fixedDurationRequiresCredit,
        maxFixedSitesWithoutReferral: parsed.data.maxFixedSitesWithoutReferral,
        updatedAt: new Date(),
      })
      .where(eq(botSettings.id, cfg.id));
  }

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "referral_rules_updated",
    targetType: "bot_settings",
    metadata: parsed.data,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, message: "تم تحديث شروط الإحالات والمكافآت بنجاح." });
}
