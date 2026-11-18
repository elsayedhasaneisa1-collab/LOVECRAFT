import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db, siteAnalyticsDaily, sites, visitMarks, visits } from "@/db";

export interface VisitEvent {
  siteId: number;
  visitorHash: string;
  day: string;
  device: string;
  browser: string;
  referrer: string;
}

const FLUSH_THRESHOLD = 40;
const FLUSH_INTERVAL_MS = 5_000;

let buffer: VisitEvent[] = [];
let scheduled: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

export function pendingVisitCount(): number {
  return buffer.length;
}

/**
 * Records a visit without touching the database on the request path.
 * The request never waits for analytics writes; they are batched and flushed afterwards.
 */
export function recordVisit(event: VisitEvent): void {
  buffer.push(event);
  if (buffer.length >= FLUSH_THRESHOLD) {
    void flushVisits();
  } else if (!scheduled) {
    scheduled = setTimeout(() => {
      scheduled = null;
      void flushVisits();
    }, FLUSH_INTERVAL_MS);
    // Never keep the process alive only for analytics.
    scheduled.unref?.();
  }
  try {
    // Vercel can freeze the function as soon as all response work is complete.
    // Returning the flush promise keeps it tracked without delaying the page response.
    after(() => flushVisits());
  } catch {
    // Outside a request scope the interval timer already covers the flush.
  }
}

function mergeCounters(target: Record<string, number>, key: string): Record<string, number> {
  if (!key) return target;
  target[key] = (target[key] ?? 0) + 1;
  return target;
}

/**
 * Flushes buffered analytics in a fixed number of statements, regardless of batch size.
 */
export async function flushVisits(): Promise<void> {
  // A pending flush must finish before a new one starts, otherwise events that arrive
  // during the flush would be dropped.
  if (flushing) {
    await flushing;
    if (!buffer.length) return;
  }
  if (!buffer.length) return;
  if (scheduled) {
    clearTimeout(scheduled);
    scheduled = null;
  }

  flushing = (async () => {
    const batch = buffer.splice(0, buffer.length);
    if (!batch.length) return;
    if (buffer.length) {
      // More events arrived while this batch was in flight: schedule another pass.
      if (!scheduled) {
        scheduled = setTimeout(() => {
          scheduled = null;
          void flushVisits();
        }, 0);
        scheduled.unref?.();
      }
    }

    try {
      // 1. One statement for the whole batch: a visit only counts as unique when the mark is new.
      const insertedMarks = await db
        .insert(visitMarks)
        .values(
          batch.map((event) => ({
            siteId: event.siteId,
            visitorHash: event.visitorHash,
            day: event.day,
          }))
        )
        .onConflictDoNothing()
        .returning({ siteId: visitMarks.siteId, day: visitMarks.day });

      const uniqueBySiteDay = new Map<string, number>();
      for (const mark of insertedMarks) {
        const key = `${mark.siteId}|${mark.day}`;
        uniqueBySiteDay.set(key, (uniqueBySiteDay.get(key) ?? 0) + 1);
      }

      // 2. One statement per site+day group, merging counters inside PostgreSQL.
      const groups = new Map<
        string,
        {
          siteId: number;
          day: string;
          views: number;
          uniques: number;
          devices: Record<string, number>;
          browsers: Record<string, number>;
          referrers: Record<string, number>;
        }
      >();

      for (const event of batch) {
        const key = `${event.siteId}|${event.day}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            siteId: event.siteId,
            day: event.day,
            views: 0,
            uniques: 0,
            devices: {},
            browsers: {},
            referrers: {},
          };
          groups.set(key, group);
        }
        group.views += 1;
        group.devices = mergeCounters(group.devices, event.device);
        group.browsers = mergeCounters(group.browsers, event.browser);
        group.referrers = mergeCounters(group.referrers, event.referrer);
      }
      for (const [key, count] of uniqueBySiteDay) {
        const group = groups.get(key);
        if (group) group.uniques = count;
      }

      const groupList = Array.from(groups.values());
      if (groupList.length) {
        const rows = groupList.map((group) => sql`(${group.siteId}, ${group.day}, ${group.views}, ${group.uniques}, ${JSON.stringify(group.devices)}::jsonb, ${JSON.stringify(group.browsers)}::jsonb, ${JSON.stringify(group.referrers)}::jsonb)`);
        await db.execute(sql`
          INSERT INTO site_analytics_daily (site_id, day, views, unique_visitors, devices, browsers, referrers)
          VALUES ${sql.join(rows, sql`, `)}
          ON CONFLICT (site_id, day) DO UPDATE SET
            views = site_analytics_daily.views + EXCLUDED.views,
            unique_visitors = site_analytics_daily.unique_visitors + EXCLUDED.unique_visitors,
            devices = COALESCE((
              SELECT jsonb_object_agg(e.key, COALESCE(site_analytics_daily.devices ->> e.key, '0')::int + e.value::int)
              FROM jsonb_each(EXCLUDED.devices) AS e(key, value)
            ), site_analytics_daily.devices),
            browsers = COALESCE((
              SELECT jsonb_object_agg(e.key, COALESCE(site_analytics_daily.browsers ->> e.key, '0')::int + e.value::int)
              FROM jsonb_each(EXCLUDED.browsers) AS e(key, value)
            ), site_analytics_daily.browsers),
            referrers = COALESCE((
              SELECT jsonb_object_agg(e.key, COALESCE(site_analytics_daily.referrers ->> e.key, '0')::int + e.value::int)
              FROM jsonb_each(EXCLUDED.referrers) AS e(key, value)
            ), site_analytics_daily.referrers),
            updated_at = NOW()
        `);
      }

      // 3. Raw event rows stay short-lived for breakdowns; retention prunes them on schedule.
      await db.insert(visits).values(
        batch.map((event) => ({
          siteId: event.siteId,
          visitorHash: event.visitorHash,
          deviceType: event.device,
          browserFamily: event.browser,
          referrer: event.referrer ? event.referrer.slice(0, 200) : null,
        }))
      );

      // 4. Lifetime counters are incremented in one statement per affected site.
      const perSite = new Map<number, number>();
      for (const event of batch) {
        perSite.set(event.siteId, (perSite.get(event.siteId) ?? 0) + 1);
      }
      for (const [siteId, count] of perSite) {
        await db
          .update(sites)
          .set({ viewsCount: sql`${sites.viewsCount} + ${count}` })
          .where(sql`${sites.id} = ${siteId}`);
      }
    } catch {
      // Analytics must never surface an error to a visitor.
    } finally {
      flushing = null;
    }
  })();

  return flushing;
}
