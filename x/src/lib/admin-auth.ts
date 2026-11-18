import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, adminUsers, adminSessions, systemSettings } from "@/db";
import {
  verifyPassword,
  generateSecureToken,
  sha256Hex,
  getClientIp,
  checkRateLimit,
  verifySameOrigin,
  constantTimeCompare,
  logSecurityEvent,
  logAdminAudit,
} from "./security";

export const ADMIN_SESSION_COOKIE = "lc_admin_sid";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Dummy scrypt hash for constant-time defense against username enumeration
const DUMMY_PASSWORD_HASH =
  "scrypt$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export interface AuthenticatedAdmin {
  id: number;
  username: string;
  email: string;
  role: string;
  sessionId: number;
  csrfToken: string;
}

export async function getAdminSession(): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!rawToken || rawToken.length < 32) return null;

  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: adminSessions.id,
      csrfToken: adminSessions.csrfToken,
      adminId: adminUsers.id,
      username: adminUsers.username,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, now),
        eq(adminUsers.isActive, true)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.role !== "owner") return null;

  return {
    id: row.adminId,
    username: row.username,
    email: row.email,
    role: row.role,
    sessionId: row.sessionId,
    csrfToken: row.csrfToken,
  };
}

export async function requireOwnerApi(
  req: NextRequest,
  options: { mutate?: boolean } = {}
): Promise<{ admin: AuthenticatedAdmin } | { error: NextResponse }> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-api:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return {
      error: NextResponse.json(
        { error: "تم تجاوز الحد المسموح للطلبات. يرجى المحاولة لاحقاً." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      ),
    };
  }

  const admin = await getAdminSession();
  if (!admin || (admin.role !== "owner" && admin.role !== "admin")) {
    await logSecurityEvent({
      severity: "medium",
      eventType: "unauthorized_admin_api_access",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
      details: { path: req.nextUrl.pathname, method: req.method },
    });
    return {
      error: NextResponse.json({ error: "غير مصرح بالوصول." }, { status: 401 }),
    };
  }

  if (options.mutate) {
    if (!verifySameOrigin(req)) {
      await logSecurityEvent({
        severity: "high",
        eventType: "admin_csrf_origin_mismatch",
        ipAddress: ip,
        actorIdentifier: admin.username,
        details: { path: req.nextUrl.pathname },
      });
      return {
        error: NextResponse.json({ error: "طلب غير موثوق (Origin)." }, { status: 403 }),
      };
    }
    const headerCsrf = req.headers.get("x-csrf-token") || "";
    if (!headerCsrf || !constantTimeCompare(headerCsrf, admin.csrfToken)) {
      await logSecurityEvent({
        severity: "high",
        eventType: "admin_csrf_token_invalid",
        ipAddress: ip,
        actorIdentifier: admin.username,
        details: { path: req.nextUrl.pathname },
      });
      return {
        error: NextResponse.json({ error: "رمز الحماية CSRF غير صالح." }, { status: 403 }),
      };
    }
  }

  return { admin };
}

export async function authenticateAdminLogin(params: {
  identifier: string;
  password: string;
  ipAddress: string;
  userAgent: string | null;
}): Promise<
  | { ok: true; rawToken: string; csrfToken: string; expiresAt: Date; admin: { id: number; username: string; email: string; role: string } }
  | { ok: false; status: number; message: string; retryAfterSec?: number }
