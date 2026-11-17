import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, adminSessions } from "@/db";
import { clearAdminSessionCookie, requireOwnerApi } from "@/lib/admin-auth";
import { getClientIp, logAdminAudit } from "@/lib/security";

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req, { mutate: true });
  if ("error" in auth) return auth.error;

  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.id, auth.admin.sessionId));

  await logAdminAudit({
    adminId: auth.admin.id,
    action: "admin_logout",
    targetType: "admin_session",
    targetId: auth.admin.sessionId,
    ipAddress: getClientIp(req),
  });

  const res = NextResponse.json({ ok: true });
  clearAdminSessionCookie(res);
  return res;
}
