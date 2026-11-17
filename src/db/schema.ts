import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. USERS (Telegram end-users)
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    languageCode: text("language_code").default("ar").notNull(),
    referralCode: text("referral_code").notNull().unique(),
    referredByUserId: integer("referred_by_user_id"),
    accountStatus: text("account_status").default("active").notNull(), // active | temp_banned | perm_banned
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_users_status").on(t.accountStatus),
    index("idx_users_username").on(t.username),
    index("idx_users_last_active").on(t.lastActiveAt),
  ]
);

// 2. USER SESSIONS (Telegram Bot FSM & interactive conversation state)
export const userSessions = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull().unique(),
    currentScreen: text("current_screen").default("main_menu").notNull(),
    wizardStep: text("wizard_step"),
    draftPayload: jsonb("draft_payload").$type<Record<string, unknown>>().default({}).notNull(),
    lastMessageId: integer("last_message_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("idx_user_sessions_user").on(t.userId),
    index("idx_user_sessions_expires").on(t.expiresAt)
  ]
);

// 3. ADMIN USERS (Website-only owners/admins — NO default credentials)
export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").default("owner").notNull(), // owner | admin
    isActive: boolean("is_active").default(true).notNull(),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: text("last_login_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_admin_users_role").on(t.role)]
);

// 4. ADMIN SESSIONS (HttpOnly Secure SameSite backend sessions)
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    csrfToken: text("csrf_token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_admin_sessions_admin").on(t.adminId),
    index("idx_admin_sessions_expires").on(t.expiresAt),
    index("idx_admin_sessions_revoked").on(t.revokedAt),
  ]
);

// 5. USER BANS (Full historical record of temporary & permanent bans)
export const userBans = pgTable(
  "user_bans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    banType: text("ban_type").notNull(), // temporary | permanent
    reason: text("reason").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    bannedByAdminId: integer("banned_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    unbannedByAdminId: integer("unbanned_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    bannedAt: timestamp("banned_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    unbannedAt: timestamp("unbanned_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_user_bans_user_active").on(t.userId, t.isActive),
    index("idx_user_bans_expires").on(t.expiresAt),
  ]
);

// 6. TEMPLATE CATEGORIES
export const templateCategories = pgTable(
  "template_categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    emoji: text("emoji").notNull(),
    descriptionAr: text("description_ar").notNull(),
    coverImage: text("cover_image").notNull(),
    accentColor: text("accent_color").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_template_categories_sort").on(t.sortOrder)]
);

// 7. TEMPLATES (Multi-tenant master templates synced with GitHub)
export const templates = pgTable(
  "templates",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => templateCategories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionAr: text("description_ar").notNull(),
    previewImage: text("preview_image").notNull(),
    githubPath: text("github_path").notNull(),
    githubRepo: text("github_repo").default("elsayedhasaneisa1-collab/LOVECRAFT").notNull(),
    currentVersion: text("current_version").default("1.0.0").notNull(),
    tier: text("tier").default("free").notNull(), // free | premium
    creditCost: integer("credit_cost").default(1).notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    experienceType: text("experience_type").notNull(),
    defaultConfig: jsonb("default_config").$type<Record<string, unknown>>().notNull(),
    fieldsSchema: jsonb("fields_schema").$type<Array<Record<string, unknown>>>().notNull(),
    dependencies: jsonb("dependencies").$type<string[]>().default([]).notNull(),
    compatibility: jsonb("compatibility").$type<Record<string, unknown>>().default({}).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_templates_category_pub").on(t.categoryId, t.isPublished, t.sortOrder),
    index("idx_templates_featured").on(t.isFeatured),
    check("chk_templates_credit_cost", sql`${t.creditCost} >= 0`),
  ]
);

// 8. TEMPLATE VERSIONS (Immutable version snapshots so existing sites never break)
export const templateVersions = pgTable(
  "template_versions",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelog: text("changelog").default("Initial verified release").notNull(),
    githubCommitSha: text("github_commit_sha"),
    configSnapshot: jsonb("config_snapshot").$type<Record<string, unknown>>().notNull(),
    schemaSnapshot: jsonb("schema_snapshot").$type<Array<Record<string, unknown>>>().notNull(),
    isVerified: boolean("is_verified").default(true).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_template_version").on(t.templateId, t.version),
    index("idx_template_versions_template").on(t.templateId),
  ]
);

