import { NextRequest, NextResponse } from "next/server";
import { evaluateAllSitesValidity } from "@/lib/site-engine";
import { getAdminSession } from "@/lib/admin-auth";
import { constantTimeCompare, getClientIp, logAdminAudit, logSecurityEvent } from "@/lib/security";

export const maxDuration = 60;

async function handleEvaluate(req: NextRequest) {
  const ip = getClientIp(req);
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET?.trim();

  let authorizedAdminId: number | null = null;
  let authorizedByCron = false;

  if (cronSecret && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (constantTimeCompare(token, cronSecret)) {
      authorizedByCron = true;
    }
  }

  if (!authorizedByCron) {
    const admin = await getAdminSession();
    if (admin) {
      authorizedAdminId = admin.id;
    }
  }

  if (!authorizedByCron && !authorizedAdminId) {
    await logSecurityEvent({
      severity: "medium",
      eventType: "unauthorized_cron_attempt",
      ipAddress: ip,
    });
    return NextResponse.json({ error: "غير مصرح بتشغيل مهمة الفحص." }, { status: 401 });
  }

  const summary = await evaluateAllSitesValidity();

  if (authorizedAdminId) {
    await logAdminAudit({
      adminId: authorizedAdminId,
      action: "run_site_validity_evaluation",
      targetType: "system_cron",
      metadata: summary,
      ipAddress: ip,
    });
  }

  return NextResponse.json({
    ok: true,
    evaluatedAt: new Date().toISOString(),
    ...summary,
  });
}

export async function GET(req: NextRequest) {
  return handleEvaluate(req);
}

export async function POST(req: NextRequest) {
  return handleEvaluate(req);
}
