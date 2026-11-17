# Resource efficiency guide

This document lists every measure that keeps the platform's database small, fast and cheap to
operate. Each item was verified by `scripts/check-resource-efficiency.ts` against a live
PostgreSQL instance.

## Connection management

- The pool size is environment-driven (`DATABASE_POOL_MAX`, default 20, allowed 2–60) instead of
  a fixed value, so serverless deployments can run many small containers without exhausting the
  database connection limit.
- `DATABASE_IDLE_TIMEOUT_MS` and `DATABASE_CONNECTION_TIMEOUT_MS` release idle connections and
  fail fast instead of letting requests queue.
- Every session carries server-side guards: `statement_timeout`, `idle_in_transaction_session_timeout`
  and `lock_timeout`. A runaway query can never hold a connection hostage.
- `src/db/index.ts` exposes `withTransaction`, which retries only genuine contention
  (serialization failure `40001` and deadlock `40P01`) and never retries business errors.

## Fewer queries per request

- A site page view executes **one** joined statement instead of six follow-up queries: expiration
  and weekly-referral state are now read through `LEFT JOIN` in the same round trip.
- The public catalogue is served from a shared cache (`src/lib/catalog-cache.ts`) with a
  five-minute revalidation window and `s-maxage` response headers, so readers never trigger a
  catalogue scan.
- The studio library and template list are cached pages (`revalidate = 300`) invalidated by the
  `template-catalog` tag when the owner publishes or edits a template.
- The bootstrap marker in `platform_state` lets a cold start skip catalogue inspection entirely,
  and seeding now uses one multi-row insert for templates and another for their pinned versions
  instead of hundreds of individual statements.

## Fewer writes per visit

- Analytics are buffered in memory (`src/lib/analytics.ts`) and flushed in batches, so a page view
  performs no write at all on the request path.
- A flush issues a fixed number of statements regardless of batch size: one insert for unique
  visitor marks, one upsert for the daily rollup, one insert for the short-lived raw log and one
  counter update per affected site.
- `visit_marks` deduplicates visitors per day, so repeat views do not inflate unique counts.
- The daily rollup (`site_analytics_daily`) keeps durable counters and merges device, browser and
  referrer breakdowns inside PostgreSQL, so dashboards read a small table instead of scanning the
  raw event log.

## Retention that keeps the database small

`/api/cron/retention` (scheduled daily) removes data that is no longer needed:

| Data | Default window | Reason |
| --- | --- | --- |
| `visits` | 7 days | Raw event log; the daily rollup keeps the history |
| `visit_marks` | 3 days | Only needed for current unique-visitor counting |
| `user_sessions`, `admin_sessions` | 1 day after expiry | Sessions are worthless once expired |
| `security_events` | 90 days (resolved only) | Keeps the audit trail, drops noise |
| `site_events` of deleted sites | 180 days | Lifecycle history of removed tenants |
| `site_assets` without a site | 7 days | Uploads abandoned before creation |

The credit ledger (`credit_transactions`) and referral history are financial records and are
**never** pruned. Every window is configurable through `RETENTION_*` environment variables.

## Indexes and statistics

- `sql/resource-efficiency.sql` adds partial indexes for the hot read paths and tunes
  `autovacuum` for the high-churn tables so they do not bloat.
- `ANALYZE` runs on the catalogue and rollup tables so the planner stays accurate.
- Indexes cover the analytics rollup, visit marks, orphaned assets, site creation dates and
  session expiry, matching the exact predicates used by the application.

## Bounded responses

- Every admin list endpoint accepts a `pageSize` and clamps it between 5 and 50 rows.
- The backup export caps each table at 5,000 rows and records the cap in the export metadata, so a
  large database cannot exhaust server memory during an export.
- Rate limiting already protects the expensive endpoints from bursts.

## Visibility

`/admin` → **النظام والأمان** shows the live footprint: database size, estimated rows per table
using PostgreSQL catalogue statistics (estimates, not `COUNT(*)` scans), index sizes, pool
utilisation, cached catalogue size and pending analytics events. The same data is available as
JSON at `/api/admin/resources`.

## Verification

```bash
npx tsx scripts/check-resource-efficiency.ts   # query/write/retention/cache measurements
npx tsx scripts/check-template-readiness.ts     # catalogue and footer integrity
npx tsx scripts/check-studio-creation.ts        # creation lifecycle without refunds
```

Measured results on the reference instance: one statement per page view, 60 buffered visits
persisted in a single batch, unique visitors deduplicated from 60 to 20, rollup counters merged
correctly, retention removing expired rows while keeping the ledger, and the catalogue answering
from cache in roughly 25 ms.
