import { sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";

export interface RetentionPolicy {
  rawVisitDays: number;
  visitMarkDays: number;
  expiredSessionDays: number;
  resolvedSecurityDays: number;
  deletedSiteEventDays: number;
  orphanAssetDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  rawVisitDays: 7,
  visitMarkDays: 3,
  expiredSessionDays: 1,
  resolvedSecurityDays: 90,
  deletedSiteEventDays: 180,
  orphanAssetDays: 7,
};

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function retentionPolicy(): RetentionPolicy {
  return {
    rawVisitDays: readNumber(process.env.RETENTION_RAW_VISIT_DAYS, DEFAULT_RETENTION.rawVisitDays),
    visitMarkDays: readNumber(process.env.RETENTION_VISIT_MARK_DAYS, DEFAULT_RETENTION.visitMarkDays),
    expiredSessionDays: readNumber(
      process.env.RETENTION_EXPIRED_SESSION_DAYS,
      DEFAULT_RETENTION.expiredSessionDays
    ),
    resolvedSecurityDays: readNumber(
      process.env.RETENTION_RESOLVED_SECURITY_DAYS,
      DEFAULT_RETENTION.resolvedSecurityDays
    ),
    deletedSiteEventDays: readNumber(
      process.env.RETENTION_DELETED_SITE_EVENT_DAYS,
      DEFAULT_RETENTION.deletedSiteEventDays
    ),
    orphanAssetDays: readNumber(
      process.env.RETENTION_ORPHAN_ASSET_DAYS,
      DEFAULT_RETENTION.orphanAssetDays
    ),
  };
}

async function countRows(statement: ReturnType<typeof sql>): Promise<number> {
  const result = (await db.execute(statement)) as { rowCount?: number };
  return result?.rowCount ?? 0;
}

/**
 * Deletes data that is no longer needed, keeping the database small.
 * The credit ledger and referral history are financial records and are never pruned here.
 */
export async function runRetention(policy: RetentionPolicy = retentionPolicy()): Promise<
  Record<string, number>
> {
  const removed: Record<string, number> = {};

  removed.rawVisits = await countRows(
    sql`DELETE FROM visits WHERE visited_at < NOW() - (${policy.rawVisitDays} * INTERVAL '1 day')`
  );
  removed.visitMarks = await countRows(
    sql`DELETE FROM visit_marks WHERE created_at < NOW() - (${policy.visitMarkDays} * INTERVAL '1 day')`
  );
  // Telegram only retries recent updates; keep a small bounded replay window.
  removed.telegramDeliveries = await countRows(sql`
    DELETE FROM telegram_deliveries WHERE update_id IN (
      SELECT update_id FROM telegram_deliveries
      WHERE touched_at < NOW() - INTERVAL '3 days' ORDER BY touched_at LIMIT 2000
    )
  `);
  removed.userSessions = await countRows(
    sql`DELETE FROM user_sessions WHERE expires_at < NOW() - (${policy.expiredSessionDays} * INTERVAL '1 day')`
  );
  removed.adminSessions = await countRows(
    sql`DELETE FROM admin_sessions WHERE expires_at < NOW() - (${policy.expiredSessionDays} * INTERVAL '1 day')`
  );
  removed.securityEvents = await countRows(
    sql`DELETE FROM security_events WHERE created_at < NOW() - (${policy.resolvedSecurityDays} * INTERVAL '1 day') AND is_resolved = true`
  );
  removed.deletedSiteEvents = await countRows(
    sql`DELETE FROM site_events WHERE created_at < NOW() - (${policy.deletedSiteEventDays} * INTERVAL '1 day') AND site_id IN (SELECT id FROM sites WHERE status = 'deleted')`
  );
  removed.orphanAssets = await countRows(sql`
    DELETE FROM site_assets WHERE id IN (
      SELECT id FROM site_assets WHERE site_id IS NULL AND provider NOT IN ('vercel-blob','vercel-blob-deleting')
        AND created_at < NOW() - (${policy.orphanAssetDays} * INTERVAL '1 day') ORDER BY created_at LIMIT 500
    ) AND site_id IS NULL
  `);

  // Claim only abandoned uploads, not media on published sites. If Blob is temporarily unavailable,
  // the deletion markers remain for the next scheduled cleanup. Do not hold a DB connection across HTTP.
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const stale = await db.execute(sql`
      UPDATE site_assets SET provider = 'vercel-blob-deleting'
      WHERE id IN (
        SELECT id FROM site_assets WHERE site_id IS NULL AND provider IN ('vercel-blob','vercel-blob-deleting')
          AND created_at < NOW() - (${policy.orphanAssetDays} * INTERVAL '1 day') ORDER BY created_at LIMIT 100
      ) AND site_id IS NULL AND provider IN ('vercel-blob','vercel-blob-deleting') RETURNING id, catbox_url
    `);
    const candidates = stale.rows.filter((entry) => typeof entry.catbox_url === "string" &&
      /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/site-media\/[a-f0-9-]{36}\.webp$/i.test(entry.catbox_url));
    if (candidates.length) {
      const removedFromBlob = await del(candidates.map((entry) => String(entry.catbox_url)), { abortSignal: AbortSignal.timeout(7000) })
        .then(() => true, () => false);
      if (removedFromBlob) {
        removed.orphanAssets += await countRows(sql`
          DELETE FROM site_assets WHERE site_id IS NULL AND provider = 'vercel-blob-deleting'
            AND id IN (${sql.join(candidates.map((entry) => sql`${Number(entry.id)}`), sql`, `)})
        `);
      }
    }
  }

  return removed;
}
