import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, poolStats } from "@/db";
import { requireOwnerApi } from "@/lib/admin-auth";
import { retentionPolicy } from "@/lib/retention";
import { pendingVisitCount } from "@/lib/analytics";
import { getCachedPublicCatalog } from "@/lib/catalog-cache";

/**
 * Live resource footprint for the owner console.
 * Uses PostgreSQL catalogue statistics (estimates) instead of COUNT(*) full scans.
 */
export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;

  const tables = [
    "users",
    "sites",
    "site_data",
    "site_assets",
    "site_events",
    "visits",
    "visit_marks",
    "site_analytics_daily",
    "referrals",
    "referral_rewards",
    "credit_transactions",
    "user_sessions",
    "telegram_deliveries",
    "admin_sessions",
    "security_events",
    "templates",
    "template_versions",
    "template_components",
  ];

  const result = (await db.execute(sql`
    SELECT c.relname AS name,
           GREATEST(c.reltuples, 0)::bigint AS estimated_rows,
           pg_total_relation_size(c.oid) AS total_bytes,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS total_pretty,
           pg_size_pretty(pg_indexes_size(c.oid)) AS index_pretty
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY(${sql.raw(`ARRAY[${tables.map((t) => `'${t}'`).join(",")}]`)}::text[])
     ORDER BY pg_total_relation_size(c.oid) DESC
  `)) as { rows: Array<{ name: string; estimated_rows: number; total_bytes: string; total_pretty: string; index_pretty: string }> };

  const rows = result.rows ?? [];
  const totalBytes = rows.reduce((sum, row) => sum + Number(row.total_bytes), 0);

  const cache = await getCachedPublicCatalog();

  return NextResponse.json({
    pool: poolStats(),
    database: {
      totalBytes,
      totalPretty: `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
      tables: rows.map((row) => ({
        name: row.name,
        estimatedRows: Number(row.estimated_rows),
        totalBytes: Number(row.total_bytes),
        totalPretty: row.total_pretty,
        indexPretty: row.index_pretty,
      })),
    },
    retention: retentionPolicy(),
    cache: {
      catalogTemplates: cache.templates.length,
      catalogComponents: cache.components.length,
      pendingAnalyticsEvents: pendingVisitCount(),
    },
  });
}