// 9. TEMPLATE COMPONENTS (Independent interior design library: Hero, Background, Typography, Buttons, Gallery, Sections, Effects)
export const templateComponents = pgTable(
  "template_components",
  {
    id: serial("id").primaryKey(),
    componentGroup: text("component_group").notNull(), // hero | background | typography | button | gallery | section | effect
    variantKey: text("variant_key").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionAr: text("description_ar").notNull(),
    githubPath: text("github_path").notNull(),
    configSchema: jsonb("config_schema").$type<Record<string, unknown>>().default({}).notNull(),
    supportsLiteMode: boolean("supports_lite_mode").default(true).notNull(),
    requires3d: boolean("requires_3d").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_component_group_variant").on(t.componentGroup, t.variantKey),
    index("idx_template_components_group").on(t.componentGroup, t.sortOrder),
  ]
);

// 10. SITES (Independent multi-tenant websites — /s/[slug])
export const sites = pgTable(
  "sites",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "restrict" }),
    templateVersionId: integer("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "restrict" }),
    pinnedVersion: text("pinned_version").notNull(),
    title: text("title").notNull(),
    durationMode: text("duration_mode").notNull(), // fixed | continuous
    durationDays: integer("duration_days"), // 1, 4, 7, 30 for fixed; null for continuous
    status: text("status").default("active").notNull(), // active | expired | paused_referrals | paused_admin | hidden | deleted
    isHidden: boolean("is_hidden").default(false).notNull(),
    isShowcase: boolean("is_showcase").default(false).notNull(),
    manualOverrideUntil: timestamp("manual_override_until", { withTimezone: true }),
    viewsCount: integer("views_count").default(0).notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_sites_user_status").on(t.userId, t.status),
    index("idx_sites_status").on(t.status),
    index("idx_sites_showcase").on(t.isShowcase),
    index("idx_sites_template").on(t.templateId),
    index("idx_sites_created_at").on(t.createdAt),
  ]
);

// 11. SITE DATA (Strictly isolated per-site content, colors, components, effects, music)
export const siteData = pgTable(
  "site_data",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .unique()
      .references(() => sites.id, { onDelete: "cascade" }),
    senderName: text("sender_name").notNull(),
    recipientName: text("recipient_name").notNull(),
    headline: text("headline").notNull(),
    subheadline: text("subheadline"),
    mainMessage: text("main_message").notNull(),
    finalSurpriseText: text("final_surprise_text"),
    eventDate: text("event_date"),
    themeColors: jsonb("theme_colors")
      .$type<{
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: string;
        mode: "dark" | "light";
      }>()
      .notNull(),
    componentsConfig: jsonb("components_config")
      .$type<{
        hero: string;
        background: string;
        typography: string;
        button: string;
        gallery: string;
        sections: string[];
        effects: string[];
        introStyle: string;
        liteModeDefault?: boolean;
      }>()
      .notNull(),
    musicTrack: text("music_track").default("none").notNull(), // none | romantic-piano | golden-celebration | starry-ambient | joyful-chimes | creative-pulse
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_site_data_site").on(t.siteId)]
);

// 12. SITE ASSETS (Catbox URLs + light metadata ONLY — ZERO binary storage)
export const siteAssets = pgTable(
  "site_assets",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catboxUrl: text("catbox_url").notNull(),
    provider: text("provider").default("catbox").notNull(),
    assetRole: text("asset_role").default("gallery").notNull(), // hero | gallery | before | after | secret | avatar
    caption: text("caption"),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_site_assets_site").on(t.siteId, t.sortOrder),
    index("idx_site_assets_user").on(t.userId),
    index("idx_site_assets_orphan").on(t.createdAt).where(sql`${t.siteId} IS NULL`),
    check("chk_site_assets_size", sql`${t.fileSizeBytes} > 0 AND ${t.fileSizeBytes} <= 10485760`),
  ]
);

// 13. SITE EXPIRATIONS (Server-enforced fixed duration windows)
export const siteExpirations = pgTable(
  "site_expirations",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .unique()
      .references(() => sites.id, { onDelete: "cascade" }),
    durationDays: integer("duration_days").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    autoStoppedAt: timestamp("auto_stopped_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_site_expirations_expires").on(t.expiresAt)]
);

// 14. SITE REFERRAL REQUIREMENTS (Weekly referral continuity rules for continuous sites)
export const siteReferralRequirements = pgTable(
  "site_referral_requirements",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .unique()
      .references(() => sites.id, { onDelete: "cascade" }),
    requiredWeeklyCount: integer("required_weekly_count").default(2).notNull(),
    completedInWindow: integer("completed_in_window").default(0).notNull(),
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).defaultNow().notNull(),
    windowEndAt: timestamp("window_end_at", { withTimezone: true }).notNull(),
    isPausedForShortfall: boolean("is_paused_for_shortfall").default(false).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    lastResumedAt: timestamp("last_resumed_at", { withTimezone: true }),
    manualOverrideByAdminId: integer("manual_override_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("idx_site_ref_req_window").on(t.windowEndAt, t.isPausedForShortfall),
    check("chk_required_weekly", sql`${t.requiredWeeklyCount} >= 1`),
  ]
);

