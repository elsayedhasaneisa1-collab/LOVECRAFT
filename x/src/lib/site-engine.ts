import { and, count, desc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { recordVisit } from "./analytics";
import {
  db,
  users,
  userBans,
  userCredits,
  creditTransactions,
  referrals,
  referralRewards,
  templates,
  templateVersions,
  templateCategories,
  sites,
  siteData,
  siteAssets,
  siteExpirations,
  siteReferralRequirements,
  siteEvents,
  botSettings,
} from "@/db";
import {
  generateReferralCode,
  generateSiteSlug,
  sanitizePlainText,
  sanitizeHexColor,
  sanitizeSafeImageUrl,
  sanitizeCustomFields,
  sha256Hex,
  logSecurityEvent,
  logAdminAudit,
} from "./security";
import { getPaletteById, MUSIC_TRACKS, COMPONENT_LIBRARY } from "./components-catalog";

export interface ActiveBanInfo {
  isBanned: boolean;
  banType?: string;
  reason?: string;
  expiresAt?: Date | null;
}

/**
 * Checks if user has an active ban; automatically lifts expired temporary bans on the server.
 */
export async function checkUserBanStatus(userId: number): Promise<ActiveBanInfo> {
  const activeBans = await db
    .select()
    .from(userBans)
    .where(and(eq(userBans.userId, userId), eq(userBans.isActive, true)))
    .orderBy(desc(userBans.bannedAt));

  if (activeBans.length === 0) {
    return { isBanned: false };
  }

  const now = new Date();
  for (const ban of activeBans) {
    if (ban.banType === "temporary" && ban.expiresAt && ban.expiresAt <= now) {
      await db
        .update(userBans)
        .set({ isActive: false, unbannedAt: now })
        .where(eq(userBans.id, ban.id));
      continue;
    }
    return {
      isBanned: true,
      banType: ban.banType,
      reason: ban.reason,
      expiresAt: ban.expiresAt,
    };
  }

  // All temporary bans expired — restore user status to active
  await db
    .update(users)
    .set({ accountStatus: "active" })
    .where(eq(users.id, userId));

  return { isBanned: false };
}

/**
 * Register or update Telegram user and optionally record an incoming referral link (?start=REF... or ?start=WK_siteId_REF...)
 */
export async function registerOrTouchTelegramUser(params: {
  telegramUserId: number;
  telegramChatId: number;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  languageCode?: string | null;
  startPayload?: string | null;
  ipAddress?: string;
}) {
  const now = new Date();
  const cleanFirst = sanitizePlainText(params.firstName, 80) || "مستخدم";
  const cleanLast = params.lastName ? sanitizePlainText(params.lastName, 80) : null;
  const cleanUsername = params.username
    ? params.username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 64)
    : null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, params.telegramUserId))
    .limit(1);

  let user = existing[0];
  let isNewUser = false;
  let referralOutcome:
    | null
    | { recorded: boolean; status: string; message: string } = null;

  if (!user) {
    isNewUser = true;
    const referralCode = generateReferralCode(params.telegramUserId);
    const [inserted] = await db
      .insert(users)
      .values({
        telegramUserId: params.telegramUserId,
        telegramChatId: params.telegramChatId,
        username: cleanUsername,
        firstName: cleanFirst,
        lastName: cleanLast,
        languageCode: (params.languageCode || "ar").slice(0, 8),
        referralCode,
        accountStatus: "active",
        createdAt: now,
        lastActiveAt: now,
      })
      .returning();
    user = inserted!;

    await db
      .insert(userCredits)
      .values({
        userId: user.id,
        balance: 0,
        reservedBalance: 0,
        qualifiedReferralsProgress: 0,
      })
      .onConflictDoNothing();
  } else {
    await db
      .update(users)
      .set({
        telegramChatId: params.telegramChatId,
        username: cleanUsername ?? user.username,
        firstName: cleanFirst,
        lastName: cleanLast,
        lastActiveAt: now,
      })
      .where(eq(users.id, user.id));
  }

  const ban = await checkUserBanStatus(user.id);

  // Process referral payload
  if (params.startPayload && !ban.isBanned) {
    referralOutcome = await processIncomingReferral({
      referredUserId: user.id,
      isNewUser,
      startPayload: params.startPayload.trim(),
      ipAddress: params.ipAddress,
    });
  }

  const [credits] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, user.id))
    .limit(1);

  return {
    user,
    isNewUser,
    ban,
    credits: credits ?? { balance: 0, reservedBalance: 0, qualifiedReferralsProgress: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
    referralOutcome,
  };
}

/**
 * Referral intake with strict anti-self, anti-duplicate, suspicious IP flagging,
 * and strict separation of creation_credit vs weekly_renewal.
 */
