-- LOVECRAFT BOT — Supabase PostgreSQL Row Level Security (RLS) & Access Policies
-- Protects all 24 tables against unauthorized direct PostgREST/anon access while
-- permitting verified published template browsing and strict backend service-role operations.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'user_sessions', 'user_bans',
    'template_categories', 'templates', 'template_versions', 'template_components',
    'sites', 'site_data', 'site_assets', 'site_expirations', 'site_referral_requirements',
    'referrals', 'referral_rewards', 'user_credits', 'credit_transactions',
    'site_events', 'visits', 'bot_settings',
    'admin_users', 'admin_sessions', 'admin_audit_logs', 'security_events', 'system_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- Public read-only access ONLY to published catalog metadata (never users, credits, admin, or private sites)
DROP POLICY IF EXISTS public_read_published_categories ON public.template_categories;
CREATE POLICY public_read_published_categories
  ON public.template_categories FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS public_read_published_templates ON public.templates;
CREATE POLICY public_read_published_templates
  ON public.templates FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS public_read_active_components ON public.template_components;
CREATE POLICY public_read_active_components
  ON public.template_components FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS public_read_active_sites ON public.sites;
-- No direct public site policy: all tenant reads must pass through the server validity guard.
