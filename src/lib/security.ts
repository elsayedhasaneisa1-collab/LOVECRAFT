import crypto from "crypto";
import type { NextRequest } from "next/server";
import { db, securityEvents, adminAuditLogs } from "@/db";

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateReferralCode(telegramUserId: number): string {
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const shortId = String(Math.abs(telegramUserId)).slice(-4);
  return `REF${shortId}${suffix}`;
}

export function generateSiteSlug(prefix = "moment"): string {
  const cleanPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 18) || "moment";
  const rand = crypto.randomBytes(4).toString("hex");
  return `${cleanPrefix}-${rand}`;
}

/**
 * Strip HTML tags, script payloads, control chars, and attempts to spoof/hide developer footer.
 */
export function sanitizePlainText(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeHexColor(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeSafeImageUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.startsWith("/images/") && !trimmed.includes("..")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "files.catbox.moe" || parsed.hostname === "catbox.moe")
    ) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Remove any illegal footer override keys from user custom_fields
 */
export function sanitizeCustomFields(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const blockedKeys = new Set([
    "hideFooter",
    "removeFooter",
    "customFooter",
    "footerText",
    "footerUrl",
    "developerCredit",
    "disableDeveloperFooter",
    "__proto__",
    "constructor",
    "prototype",
  ]);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (blockedKeys.has(k) || k.toLowerCase().includes("footer")) continue;
    if (typeof v === "string") {
      clean[k] = sanitizePlainText(v, 1500);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      clean[k] = v;
    } else if (typeof v === "boolean") {
      clean[k] = v;
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 20).map((item) => {
        if (typeof item === "string") return sanitizePlainText(item, 500);
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const obj: Record<string, unknown> = {};
          for (const [ik, iv] of Object.entries(item as Record<string, unknown>)) {
            if (typeof iv === "string") obj[ik] = sanitizePlainText(iv, 500);
            else if (typeof iv === "number" && Number.isFinite(iv)) obj[ik] = iv;
            else if (typeof iv === "boolean") obj[ik] = iv;
            else if (Array.isArray(iv)) {
              obj[ik] = iv.slice(0, 6).map((s) => sanitizePlainText(s, 200));
            }
          }
          return obj;
        }
        return "";
      });
    }
  }
  return clean;
}

export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export function detectDeviceAndBrowser(userAgent: string | null): {
  deviceType: "mobile" | "tablet" | "desktop";
  browserFamily: string;
} {
  const ua = (userAgent || "").toLowerCase();
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";
  if (/ipad|tablet|playbook|silk/.test(ua)) deviceType = "tablet";
  else if (/mobi|android|iphone|ipod/.test(ua)) deviceType = "mobile";

  let browserFamily = "other";
  if (ua.includes("samsungbrowser")) browserFamily = "samsung";
  else if (ua.includes("opr/") || ua.includes("opera")) browserFamily = "opera";
  else if (ua.includes("edg/")) browserFamily = "edge";
  else if (ua.includes("firefox") || ua.includes("fxios")) browserFamily = "firefox";
  else if (ua.includes("chrome") || ua.includes("crios")) browserFamily = "chrome";
  else if (ua.includes("safari")) browserFamily = "safari";

  return { deviceType, browserFamily };
}

// In-memory sliding-window rate limiter
interface RateBucket {
  timestamps: number[];
}

const globalRateStore = globalThis as typeof globalThis & {
  __lovecraftRateMap?: Map<string, RateBucket>;
};

const rateMap = globalRateStore.__lovecraftRateMap ?? new Map<string, RateBucket>();
globalRateStore.__lovecraftRateMap = rateMap;

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = rateMap.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateMap.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.timestamps.push(now);
  rateMap.set(key, bucket);

  // Periodic cleanup to prevent memory growth
  if (rateMap.size > 5000) {
    for (const [k, b] of rateMap.entries()) {
      if (b.timestamps.every((t) => t <= cutoff)) rateMap.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterSec: 0,
  };
}

export function verifySameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) return true; // Non-browser/same-origin requests without Origin header verified by CSRF token
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function logSecurityEvent(params: {
  severity: "low" | "medium" | "high" | "critical";
  eventType: string;
  ipAddress?: string;
  userAgent?: string | null;
  actorIdentifier?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      severity: params.severity,
      eventType: params.eventType,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ? params.userAgent.slice(0, 300) : null,
      actorIdentifier: params.actorIdentifier ?? null,
      details: params.details ?? {},
    });
  } catch {
    // Non-blocking audit sink
  }
}

export async function logAdminAudit(params: {
  adminId: number | null;
  action: string;
  targetType: string;
  targetId?: string | number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId !== undefined ? String(params.targetId) : null,
      metadata: params.metadata ?? {},
      ipAddress: params.ipAddress ?? null,
    });
  } catch {
    // Non-blocking audit sink
  }
}

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
