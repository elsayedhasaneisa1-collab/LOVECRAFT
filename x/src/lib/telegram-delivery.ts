import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db, telegramDeliveries, users, userSessions, inDatabaseTransaction } from "@/db";
import type { BotRenderResponse } from "./bot-fsm";

const leaseDurationMs = 90_000; // Longer than the Python function's 60-second runtime limit.
export type DeliveryIdentity = { updateId: number; chatId: number; lease: string };
const projectMatch = (delivery: DeliveryIdentity) => and(
  eq(telegramDeliveries.updateId, delivery.updateId),
  eq(telegramDeliveries.chatId, delivery.chatId),
  eq(telegramDeliveries.lease, delivery.lease),
);

function viewFromJson(value: unknown) {
  return value as BotRenderResponse | null;
}

export async function claimTelegramDelivery(updateId: number, chatId: number) {
  return db.transaction(async (tx) => {
    // The transaction only holds a lock while claiming a lease, never during Telegram or Blob requests.
    const locked = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${`lovecraft:telegram:${chatId}`}, 0)) as claimed`);
    if (!locked.rows[0]?.claimed) return { status: "busy" as const };
    const now = new Date();
    const [existing] = await tx.select().from(telegramDeliveries).where(eq(telegramDeliveries.updateId, updateId)).limit(1);
    if (existing?.deliveredAt) return { status: "delivered" as const };
    if (existing && (existing.chatId !== chatId || existing.leaseUntil > now)) return { status: "busy" as const };

    const [other] = await tx.select({ id: telegramDeliveries.updateId }).from(telegramDeliveries).where(and(
      eq(telegramDeliveries.chatId, chatId), isNull(telegramDeliveries.deliveredAt),
      gt(telegramDeliveries.leaseUntil, now), ne(telegramDeliveries.updateId, updateId),
    )).limit(1);
    if (other) return { status: "busy" as const };

    const lease = randomUUID();
    const leaseUntil = new Date(now.getTime() + leaseDurationMs);
    if (existing) {
      await tx.update(telegramDeliveries).set({ lease, leaseUntil, touchedAt: now }).where(eq(telegramDeliveries.updateId, updateId));
    } else {
      const inserted = await tx.insert(telegramDeliveries).values({ updateId, chatId, lease, leaseUntil }).onConflictDoNothing().returning({ id: telegramDeliveries.updateId });
      if (!inserted.length) return { status: "busy" as const };
    }
    const [panel] = await tx.select({ messageId: userSessions.lastMessageId }).from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(and(eq(users.telegramUserId, chatId), gt(userSessions.expiresAt, now)))
      .orderBy(desc(userSessions.updatedAt), desc(userSessions.id)).limit(1);
    return { status: "claimed" as const, lease, lastMessageId: panel?.messageId ?? null, view: viewFromJson(existing?.pendingView ?? null) };
  });
}

export async function readTelegramDelivery(delivery: DeliveryIdentity) {
  const [row] = await db.select({ view: telegramDeliveries.pendingView }).from(telegramDeliveries)
    .where(and(projectMatch(delivery), isNull(telegramDeliveries.deliveredAt), gt(telegramDeliveries.leaseUntil, new Date()))).limit(1);
  return row ? { view: viewFromJson(row.view) } : null;
}

export function processTelegramDelivery(delivery: DeliveryIdentity, handle: () => Promise<BotRenderResponse>) {
  return inDatabaseTransaction(async (tx) => {
    const [row] = await tx.select({ pendingView: telegramDeliveries.pendingView }).from(telegramDeliveries)
      .where(and(projectMatch(delivery), isNull(telegramDeliveries.deliveredAt), gt(telegramDeliveries.leaseUntil, new Date())))
      .limit(1).for("update");
    if (!row) return null;
    if (row.pendingView) return viewFromJson(row.pendingView);
    // Commit the wizard change and retryable reply together, before contacting Telegram.
    const view = await handle();
    await tx.update(telegramDeliveries).set({ pendingView: { ...view }, touchedAt: new Date() }).where(projectMatch(delivery));
    return view;
  });
}

export async function finishTelegramDelivery(delivery: DeliveryIdentity, messageId: number) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx.update(telegramDeliveries)
      .set({ deliveredAt: now, touchedAt: now, pendingView: null })
      .where(and(projectMatch(delivery), isNull(telegramDeliveries.deliveredAt)))
      .returning({ id: telegramDeliveries.updateId });
    if (!updated) {
      const [completed] = await tx.select({ id: telegramDeliveries.updateId }).from(telegramDeliveries)
        .where(and(projectMatch(delivery), sql`${telegramDeliveries.deliveredAt} IS NOT NULL`)).limit(1);
      return Boolean(completed);
    }
    await tx.update(userSessions).set({ lastMessageId: messageId })
      .where(eq(userSessions.id, tx.select({ id: userSessions.id }).from(userSessions)
        .innerJoin(users, eq(users.id, userSessions.userId))
        .where(eq(users.telegramUserId, delivery.chatId))
        .orderBy(desc(userSessions.updatedAt), desc(userSessions.id)).limit(1)));
    return true;
  });
}

export async function releaseTelegramDelivery(delivery: DeliveryIdentity) {
  await db.update(telegramDeliveries).set({ leaseUntil: new Date() }).where(and(projectMatch(delivery), isNull(telegramDeliveries.deliveredAt)));
}
