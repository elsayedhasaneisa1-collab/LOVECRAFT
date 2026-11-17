-- LOVECRAFT BOT — PostgreSQL resource-efficiency tuning
-- Applied on top of the Drizzle schema. Safe to re-run.

-- Keep high-churn tables from bloating: vacuum and analyse them more eagerly.
ALTER TABLE IF EXISTS public.visits SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE IF EXISTS public.visit_marks SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE IF EXISTS public.credit_transactions SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE IF EXISTS public.security_events SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.1);
ALTER TABLE IF EXISTS public.site_events SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.1);
ALTER TABLE IF EXISTS public.user_sessions SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.1);
ALTER TABLE IF EXISTS public.admin_sessions SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.1);
ALTER TABLE IF EXISTS public.site_analytics_daily SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);

-- Partial indexes keep the planner away from full scans on the hot read paths.
CREATE INDEX IF NOT EXISTS idx_sites_active_public ON public.sites (id) WHERE status = 'active' AND is_hidden = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sites_expired_window ON public.sites (id) WHERE status IN ('active', 'paused_referrals');
CREATE INDEX IF NOT EXISTS idx_credit_tx_created_only ON public.credit_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_visited_only ON public.visits (visited_at DESC);

-- Statistics refresh keeps the planner accurate on a catalogue that grows over time.
ANALYZE public.templates;
ANALYZE public.sites;
ANALYZE public.site_analytics_daily;
