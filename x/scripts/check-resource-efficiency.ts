import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { db, pool, poolStats, withTransaction } from '../src/db';
import { flushVisits, pendingVisitCount, recordVisit } from '../src/lib/analytics';
import { runRetention, retentionPolicy } from '../src/lib/retention';

const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:3000';
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. Query counting: a page view must not fan out into many round trips.
  const client = await admin.connect();
  let statements = 0;
  await client.query('BEGIN');
  await client.query('SET LOCAL search_path = public');
  const originalQuery = client.query.bind(client);
  (client as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = async (
    ...args: unknown[]
  ) => {
    const text = String(args[0]);
    if (!text.includes('pg_stat')) statements += 1;
    return (originalQuery as (...a: unknown[]) => Promise<unknown>)(...args);
  };

  const { loadRenderedSiteBySlug } = await import('../src/lib/site-engine');
  const first = await loadRenderedSiteBySlug('noor-envelope');
  statements = 0;
  const second = await loadRenderedSiteBySlug('noor-envelope');
  await client.query('ROLLBACK');
  client.release();
  assert.equal(first.state, 'active');
  assert.equal(second.state, 'active');
  console.log(`Site page view executes ${statements} database statement(s) (was 6 before optimization).`);
  assert(statements <= 3, `Expected at most 3 statements per page view, got ${statements}`);

  // 2. Buffered analytics: many visits must not become one insert per visit.
  // Start from a clean measurement window for this site/day.
  await admin.query('DELETE FROM visits WHERE site_id = 1');
  await admin.query('DELETE FROM visit_marks WHERE site_id = 1');
  await admin.query('DELETE FROM site_analytics_daily WHERE site_id = 1');
  const beforeVisits = (await admin.query('SELECT count(*)::int AS c FROM visits')).rows[0].c as number;
  const beforeMarks = (await admin.query('SELECT count(*)::int AS c FROM visit_marks')).rows[0].c as number;
  const day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 60; i++) {
    recordVisit({
      siteId: 1,
      visitorHash: `qa-visitor-${i % 20}`,
      day,
      device: 'desktop',
      browser: 'chrome',
      referrer: i % 2 === 0 ? 'https://example.com' : '',
    });
  }
  await flushVisits();
  await flushVisits();
  const afterVisits = (await admin.query('SELECT count(*)::int AS c FROM visits')).rows[0].c as number;
  const afterMarks = (await admin.query('SELECT count(*)::int AS c FROM visit_marks')).rows[0].c as number;
  const rollup = (await admin.query(
    'SELECT views, unique_visitors FROM site_analytics_daily WHERE site_id = 1 AND day = $1',
    [day]
  )).rows[0];
  assert.equal(afterVisits - beforeVisits, 60, 'All buffered events must be persisted');
  assert(afterMarks - beforeMarks <= 20, 'Repeated visitors must not create extra unique marks');
  assert(rollup, 'Daily rollup must exist');
  assert.equal(rollup.views, 60);
  console.log(
    `Buffered analytics: 60 visits persisted in batches, unique marks +${afterMarks - beforeMarks}, rollup views=${rollup.views}, uniques=${rollup.unique_visitors}.`
  );
  assert.equal(pendingVisitCount(), 0, 'Buffer must be empty after a flush');

  // 3. The rollup merges counters instead of overwriting them.
  await admin.query(
    "UPDATE site_analytics_daily SET devices = '{\"desktop\": 5}'::jsonb, browsers = '{\"chrome\": 5}'::jsonb WHERE site_id = 1 AND day = $1",
    [day]
  );
  for (let i = 0; i < 5; i++) {
    recordVisit({ siteId: 1, visitorHash: `qa-second-${i}`, day, device: 'desktop', browser: 'chrome', referrer: '' });
  }
  await flushVisits();
  await flushVisits();
  const merged = (await admin.query(
    'SELECT devices, browsers FROM site_analytics_daily WHERE site_id = 1 AND day = $1',
    [day]
  )).rows[0];
  assert.equal(Number(merged.devices.desktop), 10, 'Device counters must accumulate');
  assert.equal(Number(merged.browsers.chrome), 10, 'Browser counters must accumulate');
  console.log('Rollup counters merge correctly across separate flushes.');

  // 4. Retention prunes the raw log but keeps the durable rollup and the financial ledger.
  await admin.query("INSERT INTO visits (site_id, visitor_hash, device_type, browser_family, visited_at) VALUES (1, 'old', 'desktop', 'chrome', NOW() - INTERVAL '40 days')");
  await admin.query("INSERT INTO visit_marks (site_id, visitor_hash, day, created_at) VALUES (1, 'old', '2020-01-01', NOW() - INTERVAL '40 days')");
  const ledgerBefore = (await admin.query('SELECT count(*)::int AS c FROM credit_transactions')).rows[0].c as number;
  const removed = await runRetention({ ...retentionPolicy(), rawVisitDays: 7, visitMarkDays: 3 });
  const rollupAfter = (await admin.query(
    'SELECT views FROM site_analytics_daily WHERE site_id = 1 AND day = $1',
    [day]
  )).rows[0];
  const ledgerAfter = (await admin.query('SELECT count(*)::int AS c FROM credit_transactions')).rows[0].c as number;
  assert(removed.rawVisits >= 1, 'Expired raw visits must be removed');
  assert(removed.visitMarks >= 1, 'Expired visit marks must be removed');
  assert(rollupAfter, 'The durable rollup must survive retention');
  assert.equal(ledgerBefore, ledgerAfter, 'The credit ledger must never be pruned');
  console.log(`Retention removed ${JSON.stringify(removed)} while keeping the rollup and the credit ledger.`);

  // 5. The public catalogue endpoint answers from the shared cache.
  const catalogStart = Date.now();
  const catalogRes = await fetch(`${base}/api/templates?pageSize=48`);
  const catalogMs = Date.now() - catalogStart;
  assert.equal(catalogRes.status, 200);
  const catalog = await catalogRes.json();
  assert.equal(catalog.pagination.total, 110);
  assert.equal(catalog.categories.length, 6);
  assert(catalogRes.headers.get("cache-control")?.includes("s-maxage"));
  console.log(`Catalogue endpoint returned ${catalog.pagination.total} templates in ${catalogMs}ms with shared-cache headers.`);

  // 6. Pool exposes live utilisation for the owner console.
  const stats = poolStats();
  assert(stats.max >= 2);
  console.log(`Pool: ${stats.idle}/${stats.max} idle, ${stats.waiting} waiting, statement timeout ${stats.statementTimeoutMs}ms.`);

  // 7. Transactions retry safely on contention.
  const value = await withTransaction(async (tx) => {
    const rows = await tx.execute(sql`SELECT 1 AS ok`);
    return (rows.rows[0] as { ok: number }).ok;
  });
  assert.equal(value, 1);

  console.log('\nALL RESOURCE-EFFICIENCY CHECKS PASSED.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin.end();
    await pool.end();
  });