export async function processIncomingReferral(params: {
  referredUserId: number;
  isNewUser: boolean;
  startPayload: string;
  ipAddress?: string;
}): Promise<{ recorded: boolean; status: string; message: string }> {
  const [cfg] = await db.select().from(botSettings).limit(1);
  if (cfg && !cfg.referralsEnabled) {
    return { recorded: false, status: "disabled", message: "نظام الإحالات متوقف حالياً." };
  }

  // Format supported:
  // 1) REFxxxx -> creation_credit
  // 2) WK_<siteId>_REFxxxx -> weekly_renewal for a continuous site
  let purpose: "creation_credit" | "weekly_renewal" = "creation_credit";
  let targetSiteId: number | null = null;
  let refCode = params.startPayload;

  const wkMatch = /^WK_(\d+)_(REF[A-Z0-9]+)$/i.exec(params.startPayload);
  if (wkMatch) {
    purpose = "weekly_renewal";
    targetSiteId = Number(wkMatch[1]);
    refCode = wkMatch[2]!.toUpperCase();
  } else if (/^REF[A-Z0-9]+$/i.test(params.startPayload)) {
    refCode = params.startPayload.toUpperCase();
  } else {
    return { recorded: false, status: "ignored", message: "" };
  }

  const [referrer] = await db
    .select()
    .from(users)
    .where(eq(users.referralCode, refCode))
    .limit(1);

  if (!referrer) {
    return { recorded: false, status: "invalid_code", message: "رمز الإحالة غير صالح." };
  }

  // 1. Block self-referral
  if (referrer.id === params.referredUserId) {
    await logSecurityEvent({
      severity: "low",
      eventType: "self_referral_blocked",
      ipAddress: params.ipAddress,
      actorIdentifier: String(referrer.telegramUserId),
      details: { refCode },
    });
    return {
      recorded: false,
      status: "self_referral",
      message: "لا يمكنك استخدام رابط الإحالة الخاص بك.",
    };
  }

  // 2. Block existing users from triggering new referrals or duplicate referrals
  const existingRef = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referredUserId, params.referredUserId))
    .limit(1);

  if (existingRef.length > 0 || !params.isNewUser) {
    return {
      recorded: false,
      status: "duplicate",
      message: "تم تسجيل هذا الحساب مسبقاً ولا تُحتسب الإحالة مرتين.",
    };
  }

  // Validate target site if weekly_renewal
  if (purpose === "weekly_renewal" && targetSiteId) {
    const [targetSite] = await db
      .select()
      .from(sites)
      .where(
        and(
          eq(sites.id, targetSiteId),
          eq(sites.userId, referrer.id),
          eq(sites.durationMode, "continuous"),
          ne(sites.status, "deleted")
        )
      )
      .limit(1);
    if (!targetSite) {
      return {recorded:false,status:"invalid_target",message:"رابط التجديد الأسبوعي لم يعد متاحًا."};
    }
  }

  // Check suspicious burst from same IP hash
  const ipHash = params.ipAddress ? sha256Hex(`ref-ip:${params.ipAddress}`) : null;
  let initialStatus: "pending" | "suspicious" = "pending";
  let suspicionReason: string | null = null;

  if (ipHash) {
    const [{ value: sameIpCount }] = await db
      .select({ value: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerUserId, referrer.id), eq(referrals.ipHash, ipHash)));

    if (sameIpCount >= 3) {
      initialStatus = "suspicious";
      suspicionReason = "تسجيلات متعددة من نفس الشبكة خلال فترة قصيرة — تتطلب مراجعة المالك";
    }
  }

  const [createdRef] = await db
    .insert(referrals)
    .values({
      referrerUserId: referrer.id,
      referredUserId: params.referredUserId,
      referralCodeUsed: refCode,
      purpose,
      targetSiteId,
      status: initialStatus,
      sourceChannel: "telegram_start_link",
      ipHash,
      suspicionReason,
    })
    .onConflictDoNothing()
    .returning();

  if (!createdRef) {
    return { recorded: false, status: "duplicate", message: "الإحالة مسجلة مسبقاً." };
  }

  await db
    .update(users)
    .set({ referredByUserId: referrer.id })
    .where(eq(users.id, params.referredUserId));

  // If owner explicitly enabled auto-approve for clean referrals, settle inside atomic transaction
  if (initialStatus === "pending" && cfg?.autoApproveCleanReferrals) {
    await reviewReferralDecision({
      referralId: createdRef.id,
      decision: "approved",
      adminId: null,
      note: "اعتماد تلقائي وفق إعدادات المالك",
    });
    return {
      recorded: true,
      status: "approved",
      message: "تم تسجيل الإحالة واعتمادها بنجاح!",
    };
  }

  return {
    recorded: true,
    status: initialStatus,
    message: "تم تسجيل الإحالة بنجاح وهي قيد المراجعة للاعتماد.",
  };
}

/**
 * Atomic referral review & reward payout.
 * Mathematically prevents double reward payout via FOR UPDATE + UNIQUE(referral_id) + UNIQUE(idempotency_key).
 * Keeps creation_credit and weekly_renewal strictly separated.
 */