> {
  const genericError = "بيانات الدخول غير صحيحة. يرجى التحقق والمحاولة مجدداً.";

  // Rate limit by IP
  const rl = checkRateLimit(`admin-login:${params.ipAddress}`, 8, 10 * 60_000);
  if (!rl.allowed) {
    await logSecurityEvent({
      severity: "high",
      eventType: "admin_login_rate_limited",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      actorIdentifier: params.identifier.slice(0, 64),
    });
    return {
      ok: false,
      status: 429,
      message: "محاولات دخول متكررة. يرجى الانتظار قبل إعادة المحاولة.",
      retryAfterSec: rl.retryAfterSec,
    };
  }

  const cleanId = params.identifier.trim().toLowerCase();
  const [sys] = await db.select().from(systemSettings).limit(1);
  const maxAttempts = sys?.loginMaxAttempts ?? 5;
  const lockoutMinutes = sys?.loginLockoutMinutes ?? 15;

  const [found] = await db
    .select()
    .from(adminUsers)
    .where(or(eq(adminUsers.username, cleanId), eq(adminUsers.email, cleanId)))
    .limit(1);

  if (!found || !found.isActive) {
    // Run dummy scrypt + subtle delay so attacker cannot enumerate existing accounts
    await verifyPassword(params.password, DUMMY_PASSWORD_HASH).catch(() => false);
    await new Promise((r) => setTimeout(r, 450));
    await logSecurityEvent({
      severity: "medium",
      eventType: "admin_login_failed",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      actorIdentifier: cleanId.slice(0, 64),
      details: { reason: "unknown_or_inactive" },
    });
    return { ok: false, status: 401, message: genericError };
  }

  const now = new Date();
  if (found.lockedUntil && found.lockedUntil > now) {
    // Progressive delay without revealing whether account exists
    await new Promise((r) => setTimeout(r, 900));
    await logSecurityEvent({
      severity: "high",
      eventType: "admin_login_while_locked",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      actorIdentifier: found.username,
    });
    return {
      ok: false,
      status: 429,
      message: "محاولات دخول متكررة. يرجى الانتظار قبل إعادة المحاولة.",
    };
  }

  // Progressive delay proportional to recent failed attempts
  if (found.failedLoginAttempts > 0) {
    const delayMs = Math.min(3500, found.failedLoginAttempts * 550);
    await new Promise((r) => setTimeout(r, delayMs));
  }

  const valid = await verifyPassword(params.password, found.passwordHash);
  if (!valid) {
    const nextFailures = found.failedLoginAttempts + 1;
    const shouldLock = nextFailures >= maxAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + lockoutMinutes * 60_000)
      : null;

    await db
      .update(adminUsers)
      .set({
        failedLoginAttempts: nextFailures,
        lockedUntil,
      })
      .where(eq(adminUsers.id, found.id));

    await logSecurityEvent({
      severity: shouldLock ? "critical" : "medium",
      eventType: shouldLock ? "admin_account_locked_bruteforce" : "admin_login_failed",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      actorIdentifier: found.username,
      details: { failedAttempts: nextFailures, locked: shouldLock },
    });

    return { ok: false, status: 401, message: genericError };
  }

  // Successful login — reset failure counter & issue secure session
  const rawToken = generateSecureToken(32);
  const tokenHash = sha256Hex(rawToken);
  const csrfToken = generateSecureToken(24);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db
    .update(adminUsers)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastLoginIp: params.ipAddress,
    })
    .where(eq(adminUsers.id, found.id));

  await db.insert(adminSessions).values({
    adminId: found.id,
    tokenHash,
    csrfToken,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent ? params.userAgent.slice(0, 300) : null,
    expiresAt,
  });

  await logAdminAudit({
    adminId: found.id,
    action: "admin_login_success",
    targetType: "admin_user",
    targetId: found.id,
    ipAddress: params.ipAddress,
  });

  return {
    ok: true,
    rawToken,
    csrfToken,
    expiresAt,
    admin: {
      id: found.id,
      username: found.username,
      email: found.email,
      role: found.role,
    },
  };
}

export function attachAdminSessionCookie(
  res: NextResponse,
  rawToken: string,
  expiresAt: Date,
  req?: NextRequest
): void {
  const proto = req?.headers.get("x-forwarded-proto") || req?.nextUrl.protocol.replace(":", "");
  const isHttps = proto === "https";
  res.cookies.set(ADMIN_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
