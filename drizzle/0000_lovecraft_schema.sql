CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username"),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bot_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bot_username" text DEFAULT 'LoveCraftMakerBot' NOT NULL,
	"welcome_message_ar" text NOT NULL,
	"help_message_ar" text NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"site_creation_enabled" boolean DEFAULT true NOT NULL,
	"continuous_sites_enabled" boolean DEFAULT true NOT NULL,
	"catbox_uploads_enabled" boolean DEFAULT true NOT NULL,
	"music_feature_enabled" boolean DEFAULT true NOT NULL,
	"effects_3d_enabled" boolean DEFAULT true NOT NULL,
	"referrals_enabled" boolean DEFAULT true NOT NULL,
	"auto_approve_clean_referrals" boolean DEFAULT false NOT NULL,
	"referrals_per_credit" integer DEFAULT 2 NOT NULL,
	"credits_per_reward" integer DEFAULT 1 NOT NULL,
	"weekly_referrals_for_continuous" integer DEFAULT 2 NOT NULL,
	"allowed_durations_days" jsonb DEFAULT '[1,4,7,30]'::jsonb NOT NULL,
	"fixed_duration_requires_credit" boolean DEFAULT false NOT NULL,
	"max_fixed_sites_without_referral" integer DEFAULT 2 NOT NULL,
	"daily_site_limit_per_user" integer DEFAULT 3 NOT NULL,
	"monthly_site_limit_per_user" integer DEFAULT 12 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tx_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "platform_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_state_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reward_type" text NOT NULL,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"applied_to_site_id" integer,
	"transaction_id" integer,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_rewards_referral_id_unique" UNIQUE("referral_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" integer NOT NULL,
	"referred_user_id" integer NOT NULL,
	"referral_code_used" text NOT NULL,
	"purpose" text DEFAULT 'creation_credit' NOT NULL,
	"target_site_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_channel" text DEFAULT 'telegram_start_link' NOT NULL,
	"ip_hash" text,
	"suspicion_reason" text,
	"reviewed_by_admin_id" integer,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "referrals_referred_user_id_unique" UNIQUE("referred_user_id"),
	CONSTRAINT "chk_no_self_referral" CHECK ("referrals"."referrer_user_id" <> "referrals"."referred_user_id")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"event_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"actor_identifier" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_analytics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"devices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"browsers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"referrers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer,
	"user_id" integer NOT NULL,
	"catbox_url" text NOT NULL,
	"provider" text DEFAULT 'catbox' NOT NULL,
	"asset_role" text DEFAULT 'gallery' NOT NULL,
	"caption" text,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_site_assets_size" CHECK ("site_assets"."file_size_bytes" > 0 AND "site_assets"."file_size_bytes" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "site_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"sender_name" text NOT NULL,
	"recipient_name" text NOT NULL,
	"headline" text NOT NULL,
	"subheadline" text,
	"main_message" text NOT NULL,
	"final_surprise_text" text,
	"event_date" text,
	"theme_colors" jsonb NOT NULL,
	"components_config" jsonb NOT NULL,
	"music_track" text DEFAULT 'none' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_data_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" integer,
	"event_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_expirations" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"auto_stopped_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_expirations_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "site_referral_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"required_weekly_count" integer DEFAULT 2 NOT NULL,
	"completed_in_window" integer DEFAULT 0 NOT NULL,
	"window_start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_end_at" timestamp with time zone NOT NULL,
	"is_paused_for_shortfall" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp with time zone,
	"last_resumed_at" timestamp with time zone,
	"manual_override_by_admin_id" integer,
	CONSTRAINT "site_referral_requirements_site_id_unique" UNIQUE("site_id"),
	CONSTRAINT "chk_required_weekly" CHECK ("site_referral_requirements"."required_weekly_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"user_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"template_version_id" integer NOT NULL,
	"pinned_version" text NOT NULL,
	"title" text NOT NULL,
	"duration_mode" text NOT NULL,
	"duration_days" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_showcase" boolean DEFAULT false NOT NULL,
	"manual_override_until" timestamp with time zone,
	"views_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sites_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "system_metrics_hourly" (
	"id" serial PRIMARY KEY NOT NULL,
	"hour" text NOT NULL,
	"api_requests" integer DEFAULT 0 NOT NULL,
	"site_creations" integer DEFAULT 0 NOT NULL,
	"referrals" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"primary_domain" text DEFAULT 'https://lovecraft.app' NOT NULL,
	"github_owner" text DEFAULT 'elsayedhasaneisa1-collab' NOT NULL,
	"github_repo" text DEFAULT 'LOVECRAFT' NOT NULL,
	"github_branch" text DEFAULT 'main' NOT NULL,
	"github_sync_enabled" boolean DEFAULT true NOT NULL,
	"last_github_sync_at" timestamp with time zone,
	"catbox_endpoint" text DEFAULT 'https://catbox.moe/user/api.php' NOT NULL,
	"max_upload_mb" integer DEFAULT 8 NOT NULL,
	"allowed_image_mimes" jsonb DEFAULT '["image/jpeg","image/png","image/webp","image/gif"]'::jsonb NOT NULL,
	"api_rate_limit_per_min" integer DEFAULT 60 NOT NULL,
	"login_max_attempts" integer DEFAULT 5 NOT NULL,
	"login_lockout_minutes" integer DEFAULT 15 NOT NULL,
	"last_backup_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_deliveries" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"lease" text NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"pending_view" jsonb,
	"delivered_at" timestamp with time zone,
	"touched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"emoji" text NOT NULL,
	"description_ar" text NOT NULL,
	"cover_image" text NOT NULL,
	"accent_color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "template_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_group" text NOT NULL,
	"variant_key" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"description_ar" text NOT NULL,
	"github_path" text NOT NULL,
	"config_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supports_lite_mode" boolean DEFAULT true NOT NULL,
	"requires_3d" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"version" text NOT NULL,
	"changelog" text DEFAULT 'Initial verified release' NOT NULL,
	"github_commit_sha" text,
	"config_snapshot" jsonb NOT NULL,
	"schema_snapshot" jsonb NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"description_ar" text NOT NULL,
	"preview_image" text NOT NULL,
	"github_path" text NOT NULL,
	"github_repo" text DEFAULT 'elsayedhasaneisa1-collab/LOVECRAFT' NOT NULL,
	"current_version" text DEFAULT '1.0.0' NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"credit_cost" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"experience_type" text NOT NULL,
	"default_config" jsonb NOT NULL,
	"fields_schema" jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compatibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_templates_credit_cost" CHECK ("templates"."credit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ban_type" text NOT NULL,
	"reason" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"banned_by_admin_id" integer,
	"unbanned_by_admin_id" integer,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"unbanned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"reserved_balance" integer DEFAULT 0 NOT NULL,
	"qualified_referrals_progress" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"sites_created_today" integer DEFAULT 0 NOT NULL,
	"sites_created_month" integer DEFAULT 0 NOT NULL,
	"last_daily_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_monthly_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_user_credits_balance_nonneg" CHECK ("user_credits"."balance" >= 0),
	CONSTRAINT "chk_user_credits_reserved_nonneg" CHECK ("user_credits"."reserved_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token" text NOT NULL,
	"current_screen" text DEFAULT 'main_menu' NOT NULL,
	"wizard_step" text,
	"draft_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_message_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"username" text,
	"first_name" text NOT NULL,
	"last_name" text,
	"language_code" text DEFAULT 'ar' NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by_user_id" integer,
	"account_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_user_id_unique" UNIQUE("telegram_user_id"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "visit_marks" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"visitor_hash" text NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"visitor_hash" text NOT NULL,
	"device_type" text DEFAULT 'desktop' NOT NULL,
	"browser_family" text DEFAULT 'other' NOT NULL,
	"referrer" text,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_applied_to_site_id_sites_id_fk" FOREIGN KEY ("applied_to_site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_target_site_id_sites_id_fk" FOREIGN KEY ("target_site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_reviewed_by_admin_id_admin_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_analytics_daily" ADD CONSTRAINT "site_analytics_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_data" ADD CONSTRAINT "site_data_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_expirations" ADD CONSTRAINT "site_expirations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_referral_requirements" ADD CONSTRAINT "site_referral_requirements_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_referral_requirements" ADD CONSTRAINT "site_referral_requirements_manual_override_by_admin_id_admin_users_id_fk" FOREIGN KEY ("manual_override_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_category_id_template_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."template_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_banned_by_admin_id_admin_users_id_fk" FOREIGN KEY ("banned_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_unbanned_by_admin_id_admin_users_id_fk" FOREIGN KEY ("unbanned_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_marks" ADD CONSTRAINT "visit_marks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_created" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_admin" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_expires" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_revoked" ON "admin_sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_admin_users_role" ON "admin_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_credit_tx_user_created" ON "credit_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_tx_type" ON "credit_transactions" USING btree ("tx_type");--> statement-breakpoint
CREATE INDEX "idx_referral_rewards_user" ON "referral_rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_referrer_status" ON "referrals" USING btree ("referrer_user_id","status","purpose");--> statement-breakpoint
CREATE INDEX "idx_referrals_status" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_events_created" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_security_events_severity" ON "security_events" USING btree ("severity","is_resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_site_analytics_day" ON "site_analytics_daily" USING btree ("site_id","day");--> statement-breakpoint
CREATE INDEX "idx_site_analytics_day" ON "site_analytics_daily" USING btree ("day");--> statement-breakpoint
CREATE INDEX "idx_site_assets_site" ON "site_assets" USING btree ("site_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_site_assets_user" ON "site_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_site_assets_orphan" ON "site_assets" USING btree ("created_at") WHERE "site_assets"."site_id" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_site_data_site" ON "site_data" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_site_events_site_created" ON "site_events" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_site_expirations_expires" ON "site_expirations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_site_ref_req_window" ON "site_referral_requirements" USING btree ("window_end_at","is_paused_for_shortfall");--> statement-breakpoint
CREATE INDEX "idx_sites_user_status" ON "sites" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_sites_status" ON "sites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sites_showcase" ON "sites" USING btree ("is_showcase");--> statement-breakpoint
CREATE INDEX "idx_sites_template" ON "sites" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_sites_created_at" ON "sites" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_system_metrics_hour" ON "system_metrics_hourly" USING btree ("hour");--> statement-breakpoint
CREATE INDEX "idx_telegram_pending_chat" ON "telegram_deliveries" USING btree ("chat_id","lease_until") WHERE "telegram_deliveries"."delivered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_telegram_delivery_retention" ON "telegram_deliveries" USING btree ("touched_at");--> statement-breakpoint
CREATE INDEX "idx_template_categories_sort" ON "template_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_component_group_variant" ON "template_components" USING btree ("component_group","variant_key");--> statement-breakpoint
CREATE INDEX "idx_template_components_group" ON "template_components" USING btree ("component_group","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_template_version" ON "template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "idx_template_versions_template" ON "template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_templates_category_pub" ON "templates" USING btree ("category_id","is_published","sort_order");--> statement-breakpoint
CREATE INDEX "idx_templates_featured" ON "templates" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_user_bans_user_active" ON "user_bans" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_user_bans_expires" ON "user_bans" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_last_active" ON "users" USING btree ("last_active_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_visit_mark" ON "visit_marks" USING btree ("site_id","visitor_hash","day");--> statement-breakpoint
CREATE INDEX "idx_visit_marks_created" ON "visit_marks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_visits_site_date" ON "visits" USING btree ("site_id","visited_at");--> statement-breakpoint
CREATE INDEX "idx_visits_date" ON "visits" USING btree ("visited_at");