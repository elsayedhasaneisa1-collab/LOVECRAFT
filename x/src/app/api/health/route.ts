import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await db.execute(sql`select to_regclass('public.telegram_deliveries') is not null as telegram_ready`);
    return Response.json({ ok: true, telegramSchemaReady: state.rows[0]?.telegram_ready === true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