export async function reviewReferralDecision(params: {
  referralId: number;
  decision: "approved" | "rejected" | "suspicious";
  adminId: number | null;
  note?: string;
  ipAddress?: string;
}): Promise<{
  ok: boolean;
  message: string;
  creditsGranted?: number;
  siteResumed?: boolean;
}> {
  return await db.transaction(async (tx) => {
    // Lock referral row FOR UPDATE
    const lockedRes = await tx.execute(
      sql`SELECT id, referrer_user_id, referred_user_id, purpose, target_site_id, status
          FROM referrals WHERE id = ${params.referralId} FOR UPDATE`
    );
    const refRow = lockedRes.rows[0] as
      | {
          id: number;
          referrer_user_id: number;
          referred_user_id: number;
          purpose: string;
          target_site_id: number | null;
          status: string;
        }
      | undefined;

    if (!refRow) {
      return { ok: false, message: "الإحالة غير موجودة." };
    }

    // Check if reward was ALREADY granted (prevent double payout!)
    const existingReward = await tx
      .select({ id: referralRewards.id })
      .from(referralRewards)
      .where(eq(referralRewards.referralId, refRow.id))
      .limit(1);

    if (existingReward.length > 0) {
      return {
        ok: false,
        message: "تم صرف مكافأة هذه الإحالة مسبقاً ولا يمكن تكرار صرفها.",
      };
    }

    if (params.decision !== "approved") {
      await tx
        .update(referrals)
        .set({
          status: params.decision,
          reviewedByAdminId: params.adminId,
          reviewNote: params.note ? sanitizePlainText(params.note, 300) : null,
          verifiedAt: new Date(),
        })
        .where(eq(referrals.id, refRow.id));

      if (params.adminId) {
        await logAdminAudit({
          adminId: params.adminId,
          action: `referral_${params.decision}`,
          targetType: "referral",
          targetId: refRow.id,
          ipAddress: params.ipAddress,
        });
      }
      return {
        ok: true,
        message:
          params.decision === "rejected"
            ? "تم رفض الإحالة دون صرف أي مكافأة."
            : "تم تعليم الإحالة كحالة مشبوهة للمتابعة.",
      };
    }

    // Approve referral
    const [cfg] = await tx.select().from(botSettings).limit(1);
    const refsPerCredit = Math.max(1, cfg?.referralsPerCredit ?? 2);
    const creditsPerReward = Math.max(1, cfg?.creditsPerReward ?? 1);

    await tx
      .update(referrals)
      .set({
        status: "approved",
        reviewedByAdminId: params.adminId,
        reviewNote: params.note ? sanitizePlainText(params.note, 300) : "إحالة معتمدة",
        verifiedAt: new Date(),
      })
      .where(eq(referrals.id, refRow.id));

    let creditsGranted = 0;
    let siteResumed = false;
    let ledgerTxId: number | null = null;
    let appliedToSiteId: number | null = null;

    if (refRow.purpose === "weekly_renewal") {
      // Strictly applies to continuous site weekly renewal ONLY (does NOT increase creation credit)
      let targetSiteId = refRow.target_site_id;
      if (!targetSiteId) {
        const [anyCont] = await tx
          .select({ id: sites.id })
          .from(sites)
          .where(
            and(
              eq(sites.userId, refRow.referrer_user_id),
              eq(sites.durationMode, "continuous"),
              ne(sites.status, "deleted")
            )
          )
          .orderBy(desc(sites.createdAt))
          .limit(1);
        targetSiteId = anyCont?.id ?? null;
      }

      if (targetSiteId) {
        appliedToSiteId = targetSiteId;
        const [reqRow] = await tx
          .select()
          .from(siteReferralRequirements)
          .where(eq(siteReferralRequirements.siteId, targetSiteId))
          .limit(1).for("update");

        if (reqRow) {
          const nextCount = reqRow.completedInWindow + 1;
          const metRequirement = nextCount >= reqRow.requiredWeeklyCount;
          const now = new Date();
          const newWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          if (metRequirement && reqRow.isPausedForShortfall) {
            // Automatically resume paused continuous site and start fresh 7-day active cycle!
            await tx
              .update(siteReferralRequirements)
              .set({
                completedInWindow: 0,
                windowStartAt: now,
                windowEndAt: newWindowEnd,
                isPausedForShortfall: false,
                pausedAt: null,
                lastResumedAt: now,
              })
              .where(eq(siteReferralRequirements.id, reqRow.id));

            await tx
              .update(sites)
              .set({ status: "active", updatedAt: now })
              .where(and(eq(sites.id, targetSiteId), eq(sites.status, "paused_referrals")));

            await tx.insert(siteEvents).values({
              siteId: targetSiteId,
              actorType: "system_cron",
              eventType: "resumed",
              details: { reason: "weekly_referrals_fulfilled", referralId: refRow.id },
            });
            siteResumed = true;
          } else {
            await tx
              .update(siteReferralRequirements)
              .set({ completedInWindow: nextCount })
              .where(eq(siteReferralRequirements.id, reqRow.id));
          }
        }
      }

      await tx.insert(referralRewards).values({
        referralId: refRow.id,
        userId: refRow.referrer_user_id,
        rewardType: "weekly_site_unit",
        creditsGranted: 0,
        appliedToSiteId,
      });
    } else {
      // creation_credit purpose — lock user_credits row FOR UPDATE
      await tx
        .insert(userCredits)
        .values({ userId: refRow.referrer_user_id, balance: 0 })
        .onConflictDoNothing();

      const creditLock = await tx.execute(
        sql`SELECT id, balance, qualified_referrals_progress, lifetime_earned
            FROM user_credits WHERE user_id = ${refRow.referrer_user_id} FOR UPDATE`
      );
      const cRow = creditLock.rows[0] as {
        id: number;
        balance: number;
        qualified_referrals_progress: number;
        lifetime_earned: number;
      };

      const totalProgress = cRow.qualified_referrals_progress + 1;
      const earnedBatches = Math.floor(totalProgress / refsPerCredit);
      const remainder = totalProgress % refsPerCredit;
      creditsGranted = earnedBatches * creditsPerReward;
      const newBalance = cRow.balance + creditsGranted;

      await tx
        .update(userCredits)
        .set({
          balance: newBalance,
          qualifiedReferralsProgress: remainder,
          lifetimeEarned: cRow.lifetime_earned + creditsGranted,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.id, cRow.id));

      if (creditsGranted > 0) {
        const [ledger] = await tx
          .insert(creditTransactions)
          .values({
            userId: refRow.referrer_user_id,
            txType: "referral_reward",
            amount: creditsGranted,
            balanceBefore: cRow.balance,
            balanceAfter: newBalance,
            referenceType: "referral",
            referenceId: String(refRow.id),
            idempotencyKey: `ref-reward-${refRow.id}`,
            description: `مكافأة رصيد إنشاء مقابل إكمال ${refsPerCredit} إحالة معتمدة (إحالة #${refRow.id})`,
          })
          .returning({ id: creditTransactions.id });
        ledgerTxId = ledger?.id ?? null;
      }

      await tx.insert(referralRewards).values({
        referralId: refRow.id,
        userId: refRow.referrer_user_id,
        rewardType: "creation_credit",
        creditsGranted,
        transactionId: ledgerTxId,
      });
    }

    if (params.adminId) {
      await logAdminAudit({
        adminId: params.adminId,
        action: "referral_approved",
        targetType: "referral",
        targetId: refRow.id,
        metadata: { purpose: refRow.purpose, creditsGranted, siteResumed },
        ipAddress: params.ipAddress,
      });
    }

    return {
      ok: true,
      creditsGranted,
      siteResumed,
      message:
        refRow.purpose === "weekly_renewal"
          ? siteResumed
            ? "تم اعتماد الإحالة الأسبوعية وإعادة تشغيل الموقع المستمر تلقائياً!"
            : "تم اعتماد الإحالة الأسبوعية وإضافتها لعداد استمرار الموقع."
          : creditsGranted > 0
          ? `تم اعتماد الإحالة وإضافة +${creditsGranted} إلى رصيد إنشاء المواقع!`
          : "تم اعتماد الإحالة وتسجيل التقدم نحو مكافأة الرصيد التالية.",
    };
  });
}

const VALID_HEROES = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "hero").map((c) => c.variantKey)
);
const VALID_BGS = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "background").map((c) => c.variantKey)
);
const VALID_TYPOS = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "typography").map((c) => c.variantKey)
);
const VALID_BTNS = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "button").map((c) => c.variantKey)
);
const VALID_GALLERIES = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "gallery").map((c) => c.variantKey)
);
const VALID_EFFECTS = new Set(
  COMPONENT_LIBRARY.filter((c) => c.componentGroup === "effect").map((c) => c.variantKey)
);
const VALID_TRACKS = new Set(MUSIC_TRACKS.map((m) => m.id));

export interface CreateSiteInput {
  userId: number;
  templateSlug: string;
  idempotencyKey: string;
  durationMode: "fixed" | "continuous";
  durationDays?: number;
  senderName: string;
  recipientName: string;
  headline: string;
  subheadline?: string;
  mainMessage: string;
  finalSurpriseText?: string;
  eventDate?: string;
  paletteId?: string;
  customPrimaryColor?: string;
  heroVariant?: string;
  backgroundVariant?: string;
  typographyVariant?: string;
  buttonVariant?: string;
  galleryVariant?: string;
  effects?: string[];
  musicTrack?: string;
  imageUrls?: string[];
  assetIds?: number[];
  customFields?: Record<string, unknown>;
}

/**
 * Concurrency-safe, idempotent multi-tenant website creator.
 * Enforces bans, bot settings, daily/monthly limits, credit reservation + ledger commit,
 * fixed duration windows vs continuous weekly referral rules, and pinned template versions.
 */
export async function createUserSite(input: CreateSiteInput): Promise<
  | { ok: true; site: { id: number; slug: string; title: string; durationMode: string; durationDays: number | null; pinnedVersion: string; creditCharged: number }; duplicate?: boolean }
  | { ok: false; code: string; message: string }
