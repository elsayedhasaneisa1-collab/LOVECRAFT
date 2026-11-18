import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  users,
  userBans,
  userCredits,
  sites,
  referrals,
  adminUsers,
} from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { getClientIp, logAdminAudit, sanitizePlainText } from "@/lib/security";

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "all").trim();
  const historyUserId = Number(sp.get("banHistoryUserId") || 0);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(sp.get("pageSize")) || 12));

  if (historyUserId > 0) {
    const history = await db
      .select({
        id: userBans.id,
        banType: userBans.banType,
        reason: userBans.reason,
        isActive: userBans.isActive,
        bannedAt: userBans.bannedAt,
        expiresAt: userBans.expiresAt,
        unbannedAt: userBans.unbannedAt,
        bannedByUsername: adminUsers.username,
      })
      .from(userBans)
      .leftJoin(adminUsers, eq(userBans.bannedByAdminId, adminUsers.id))
      .where(eq(userBans.userId, historyUserId))
      .orderBy(desc(userBans.bannedAt));

    return NextResponse.json({ banHistory: history });
  }

  const conds = [];
  if (status === "active" || status === "temp_banned" || status === "perm_banned") {
    conds.push(eq(users.accountStatus, status));
  }
  if (q) {
    const pat = `%${q.slice(0, 60)}%`;
    const numQ = Number(q);
    if (Number.isInteger(numQ) && numQ > 0) {
      conds.push(
        or(
          eq(users.telegramUserId, numQ),
          eq(users.telegramChatId, numQ),
          ilike(users.username, pat),
          ilike(users.firstName, pat)
        )!
      );
    } else {
      conds.push(
        or(
          ilike(users.username, pat),
          ilike(users.firstName, pat),
          ilike(users.lastName, pat),
          ilike(users.referralCode, pat)
        )!
      );
    }
  }

  const whereClause = conds.length > 0 ? and(...conds) : undefined;
  const [{ value: total }] = await db.select({ value: count() }).from(users).where(whereClause);

  const userRows = await db
    .select({
      user: users,
      balance: userCredits.balance,
      lifetimeEarned: userCredits.lifetimeEarned,
      lifetimeSpent: userCredits.lifetimeSpent,
    })
    .from(users)
    .leftJoin(userCredits, eq(userCredits.userId, users.id))
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const userIds = userRows.map((r) => r.user.id);
  const siteCounts =
    userIds.length > 0
      ? await db
          .select({ userId: sites.userId, cnt: count() })
          .from(sites)
          .where(and(inArray(sites.userId, userIds), ne(sites.status, "deleted")))
          .groupBy(sites.userId)
      : [];

  const refCounts =
    userIds.length > 0
      ? await db
          .select({
            userId: referrals.referrerUserId,
            total: count(),
            approved: sql<number>`count(*) filter (where ${referrals.status} = 'approved')::int`,
          })
          .from(referrals)
          .where(inArray(referrals.referrerUserId, userIds))
          .groupBy(referrals.referrerUserId)
      : [];

  const siteMap = new Map(siteCounts.map((s) => [s.userId, s.cnt]));
  const refMap = new Map(refCounts.map((r) => [r.userId, { total: r.total, approved: r.approved }]));

  return NextResponse.json({
    users: userRows.map((r) => ({
      id: r.user.id,
      telegramUserId: r.user.telegramUserId,
      telegramChatId: r.user.telegramChatId,
      username: r.user.username,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      referralCode: r.user.referralCode,
      accountStatus: r.user.accountStatus,
      createdAt: r.user.createdAt,
      lastActiveAt: r.user.lastActiveAt,
      sitesCount: siteMap.get(r.user.id) ?? 0,
      referralsTotal: refMap.get(r.user.id)?.total ?? 0,
      referralsApproved: refMap.get(r.user.id)?.approved ?? 0,
      balance: r.balance ?? 0,
      lifetimeEarned: r.lifetimeEarned ?? 0,
      lifetimeSpent: r.lifetimeSpent ?? 0,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

const BanActionSchema = z.object({
  userId: z.number().int().positive(),
  action: z.enum(["ban_temp", "ban_perm", "unban"]),
  reason: z.string().max(400).optional(),
  durationHours: z.number().int().min(1).max(8760).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = BanActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات الإجراء غير صالحة." }, { status: 400 });
  }

  const { userId, action, durationHours } = parsed.data;
  const reason = sanitizePlainText(parsed.data.reason || "قرار إداري", 350) || "قرار إداري";
  const now = new Date();
  const ip = getClientIp(req);

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
  }

  if (action === "unban") {
    await db
      .update(userBans)
      .set({
        isActive: false,
        unbannedByAdminId: auth.admin.id,
        unbannedAt: now,
      })
      .where(and(eq(userBans.userId, userId), eq(userBans.isActive, true)));

    await db
      .update(users)
      .set({ accountStatus: "active" })
      .where(eq(users.id, userId));

    await logAdminAudit({
      adminId: auth.admin.id,
      action: "user_unbanned",
      targetType: "user",
      targetId: userId,
      metadata: { telegramUserId: target.telegramUserId },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true, message: "تم فك الحظر عن المستخدم بنجاح." });
  }

  // Deactivate previous active ban rows before recording the new historical ban
  await db
    .update(userBans)
    .set({ isActive: false, unbannedAt: now, unbannedByAdminId: auth.admin.id })
    .where(and(eq(userBans.userId, userId), eq(userBans.isActive, true)));

  const isTemp = action === "ban_temp";
  const hours = durationHours ?? 24;
  const expiresAt = isTemp ? new Date(now.getTime() + hours * 3600_000) : null;

  await db.insert(userBans).values({
    userId,
    banType: isTemp ? "temporary" : "permanent",
    reason,
    isActive: true,
    bannedByAdminId: auth.admin.id,
    bannedAt: now,
    expiresAt,
  });

  await db
    .update(users)
    .set({ accountStatus: isTemp ? "temp_banned" : "perm_banned" })
    .where(eq(users.id, userId));

  await logAdminAudit({
    adminId: auth.admin.id,
    action: isTemp ? "user_banned_temporary" : "user_banned_permanent",
    targetType: "user",
    targetId: userId,
    metadata: { telegramUserId: target.telegramUserId, reason, durationHours: isTemp ? hours : null },
    ipAddress: ip,
  });

  return NextResponse.json({
    ok: true,
    message: isTemp
      ? `تم حظر المستخدم مؤقتاً لمدة ${hours} ساعة.`
      : "تم حظر المستخدم بشكل دائم.",
  });
}
