import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The database connection is created lazily.
 * A missing DATABASE_URL must not break `next build`: the pool is only opened when a
 * query actually runs, and every route that touches the database is rendered on demand.
 */

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const poolMax = intFromEnv("DATABASE_POOL_MAX", process.env.VERCEL ? 2 : 20, 1, 60);
const idleTimeout = intFromEnv("DATABASE_IDLE_TIMEOUT_MS", process.env.VERCEL ? 5000 : 30_000, 2_000, 300_000);
const connectionTimeout = intFromEnv("DATABASE_CONNECTION_TIMEOUT_MS", 5_000, 1_000, 30_000);
const statementTimeout = intFromEnv("DATABASE_STATEMENT_TIMEOUT_MS", 15_000, 1_000, 120_000);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let poolInstance: Pool | null = globalForDb.__arenaNextJsPostgresqlPool ?? null;

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to reach the database.");
  }
  const pooled = process.env.DATABASE_POOLER_MODE === "transaction" || new URL(databaseUrl).hostname.endsWith(".pooler.supabase.com");
  return new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: idleTimeout,
    connectionTimeoutMillis: connectionTimeout,
    query_timeout: statementTimeout + 1000,
    // Managed poolers can reject the PostgreSQL startup 'options' argument.
    ...(pooled ? {} : { options: `-c statement_timeout=${statementTimeout} -c idle_in_transaction_session_timeout=${statementTimeout * 2} -c lock_timeout=5000` }),
    application_name: "lovecraft-app",
  });
}

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = createPool();
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__arenaNextJsPostgresqlPool = poolInstance;
    }
  }
  return poolInstance;
}

export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const instance = getPool();
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in getPool();
  },
});

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

/**
 * Drizzle is resolved on first use as well, so importing a route never opens a connection
 * and a missing DATABASE_URL cannot break `next build`.
 */
type Database = ReturnType<typeof drizzle<typeof schema>>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const transactionScope = new AsyncLocalStorage<Transaction>();

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = transactionScope.getStore() ?? getDb();
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export * from "./schema";

// Share one connection/transaction across the Telegram engine and any nested DB operations.
// Nested db.transaction calls use Drizzle savepoints. Keep HTTP calls outside this scope.
export function inDatabaseTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction((tx) => transactionScope.run(tx, () => work(tx)));
}

/**
 * Runs a transaction and retries only on transient contention (serialization failure or deadlock).
 */
export async function withTransaction<T>(
  handler: (tx: Transaction) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(handler);
    } catch (error) {
      const code = (error as { code?: string }).code;
      const retryable = code === "40001" || code === "40P01";
      if (!retryable || attempt >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 80));
    }
  }
}

export function poolStats() {
  const configured = Boolean(process.env.DATABASE_URL);
  if (!configured || !poolInstance) {
    return {
      max: poolMax,
      total: 0,
      idle: 0,
      waiting: 0,
      statementTimeoutMs: statementTimeout,
      idleTimeoutMs: idleTimeout,
      connected: false,
    };
  }
  return {
    max: poolMax,
    total: poolInstance.totalCount,
    idle: poolInstance.idleCount,
    waiting: poolInstance.waitingCount,
    statementTimeoutMs: statementTimeout,
    idleTimeoutMs: idleTimeout,
    connected: true,
  };
}