> {
  // 1. Check user ban
  const ban = await checkUserBanStatus(input.userId);
  if (ban.isBanned) {
    return {
      ok: false,
      code: "USER_BANNED",
      message: `حسابك موقوف حالياً ولا يمكنك إنشاء مواقع جديدة. السبب: ${ban.reason || "مخالفة الشروط"}`,
    };
  }

  const rawIdem = sanitizePlainText(input.idempotencyKey, 120);
  const cleanIdem = `${input.userId}:${rawIdem}`;
  if (!rawIdem || rawIdem.length < 6) {
    return { ok: false, code: "MISSING_IDEMPOTENCY", message: "مفتاح عدم التكرار مطلوب." };
  }

  // Fast idempotency check
  const [already] = await db
    .select()
    .from(sites)
    .where(eq(sites.idempotencyKey, cleanIdem))
    .limit(1);

  if (already && already.userId === input.userId) {
    return {
      ok: true,
      duplicate: true,
      site: {
        id: already.id,
        slug: already.slug,
        title: already.title,
        durationMode: already.durationMode,
        durationDays: already.durationDays,
        pinnedVersion: already.pinnedVersion,
        creditCharged: 0,
      },
    };
  }

  return await db.transaction(async (tx) => {
    const [cfg] = await tx.select().from(botSettings).limit(1);
    if (!cfg || !cfg.siteCreationEnabled) {
      return {
        ok: false as const,
        code: "CREATION_DISABLED",
        message: "إنشاء المواقع الجديدة متوقف مؤقتاً من إدارة المنصة.",
      };
    }

    if (input.durationMode === "continuous" && !cfg.continuousSitesEnabled) {
      return {
        ok: false as const,
        code: "CONTINUOUS_DISABLED",
        message: "المواقع المستمرة غير متاحة حالياً؛ يرجى اختيار مدة محددة.",
      };
    }

    // Validate durationDays for fixed mode against owner's allowed list
    let chosenDays: number | null = null;
    if (input.durationMode === "fixed") {
      const allowed = cfg.allowedDurationsDays.length > 0 ? cfg.allowedDurationsDays : [1, 4, 7, 30];
      const requested = Number(input.durationDays ?? allowed[0]);
      if (!allowed.includes(requested)) {
        return {
          ok: false as const,
          code: "INVALID_DURATION",
          message: `المدة المختارة غير متاحة. المدد المعتمدة: ${allowed.join("، ")} يوم.`,
        };
      }
      chosenDays = requested;
    }

    // Load published template & its latest verified version
    const [tpl] = await tx
      .select()
      .from(templates)
      .where(and(eq(templates.slug, input.templateSlug), eq(templates.isPublished, true)))
      .limit(1);

    if (!tpl) {
      return {
        ok: false as const,
        code: "TEMPLATE_NOT_FOUND",
        message: "القالب المطلوب غير متاح أو متوقف عن النشر حالياً.",
      };
    }

    const [ver] = await tx
      .select()
      .from(templateVersions)
      .where(
        and(eq(templateVersions.templateId, tpl.id), eq(templateVersions.version, tpl.currentVersion))
      )
      .limit(1);

    const fallbackVer =
      ver ??
      (
        await tx
          .select()
          .from(templateVersions)
          .where(eq(templateVersions.templateId, tpl.id))
          .orderBy(desc(templateVersions.id))
          .limit(1)
      )[0];

    if (!fallbackVer || !fallbackVer.isVerified) {
      return {
        ok: false as const,
        code: "TEMPLATE_VERSION_MISSING",
        message: "لا يوجد إصدار معتمد لهذا القالب حالياً.",
      };
    }

    // Ensure user_credits row exists and lock FOR UPDATE (blocks concurrent over-limit creations!)
    await tx
      .insert(userCredits)
      .values({ userId: input.userId, balance: 0 })
      .onConflictDoNothing();

    const lockedCredits = await tx.execute(
      sql`SELECT id, balance, reserved_balance, lifetime_spent,
                 sites_created_today, sites_created_month,
                 last_daily_reset_at, last_monthly_reset_at
          FROM user_credits WHERE user_id = ${input.userId} FOR UPDATE`
    );
    const cRow = lockedCredits.rows[0] as {
      id: number;
      balance: number;
      reserved_balance: number;
      lifetime_spent: number;
      sites_created_today: number;
      sites_created_month: number;
      last_daily_reset_at: string | Date;
      last_monthly_reset_at: string | Date;
    };

    // Re-check idempotency under lock
    const [dupUnderLock] = await tx
      .select()
      .from(sites)
      .where(eq(sites.idempotencyKey, cleanIdem))
      .limit(1);

    if (dupUnderLock) {
      return {
        ok: true as const,
        duplicate: true,
        site: {
          id: dupUnderLock.id,
          slug: dupUnderLock.slug,
          title: dupUnderLock.title,
          durationMode: dupUnderLock.durationMode,
          durationDays: dupUnderLock.durationDays,
          pinnedVersion: dupUnderLock.pinnedVersion,
          creditCharged: 0,
        },
      };
    }

    const now = new Date();
    const lastDay = new Date(cRow.last_daily_reset_at);
    const lastMonth = new Date(cRow.last_monthly_reset_at);
    let todayCount = cRow.sites_created_today;
    let monthCount = cRow.sites_created_month;
    let nextDailyReset = lastDay;
    let nextMonthlyReset = lastMonth;

    if (now.getTime() - lastDay.getTime() >= 24 * 60 * 60 * 1000) {
      todayCount = 0;
      nextDailyReset = now;
    }
    if (now.getTime() - lastMonth.getTime() >= 30 * 24 * 60 * 60 * 1000) {
      monthCount = 0;
      nextMonthlyReset = now;
    }

    if (todayCount >= cfg.dailySiteLimitPerUser) {
      return {
        ok: false as const,
        code: "DAILY_LIMIT_REACHED",
        message: `وصلت إلى الحد اليومي لإنشاء المواقع (${cfg.dailySiteLimitPerUser} مواقع يومياً).`,
      };
    }
    if (monthCount >= cfg.monthlySiteLimitPerUser) {
      return {
        ok: false as const,
        code: "MONTHLY_LIMIT_REACHED",
        message: `وصلت إلى الحد الشهري لإنشاء المواقع (${cfg.monthlySiteLimitPerUser} موقعاً شهرياً).`,
      };
    }

    // Count ALL fixed sites EVER created by user (INCLUDING deleted/hidden — deleting NEVER restores quota or credit!)
    const [{ value: lifetimeFixedSites }] = await tx
      .select({ value: count() })
      .from(sites)
      .where(and(eq(sites.userId, input.userId), eq(sites.durationMode, "fixed")));

    // Determine required creation credit:
    // - Fixed-duration free templates within owner's `maxFixedSitesWithoutReferral` require 0 referrals/credits (Section 8: "لا تحتاج هذه المواقع إلى إحالات")
    // - Premium templates OR fixedDurationRequiresCredit OR exceeding lifetime free fixed allowance require creation credits earned ONLY from approved referrals!
    let requiredCredit = 0;
    if (
      tpl.tier === "premium" ||
      cfg.fixedDurationRequiresCredit ||
      (input.durationMode === "fixed" && lifetimeFixedSites >= cfg.maxFixedSitesWithoutReferral)
    ) {
      requiredCredit = Math.max(1, tpl.creditCost);
    }

    const availableBalance = cRow.balance - cRow.reserved_balance;
    if (requiredCredit > 0 && availableBalance < requiredCredit) {
      return {
        ok: false as const,
        code: "INSUFFICIENT_CREDITS",
        message: `تحتاج إلى ${requiredCredit} رصيد إنشاء (رصيدك المتاح: ${availableBalance}). يمكنك زيادة رصيدك عبر دعوة أصدقائك من قسم «الإحالات».`,
      };
    }

    // Step A: Reserve credit before site creation (ledger entry #1)
    if (requiredCredit > 0) {
      await tx
        .update(userCredits)
        .set({ reservedBalance: cRow.reserved_balance + requiredCredit, updatedAt: now })
        .where(eq(userCredits.id, cRow.id));

      await tx.insert(creditTransactions).values({
        userId: input.userId,
        txType: "reserve_for_site",
        amount: 0,
        balanceBefore: cRow.balance,
        balanceAfter: cRow.balance,
        referenceType: "site",
        referenceId: cleanIdem,
        idempotencyKey: `reserve-${cleanIdem}`,
        description: `حجز ${requiredCredit} رصيد قبل إنشاء موقع بقالب «${tpl.nameAr}»`,
      });
    }

    // Sanitize all user inputs
    const senderName = sanitizePlainText(input.senderName, 80) || "مُحب";
    const recipientName = sanitizePlainText(input.recipientName, 80) || "عزيزي";
    const headline = sanitizePlainText(input.headline, 140) || tpl.nameAr;
    const subheadline = input.subheadline ? sanitizePlainText(input.subheadline, 200) : null;
    const mainMessage =
      sanitizePlainText(input.mainMessage, 2000) ||
      "صُمم هذا الموقع خصيصاً لتوثيق هذه اللحظة المميزة.";
    const finalSurpriseText = input.finalSurpriseText
      ? sanitizePlainText(input.finalSurpriseText, 600)
      : "دمتَ بخير وسعادة دائمة!";
    const eventDate = input.eventDate ? sanitizePlainText(input.eventDate, 32) : null;

    const defCfg = fallbackVer.configSnapshot as {
      paletteId?: string;
      themeColors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: string;
        mode: "dark" | "light";
      };
      componentsConfig: {
        hero: string;
        background: string;
        typography: string;
        button: string;
        gallery: string;
        sections: string[];
        effects: string[];
        introStyle: string;
      };
      musicTrack: string;
      sampleCustomFields?: Record<string, unknown>;
    };

    const chosenPal = input.paletteId ? getPaletteById(input.paletteId) : null;
    const baseColors = chosenPal
      ? {
          primary: chosenPal.primary,
          secondary: chosenPal.secondary,
          accent: chosenPal.accent,
          background: chosenPal.background,
          surface: chosenPal.surface,
          text: chosenPal.text,
          mode: chosenPal.mode,
        }
      : defCfg.themeColors;

    const themeColors = {
      ...baseColors,
      primary: input.customPrimaryColor
        ? sanitizeHexColor(input.customPrimaryColor, baseColors.primary)
        : baseColors.primary,
    };

    const rawEffects = Array.isArray(input.effects)
      ? input.effects.filter((e) => VALID_EFFECTS.has(e))
      : [];
    const finalEffects = (Array.isArray(input.effects) ? rawEffects : defCfg.componentsConfig.effects).filter(
      (e) => cfg.effects3dEnabled || e !== "3d-objects"
    );

    const componentsConfig = {
      hero:
        input.heroVariant && VALID_HEROES.has(input.heroVariant)
          ? input.heroVariant
          : defCfg.componentsConfig.hero,
      background:
        input.backgroundVariant && VALID_BGS.has(input.backgroundVariant)
          ? input.backgroundVariant
          : defCfg.componentsConfig.background,
      typography:
        input.typographyVariant && VALID_TYPOS.has(input.typographyVariant)
          ? input.typographyVariant
          : defCfg.componentsConfig.typography,
      button:
        input.buttonVariant && VALID_BTNS.has(input.buttonVariant)
          ? input.buttonVariant
          : defCfg.componentsConfig.button,
      gallery:
        input.galleryVariant && VALID_GALLERIES.has(input.galleryVariant)
          ? input.galleryVariant
          : defCfg.componentsConfig.gallery,
      sections: defCfg.componentsConfig.sections,
      effects: finalEffects,
      introStyle: defCfg.componentsConfig.introStyle,
      liteModeDefault: false,
    };

    if (!cfg.effects3dEnabled) {
      if (componentsConfig.hero === "3d") componentsConfig.hero = "cinematic";
      if (componentsConfig.background === "3d") componentsConfig.background = "stars";
    }

    const musicTrack =
      cfg.musicFeatureEnabled && input.musicTrack && VALID_TRACKS.has(input.musicTrack)
        ? input.musicTrack
        : cfg.musicFeatureEnabled
        ? defCfg.musicTrack || "none"
        : "none";

    // Never carry preview-only professional claims, contact information, or Social links into a real site.
    const baseFields = {...(defCfg.sampleCustomFields ?? {})};
    for (const key of ['stats','contactHandle','links','highlights','roleTitle','eventLocation','eventTime']) delete baseFields[key];
    const mergedCustomFields = {
      ...baseFields,
      ...sanitizeCustomFields(input.customFields),
    };

    const slug = generateSiteSlug(tpl.slug);

    const [newSite] = await tx
      .insert(sites)
      .values({
        slug,
        userId: input.userId,
        templateId: tpl.id,
        templateVersionId: fallbackVer.id,
        pinnedVersion: fallbackVer.version,
        title: headline,
        durationMode: input.durationMode,
        durationDays: chosenDays,
        status: "active",
        isHidden: false,
        isShowcase: false,
        idempotencyKey: cleanIdem,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(siteData).values({
      siteId: newSite!.id,
      senderName,
      recipientName,
      headline,
      subheadline,
      mainMessage,
      finalSurpriseText,
      eventDate,
      themeColors,
      componentsConfig,
      musicTrack,
      customFields: mergedCustomFields,
      updatedAt: now,
    });

    // Attach verified Catbox assets
    if (Array.isArray(input.assetIds) && input.assetIds.length > 0) {
      const cleanIds = input.assetIds
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 12);
      if (cleanIds.length > 0) {
        await tx
          .update(siteAssets)
          .set({ siteId: newSite!.id })
          .where(
            and(
              inArray(siteAssets.id, cleanIds),
              eq(siteAssets.userId, input.userId),
              isNull(siteAssets.siteId),
              ne(siteAssets.provider, "vercel-blob-deleting")
            )
          );
      }
    }

    if (Array.isArray(input.imageUrls) && input.imageUrls.length > 0) {
      const safeUrls = input.imageUrls
        .map((u) => sanitizeSafeImageUrl(u))
        .filter((u): u is string => Boolean(u))
        .slice(0, 10);
      for (let i = 0; i < safeUrls.length; i++) {
        await tx.insert(siteAssets).values({
          siteId: newSite!.id,
          userId: input.userId,
          catboxUrl: safeUrls[i]!,
          provider: safeUrls[i]!.includes("catbox.moe") ? "catbox" : "template_default",
          assetRole: i === 0 ? "hero" : "gallery",
          mimeType: "image/jpeg",
          fileSizeBytes: 120000,
          sortOrder: i,
        });
      }
    }

    // Configure expiration OR continuous weekly referral requirement
    if (input.durationMode === "fixed" && chosenDays) {
      const expiresAt = new Date(now.getTime() + chosenDays * 24 * 60 * 60 * 1000);
      await tx.insert(siteExpirations).values({
        siteId: newSite!.id,
        durationDays: chosenDays,
        startsAt: now,
        expiresAt,
        lastCheckedAt: now,
      });
    } else {
      const windowEndAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await tx.insert(siteReferralRequirements).values({
        siteId: newSite!.id,
        requiredWeeklyCount: Math.max(1, cfg.weeklyReferralsForContinuous),
        completedInWindow: 0,
        windowStartAt: now,
        windowEndAt,
        isPausedForShortfall: false,
      });
    }

    // Step B: Commit reserved credit & increment quotas (NON-REFUNDABLE!)
    const finalBalance = cRow.balance - requiredCredit;
    await tx
      .update(userCredits)
      .set({
        balance: finalBalance,
        reservedBalance: cRow.reserved_balance, // release our reservation into spent
        lifetimeSpent: cRow.lifetime_spent + requiredCredit,
        sitesCreatedToday: todayCount + 1,
        sitesCreatedMonth: monthCount + 1,
        lastDailyResetAt: nextDailyReset,
        lastMonthlyResetAt: nextMonthlyReset,
        updatedAt: now,
      })
      .where(eq(userCredits.id, cRow.id));

    if (requiredCredit > 0) {
      await tx.insert(creditTransactions).values({
        userId: input.userId,
        txType: "commit_site_creation",
        amount: -requiredCredit,
        balanceBefore: cRow.balance,
        balanceAfter: finalBalance,
        referenceType: "site",
        referenceId: String(newSite!.id),
        idempotencyKey: `commit-${cleanIdem}`,
        description: `خصم نهائي لإنشاء موقع «${headline}» (/s/${slug}) — غير قابل للاسترداد عند الحذف`,
      });
    }

    await tx
      .update(templates)
      .set({ usageCount: sql`${templates.usageCount} + 1` })
      .where(eq(templates.id, tpl.id));

    await tx.insert(siteEvents).values({
      siteId: newSite!.id,
      actorType: "user",
      actorId: input.userId,
      eventType: "created",
      details: {
        slug,
        templateSlug: tpl.slug,
        pinnedVersion: fallbackVer.version,
        durationMode: input.durationMode,
        durationDays: chosenDays,
        creditCharged: requiredCredit,
      },
    });

    return {
      ok: true as const,
      site: {
        id: newSite!.id,
        slug,
        title: headline,
        durationMode: input.durationMode,
        durationDays: chosenDays,
        pinnedVersion: fallbackVer.version,
        creditCharged: requiredCredit,
      },
    };
  });
}

