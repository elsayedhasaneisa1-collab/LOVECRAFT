import { sql } from "drizzle-orm";
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
  removed.orphanAssets = await countRows(
    sql`DELETE FROM site_assets WHERE site_id IS NULL AND created_at < NOW() - (${policy.orphanAssetDays} * INTERVAL '1 day')`
  );

  return removed;
}