// 15. REFERRALS (Strictly separated creation_credit vs weekly_renewal, anti-self, anti-duplicate)
export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    referrerUserId: integer("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredUserId: integer("referred_user_id")
      .notNull()
      .unique() // Each new Telegram user can only ever be counted ONCE globally!
      .references(() => users.id, { onDelete: "cascade" }),
    referralCodeUsed: text("referral_code_used").notNull(),
    purpose: text("purpose").default("creation_credit").notNull(), // creation_credit | weekly_renewal
    targetSiteId: integer("target_site_id").references(() => sites.id, { onDelete: "set null" }),
    status: text("status").default("pending").notNull(), // pending | approved | rejected | suspicious
    sourceChannel: text("source_channel").default("telegram_start_link").notNull(),
    ipHash: text("ip_hash"),
    suspicionReason: text("suspicion_reason"),
    reviewedByAdminId: integer("reviewed_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_referrals_referrer_status").on(t.referrerUserId, t.status, t.purpose),
    index("idx_referrals_status").on(t.status),
    check("chk_no_self_referral", sql`${t.referrerUserId} <> ${t.referredUserId}`),
  ]
);

// 16. REFERRAL REWARDS (Unique per referral — mathematically prevents paying reward twice)
export const referralRewards = pgTable(
  "referral_rewards",
  {
    id: serial("id").primaryKey(),
    referralId: integer("referral_id")
      .notNull()
      .unique()
      .references(() => referrals.id, { onDelete: "restrict" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rewardType: text("reward_type").notNull(), // creation_credit | weekly_site_unit
    creditsGranted: integer("credits_granted").default(0).notNull(),
    appliedToSiteId: integer("applied_to_site_id").references(() => sites.id, {
      onDelete: "set null",
    }),
    transactionId: integer("transaction_id"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_referral_rewards_user").on(t.userId)]
);

// 17. USER CREDITS (Creation balance — ONLY increases via approved creation_credit referrals)
export const userCredits = pgTable(
  "user_credits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").default(0).notNull(),
    reservedBalance: integer("reserved_balance").default(0).notNull(),
    qualifiedReferralsProgress: integer("qualified_referrals_progress").default(0).notNull(),
    lifetimeEarned: integer("lifetime_earned").default(0).notNull(),
    lifetimeSpent: integer("lifetime_spent").default(0).notNull(),
    sitesCreatedToday: integer("sites_created_today").default(0).notNull(),
    sitesCreatedMonth: integer("sites_created_month").default(0).notNull(),
    lastDailyResetAt: timestamp("last_daily_reset_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastMonthlyResetAt: timestamp("last_monthly_reset_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("chk_user_credits_balance_nonneg", sql`${t.balance} >= 0`),
    check("chk_user_credits_reserved_nonneg", sql`${t.reservedBalance} >= 0`),
  ]
);

// 18. CREDIT TRANSACTIONS (Immutable Transaction Ledger — never refunds on delete/hide/archive/rename)
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    txType: text("tx_type").notNull(), // referral_reward | reserve_for_site | commit_site_creation | release_failed_reserve
    amount: integer("amount").notNull(), // positive for reward/release, negative for spend
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    referenceType: text("reference_type").notNull(), // referral | site
    referenceId: text("reference_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_credit_tx_user_created").on(t.userId, t.createdAt),
    index("idx_credit_tx_type").on(t.txType),
  ]
);

// 19. SITE EVENTS (Full lifecycle log for every site)
export const siteEvents = pgTable(
  "site_events",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(), // user | admin | system_cron
    actorId: integer("actor_id"),
    eventType: text("event_type").notNull(), // created | updated | hidden | unhidden | paused_referrals | expired | paused_admin | resumed | deleted
    details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_site_events_site_created").on(t.siteId, t.createdAt)]
);

// 20. VISITS (Analytics for generated websites)
export const visits = pgTable(
  "visits",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    deviceType: text("device_type").default("desktop").notNull(), // mobile | tablet | desktop
    browserFamily: text("browser_family").default("other").notNull(),
    referrer: text("referrer"),
    visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_visits_site_date").on(t.siteId, t.visitedAt),
    index("idx_visits_date").on(t.visitedAt),
  ]
);