/**
 * Update a user's own site — enforces ownership & ban check. NEVER grants credit.
 */
export async function updateUserSite(params: {
  userId: number;
  siteId: number;
  headline?: string;
  mainMessage?: string;
  finalSurpriseText?: string;
  senderName?: string;
  recipientName?: string;
  paletteId?: string;
  musicTrack?: string;
  isHidden?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const ban = await checkUserBanStatus(params.userId);
  if (ban.isBanned) {
    return { ok: false, message: "لا يمكنك تعديل المواقع أثناء حظر الحساب." };
  }

  const [site] = await db
    .select()
    .from(sites)
    .where(
      and(eq(sites.id, params.siteId), eq(sites.userId, params.userId), ne(sites.status, "deleted"))
    )
    .limit(1);

  if (!site) {
    return { ok: false, message: "الموقع غير موجود أو لا تملك صلاحية تعديله." };
  }

  const [existingData] = await db
    .select()
    .from(siteData)
    .where(eq(siteData.siteId, site.id))
    .limit(1);

  if (!existingData) {
    return { ok: false, message: "بيانات الموقع غير موجودة." };
  }

  const now = new Date();
  const nextHeadline = params.headline
    ? sanitizePlainText(params.headline, 140) || existingData.headline
    : existingData.headline;
  const nextMessage = params.mainMessage
    ? sanitizePlainText(params.mainMessage, 2000) || existingData.mainMessage
    : existingData.mainMessage;
  const nextSurprise =
    params.finalSurpriseText !== undefined
      ? sanitizePlainText(params.finalSurpriseText, 600)
      : existingData.finalSurpriseText;
  const nextSender = params.senderName
    ? sanitizePlainText(params.senderName, 80) || existingData.senderName
    : existingData.senderName;
  const nextRecipient = params.recipientName
    ? sanitizePlainText(params.recipientName, 80) || existingData.recipientName
    : existingData.recipientName;

  let nextColors = existingData.themeColors;
  if (params.paletteId) {
    const p = getPaletteById(params.paletteId);
    nextColors = {
      primary: p.primary,
      secondary: p.secondary,
      accent: p.accent,
      background: p.background,
      surface: p.surface,
      text: p.text,
      mode: p.mode,
    };
  }

  const nextMusic =
    params.musicTrack && VALID_TRACKS.has(params.musicTrack)
      ? params.musicTrack
      : existingData.musicTrack;

  await db
    .update(siteData)
    .set({
      headline: nextHeadline,
      mainMessage: nextMessage,
      finalSurpriseText: nextSurprise,
      senderName: nextSender,
      recipientName: nextRecipient,
      themeColors: nextColors,
      musicTrack: nextMusic,
      updatedAt: now,
    })
    .where(eq(siteData.siteId, site.id));

  const sitePatch: Partial<typeof sites.$inferInsert> = {
    title: nextHeadline,
    updatedAt: now,
  };
  if (typeof params.isHidden === "boolean") {
    sitePatch.isHidden = params.isHidden;
  }

  await db.update(sites).set(sitePatch).where(eq(sites.id, site.id));

  await db.insert(siteEvents).values({
    siteId: site.id,
    actorType: "user",
    actorId: params.userId,
    eventType: typeof params.isHidden === "boolean" ? (params.isHidden ? "hidden" : "unhidden") : "updated",
    details: { updatedTitle: nextHeadline, creditRefunded: 0 },
  });

  return { ok: true, message: "تم حفظ تعديلات الموقع بنجاح." };
}

/**
 * Soft-delete a user's site.
 * STRICT RULE: NEVER refunds creation credit or resets creation allowance!
 */
export async function deleteUserSiteNoRefund(params: {
  userId: number;
  siteId: number;
}): Promise<{ ok: boolean; message: string }> {
  const ban = await checkUserBanStatus(params.userId);
  if (ban.isBanned) {
    return { ok: false, message: "حسابك محظور حالياً." };
  }

  const [site] = await db
    .select()
    .from(sites)
    .where(
      and(eq(sites.id, params.siteId), eq(sites.userId, params.userId), ne(sites.status, "deleted"))
    )
    .limit(1);

  if (!site) {
    return { ok: false, message: "الموقع غير موجود أو محذوف مسبقاً." };
  }

  const now = new Date();
  await db
    .update(sites)
    .set({
      status: "deleted",
      isHidden: true,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(sites.id, site.id));

  await db.insert(siteEvents).values({
    siteId: site.id,
    actorType: "user",
    actorId: params.userId,
    eventType: "deleted",
    details: { creditRefunded: 0, note: "Site deleted by owner; credit is strictly non-refundable" },
  });

  return {
    ok: true,
    message: "تم حذف الموقع وإيقاف رابطه نهائياً. (ملاحظة: لا يُستعاد رصيد الإنشاء عند حذف المواقع).",
  };
}

/**
 * Background Cron / Server-side validity sweep for ALL fixed & continuous sites.
 */
export async function evaluateAllSitesValidity(): Promise<{
  expiredCount: number;
  pausedContinuousCount: number;
  renewedContinuousCount: number;
}> {
  const now = new Date();
  let expiredCount = 0;
  let pausedContinuousCount = 0;
  let renewedContinuousCount = 0;

  // 1. Expire overdue fixed-duration sites
  const overdueFixed = await db
    .select({
      siteId: siteExpirations.siteId,
      expId: siteExpirations.id,
      status: sites.status,
      override: sites.manualOverrideUntil,
    })
    .from(siteExpirations)
    .innerJoin(sites, eq(siteExpirations.siteId, sites.id))
    .where(and(lte(siteExpirations.expiresAt, now), eq(sites.status, "active")));

  for (const row of overdueFixed) {
    if (row.override && row.override > now) continue;
    await db
      .update(sites)
      .set({ status: "expired", updatedAt: now })
      .where(eq(sites.id, row.siteId));
    await db
      .update(siteExpirations)
      .set({ autoStoppedAt: now, lastCheckedAt: now })
      .where(eq(siteExpirations.id, row.expId));
    await db.insert(siteEvents).values({
      siteId: row.siteId,
      actorType: "system_cron",
      eventType: "expired",
      details: { autoStoppedAt: now.toISOString() },
    });
    expiredCount++;
  }

  // 2. Evaluate continuous sites whose 7-day window ended
  const dueContinuous = await db
    .select({
      reqId: siteReferralRequirements.id,
      siteId: siteReferralRequirements.siteId,
      required: siteReferralRequirements.requiredWeeklyCount,
      completed: siteReferralRequirements.completedInWindow,
      isPaused: siteReferralRequirements.isPausedForShortfall,
      status: sites.status,
      override: sites.manualOverrideUntil,
    })
    .from(siteReferralRequirements)
    .innerJoin(sites, eq(siteReferralRequirements.siteId, sites.id))
    .where(
      and(
        lte(siteReferralRequirements.windowEndAt, now),
        inArray(sites.status, ["active", "paused_referrals"])
      )
    );

  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const row of dueContinuous) {
    if (row.override && row.override > now) continue;

    if (row.completed >= row.required) {
      // Fulfilled weekly referrals — roll forward next 7-day window & keep/restore active
      await db
        .update(siteReferralRequirements)
        .set({
          completedInWindow: 0,
          windowStartAt: now,
          windowEndAt: nextWeek,
          isPausedForShortfall: false,
          pausedAt: null,
          lastResumedAt: now,
        })
        .where(eq(siteReferralRequirements.id, row.reqId));

      if (row.status === "paused_referrals") {
        await db
          .update(sites)
          .set({ status: "active", updatedAt: now })
          .where(eq(sites.id, row.siteId));
      }
      renewedContinuousCount++;
    } else if (!row.isPaused && row.status === "active") {
      // Shortfall — pause site temporarily until weekly referrals are fulfilled or admin resumes
      await db
        .update(siteReferralRequirements)
        .set({
          isPausedForShortfall: true,
          pausedAt: now,
        })
        .where(eq(siteReferralRequirements.id, row.reqId));

      await db
        .update(sites)
        .set({ status: "paused_referrals", updatedAt: now })
        .where(eq(sites.id, row.siteId));

      await db.insert(siteEvents).values({
        siteId: row.siteId,
        actorType: "system_cron",
        eventType: "paused_referrals",
        details: { required: row.required, completed: row.completed },
      });
      pausedContinuousCount++;
    }
  }

  return { expiredCount, pausedContinuousCount, renewedContinuousCount };
}

/**
 * Server-side loader & real-time validity guard for /s/[slug]
 */
export async function loadRenderedSiteBySlug(
  slug: string,
  visitorMeta?: { ip: string; deviceType: "mobile" | "tablet" | "desktop"; browserFamily: string; referrer?: string | null }
) {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  if (!cleanSlug) return { state: "not_found" as const };

  const rows = await db
    .select({
      site: sites,
      data: siteData,
      tpl: templates,
      cat: templateCategories,
      ver: templateVersions,
      expiresAt: siteExpirations.expiresAt,
      expirationId: siteExpirations.id,
      reqCompleted: siteReferralRequirements.completedInWindow,
      reqRequired: siteReferralRequirements.requiredWeeklyCount,
      reqWindowEnd: siteReferralRequirements.windowEndAt,
      reqPaused: siteReferralRequirements.isPausedForShortfall,
    })
    .from(sites)
    .innerJoin(siteData, eq(siteData.siteId, sites.id))
    .innerJoin(templates, eq(sites.templateId, templates.id))
    .innerJoin(templateCategories, eq(templates.categoryId, templateCategories.id))
    .innerJoin(templateVersions, eq(sites.templateVersionId, templateVersions.id))
    .leftJoin(siteExpirations, eq(siteExpirations.siteId, sites.id))
    .leftJoin(siteReferralRequirements, eq(siteReferralRequirements.siteId, sites.id))
    .where(eq(sites.slug, cleanSlug))
    .limit(1);

  const row = rows[0];
  if (!row || row.site.status === "deleted") {
    return { state: "not_found" as const };
  }

  if (row.site.isHidden || row.site.status === "hidden") {
    return { state: "unavailable" as const, reason: "hidden", title: row.site.title };
  }

  if (row.site.status === "paused_admin") {
    return { state: "unavailable" as const, reason: "paused_admin", title: row.site.title };
  }

  const now = new Date();
  const hasOverride = Boolean(row.site.manualOverrideUntil && row.site.manualOverrideUntil > now);

  // Server-side fixed expiration verification (uses the joined row, no extra query)
  let expiresAtIso: string | null = null;
  if (row.site.durationMode === "fixed") {
    if (row.expiresAt) {
      expiresAtIso = row.expiresAt.toISOString();
      if (!hasOverride && row.expiresAt <= now) {
        if (row.site.status === "active") {
          await db
            .update(sites)
            .set({ status: "expired", updatedAt: now })
            .where(eq(sites.id, row.site.id));
          if (row.expirationId) {
            await db
              .update(siteExpirations)
              .set({ autoStoppedAt: now, lastCheckedAt: now })
              .where(eq(siteExpirations.id, row.expirationId));
          }
          await db.insert(siteEvents).values({
            siteId: row.site.id,
            actorType: "system_cron",
            eventType: "expired",
            details: { checkedOnVisit: true },
          });
        }
        return { state: "unavailable" as const, reason: "expired", title: row.site.title };
      }
    }
    if (row.site.status === "expired" && !hasOverride) {
      return { state: "unavailable" as const, reason: "expired", title: row.site.title };
    }
  }

  // Server-side continuous weekly referral verification (joined row, no extra query)
  if (row.site.durationMode === "continuous") {
    if (row.reqRequired !== null && row.reqRequired !== undefined && !hasOverride) {
      if (row.reqPaused || row.site.status === "paused_referrals") {
        return { state: "unavailable" as const, reason: "paused_referrals", title: row.site.title };
      }
      if (row.reqWindowEnd && row.reqWindowEnd <= now) {
        if ((row.reqCompleted ?? 0) >= row.reqRequired) {
          await db
            .update(siteReferralRequirements)
            .set({
              completedInWindow: 0,
              windowStartAt: now,
              windowEndAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              lastResumedAt: now,
            })
            .where(eq(siteReferralRequirements.siteId, row.site.id));
        } else {
          await db
            .update(siteReferralRequirements)
            .set({ isPausedForShortfall: true, pausedAt: now })
            .where(eq(siteReferralRequirements.siteId, row.site.id));
          await db
            .update(sites)
            .set({ status: "paused_referrals", updatedAt: now })
            .where(eq(sites.id, row.site.id));
          await db.insert(siteEvents).values({
            siteId: row.site.id,
            actorType: "system_cron",
            eventType: "paused_referrals",
            details: { required: row.reqRequired, completed: row.reqCompleted },
          });
          return { state: "unavailable" as const, reason: "paused_referrals", title: row.site.title };
        }
      }
    }
  }

  const assets = await db
    .select()
    .from(siteAssets)
    .where(eq(siteAssets.siteId, row.site.id))
    .orderBy(siteAssets.sortOrder, siteAssets.id);

  // Analytics are buffered in memory and flushed in batches; the request never waits for writes.
  if (visitorMeta) {
    const visitorHash = sha256Hex(`${row.site.id}:${visitorMeta.ip}:${now.toISOString().slice(0, 13)}`);
    recordVisit({
      siteId: row.site.id,
      visitorHash,
      day: now.toISOString().slice(0, 10),
      device: visitorMeta.deviceType,
      browser: visitorMeta.browserFamily,
      referrer: visitorMeta.referrer ? visitorMeta.referrer.slice(0, 120) : "",
    });
  }

  const galleryImages =
    assets.length > 0
      ? assets.map((a) => ({
          url: a.catboxUrl,
          caption: a.caption || row.data.headline,
          role: a.assetRole,
        }))
      : [
          { url: row.tpl.previewImage, caption: row.data.headline, role: "hero" },
          { url: "/images/gallery-memories-1.jpg", caption: row.data.recipientName, role: "gallery" },
          { url: "/images/gallery-memories-2.jpg", caption: row.data.senderName, role: "gallery" },
        ];

  return {
    state: "active" as const,
    payload: {
      siteId: row.site.id,
      slug: row.site.slug,
      title: row.site.title,
      pinnedVersion: row.site.pinnedVersion,
      durationMode: row.site.durationMode,
      expiresAt: expiresAtIso,
      viewsCount: row.site.viewsCount + 1,
      categorySlug: row.cat.slug,
      categoryNameAr: row.cat.nameAr,
      templateSlug: row.tpl.slug,
      templateNameAr: row.tpl.nameAr,
      experienceType: typeof row.ver.configSnapshot.experienceType === "string" ? row.ver.configSnapshot.experienceType : row.tpl.experienceType,
      senderName: row.data.senderName,
      recipientName: row.data.recipientName,
      headline: row.data.headline,
      subheadline: row.data.subheadline,
      mainMessage: row.data.mainMessage,
      finalSurpriseText: row.data.finalSurpriseText,
      eventDate: row.data.eventDate,
      themeColors: row.data.themeColors,
      componentsConfig: row.data.componentsConfig,
      musicTrack: row.data.musicTrack,
      customFields: row.data.customFields,
      images: galleryImages,
      isPreview: false,
    },
  };
}
