import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { authenticateAdminLogin, attachAdminSessionCookie } from "@/lib/admin-auth";
import { getClientIp, verifySameOrigin } from "@/lib/security";

const LoginSchema = z.object({
  identifier: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "طلب غير مصرح." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "صيغة الطلب غير صالحة." }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور." },
      { status: 400 }
    );
  }

  await ensurePlatformSeeded();

  const result = await authenticateAdminLogin({
    identifier: parsed.data.identifier,
    password: parsed.data.password,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      {
        status: result.status,
        headers: result.retryAfterSec
          ? { "Retry-After": String(result.retryAfterSec) }
          : undefined,
      }
    );
  }

  const res = NextResponse.json({
    ok: true,
    admin: result.admin,
    csrfToken: result.csrfToken,
  });
  attachAdminSessionCookie(res, result.rawToken, result.expiresAt, req);
  return res;
}