// 21. BOT SETTINGS (Managed exclusively from /admin)
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botUsername: text("bot_username").default("LoveCraftMakerBot").notNull(),
  welcomeMessageAr: text("welcome_message_ar").notNull(),
  helpMessageAr: text("help_message_ar").notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  siteCreationEnabled: boolean("site_creation_enabled").default(true).notNull(),
  continuousSitesEnabled: boolean("continuous_sites_enabled").default(true).notNull(),
  catboxUploadsEnabled: boolean("catbox_uploads_enabled").default(true).notNull(),
  musicFeatureEnabled: boolean("music_feature_enabled").default(true).notNull(),
  effects3dEnabled: boolean("effects_3d_enabled").default(true).notNull(),
  referralsEnabled: boolean("referrals_enabled").default(true).notNull(),
  autoApproveCleanReferrals: boolean("auto_approve_clean_referrals").default(false).notNull(),
  referralsPerCredit: integer("referrals_per_credit").default(2).notNull(),
  creditsPerReward: integer("credits_per_reward").default(1).notNull(),
  weeklyReferralsForContinuous: integer("weekly_referrals_for_continuous").default(2).notNull(),
  allowedDurationsDays: jsonb("allowed_durations_days")
    .$type<number[]>()
    .default([1, 4, 7, 30])
    .notNull(),
  fixedDurationRequiresCredit: boolean("fixed_duration_requires_credit").default(false).notNull(),
  maxFixedSitesWithoutReferral: integer("max_fixed_sites_without_referral").default(2).notNull(),
  dailySiteLimitPerUser: integer("daily_site_limit_per_user").default(3).notNull(),
  monthlySiteLimitPerUser: integer("monthly_site_limit_per_user").default(12).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 22. SYSTEM SETTINGS (Domain, GitHub, Catbox, Security — NO raw tokens/secrets stored here)
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  primaryDomain: text("primary_domain").default("https://lovecraft.app").notNull(),
  githubOwner: text("github_owner").default("elsayedhasaneisa1-collab").notNull(),
  githubRepo: text("github_repo").default("LOVECRAFT").notNull(),
  githubBranch: text("github_branch").default("main").notNull(),
  githubSyncEnabled: boolean("github_sync_enabled").default(true).notNull(),
  lastGithubSyncAt: timestamp("last_github_sync_at", { withTimezone: true }),
  catboxEndpoint: text("catbox_endpoint").default("https://catbox.moe/user/api.php").notNull(),
  maxUploadMb: integer("max_upload_mb").default(8).notNull(),
  allowedImageMimes: jsonb("allowed_image_mimes")
    .$type<string[]>()
    .default(["image/jpeg", "image/png", "image/webp", "image/gif"])
    .notNull(),
  apiRateLimitPerMin: integer("api_rate_limit_per_min").default(60).notNull(),
  loginMaxAttempts: integer("login_max_attempts").default(5).notNull(),
  loginLockoutMinutes: integer("login_lockout_minutes").default(15).notNull(),
  lastBackupAt: timestamp("last_backup_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 23. ADMIN AUDIT LOGS
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_admin_audit_created").on(t.createdAt)]
);

// 24. SECURITY EVENTS (Suspicious logins, rate-limit hits, invalid webhooks, fraud attempts)
export const securityEvents = pgTable(
  "security_events",
  {
    id: serial("id").primaryKey(),
    severity: text("severity").default("medium").notNull(), // low | medium | high | critical
    eventType: text("event_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    actorIdentifier: text("actor_identifier"),
    details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
    isResolved: boolean("is_resolved").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_security_events_created").on(t.createdAt),
    index("idx_security_events_severity").on(t.severity, t.isResolved),
  ]
);

// 25. PLATFORM STATE (single-row markers that replace repeated catalogue scans on cold starts)
export const platformState = pgTable("platform_state", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 26. VISIT MARKS (bounded dedupe table that keeps daily unique-visitor counting cheap)
export const visitMarks = pgTable(
  "visit_marks",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    day: text("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_visit_mark").on(t.siteId, t.visitorHash, t.day),
    index("idx_visit_marks_created").on(t.createdAt),
  ]
);

// 27. SITE ANALYTICS DAILY (durable rollup so dashboards never scan the raw event log)
export const siteAnalyticsDaily = pgTable(
  "site_analytics_daily",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    views: integer("views").default(0).notNull(),
    uniqueVisitors: integer("unique_visitors").default(0).notNull(),
    devices: jsonb("devices").$type<Record<string, number>>().default({}).notNull(),
    browsers: jsonb("browsers").$type<Record<string, number>>().default({}).notNull(),
    referrers: jsonb("referrers").$type<Record<string, number>>().default({}).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_site_analytics_day").on(t.siteId, t.day),
    index("idx_site_analytics_day").on(t.day),
  ]
);

// 28. SYSTEM METRICS HOURLY (compact operational counters for the owner console)
export const systemMetricsHourly = pgTable(
  "system_metrics_hourly",
  {
    id: serial("id").primaryKey(),
    hour: text("hour").notNull(),
    apiRequests: integer("api_requests").default(0).notNull(),
    siteCreations: integer("site_creations").default(0).notNull(),
    referrals: integer("referrals").default(0).notNull(),
    errors: integer("errors").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_system_metrics_hour").on(t.hour)]
);
