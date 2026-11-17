import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { qrCacheDir } from "@/lib/qr-studio";

export const dynamic = "force-dynamic";

const SAFE_NAME = /^qr-[a-z]+-[a-f0-9]{16}\.png$/;

/**
 * Serves a generated QR card from the cache directory.
 * The file name is validated strictly, so the route can never read outside the cache.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!SAFE_NAME.test(file)) {
    return NextResponse.json({ error: "اسم الملف غير صالح." }, { status: 400 });
  }

  const target = path.join(qrCacheDir(), file);
  try {
    const buffer = await fs.readFile(target);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "البطاقة غير موجودة." }, { status: 404 });
  }
}
