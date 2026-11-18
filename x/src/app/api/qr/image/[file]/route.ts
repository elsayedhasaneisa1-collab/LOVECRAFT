import { NextRequest, NextResponse } from "next/server";
import { readQrCard } from "@/lib/qr-card-url";
import { renderQrPng, themeForCategory } from "@/lib/qr-studio";
import { checkRateLimit, getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const card = readQrCard((await params).file);
  if (!card) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!checkRateLimit(`qr-image:${getClientIp(req)}`, 45, 60_000).allowed) {
    return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
  const png = await renderQrPng({ url: card.url, theme: themeForCategory(card.theme), title: "Your Moments. Your Website.", handle: card.handle });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400", "Vercel-CDN-Cache-Control": "public, s-maxage=604800",
    },
  });
}
