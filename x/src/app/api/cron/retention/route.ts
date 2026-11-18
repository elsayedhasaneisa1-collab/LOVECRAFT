import { NextRequest, NextResponse } from "next/server";
import { runRetention, retentionPolicy } from "@/lib/retention";
import { flushVisits } from "@/lib/analytics";
import { getAdminSession } from "@/lib/admin-auth";
import { constantTimeCompare, getClientIp, logAdminAudit, logSecurityEvent } from "@/lib/security";

export const maxDuration = 60;

/**
 * Housekeeping job: prunes data that is no longer needed and flushes buffered analytics.
 * Run it daily. The credit ledger and referral history are intentionally never pruned.
 */
async function handle(req: NextRequest) {
  const ip = getClientIp(req);
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") || "";
  let adminId: number | null = null;

  if (secret && header.startsWith("Bearer ") && constantTimeCompare(header.slice(7).trim(), secret)) {
    // authorised by cron secret
  } else {
    const admin = await getAdminSession();
    if (!admin) {
      await logSecurityEvent({
        severity: "low",
        eventType: "unauthorized_retention_attempt",
        ipAddress: ip,
      });
      return NextResponse.json({ error: "غير مصرح بتشغيل مهمة التنظيف." }, { status: 401 });
    }
    adminId = admin.id;
  }

  // Flush pending analytics first so the retention window covers every recorded event.
  await flushVisits();

  const policy = retentionPolicy();
  const removed = await runRetention(policy);

  if (adminId) {
    await logAdminAudit({
      adminId,
      action: "retention_cleanup_executed",
      targetType: "system_maintenance",
      metadata: removed,
      ipAddress: ip,
    });
  }

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    policy,
    removed,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
