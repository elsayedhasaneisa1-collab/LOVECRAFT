import type { NextRequest } from "next/server";

function asOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const u = new URL(value.trim());
    if (u.username || u.password || !["https:", "http:"].includes(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function websiteOrigin(req: NextRequest): string {
  const automatic = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const configured = asOrigin(process.env.NEXT_PUBLIC_APP_URL) || asOrigin(automatic ? `https://${automatic}` : undefined);
  if (configured && (!process.env.VERCEL || configured.startsWith("https://"))) return configured;
  const protocol = req.headers.get("x-forwarded-proto") === "https" ? "https:" : req.nextUrl.protocol;
  return asOrigin(`${protocol}//${req.headers.get("host") || req.nextUrl.host}`) || req.nextUrl.origin;
}
