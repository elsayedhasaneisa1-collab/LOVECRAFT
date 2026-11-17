import { NextRequest, NextResponse } from "next/server";
import { getCachedPublicCatalog } from "@/lib/catalog-cache";
import { checkRateLimit, getClientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pub-templates:${ip}`, 90, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "طلبات كثيرة جداً، يرجى الانتظار قليلاً." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // Served from the shared catalogue cache: identical data for every reader,
  // so PostgreSQL is not queried per request.
  const catalog = await getCachedPublicCatalog();

  const url = req.nextUrl;
  const categorySlug = (url.searchParams.get("category") || "").trim();
  const tier = (url.searchParams.get("tier") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const includeComponents = url.searchParams.get("components") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(48, Math.max(6, Number(url.searchParams.get("pageSize")) || 18));

  const matching = catalog.templates.filter((template) => {
    if (categorySlug && categorySlug !== "all" && template.categorySlug !== categorySlug) {
      return false;
    }
    if (tier === "free" || tier === "premium") {
      if (template.tier !== tier) return false;
    }
    if (q) {
      const haystack = `${template.nameAr} ${template.nameEn} ${template.descriptionAr}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const total = matching.length;
  const rows = matching.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json(
    {
      categories: catalog.categories,
      templates: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      ...(includeComponents ? { components: catalog.components } : {}),
    },
    {
      headers: {
        // Safe to share briefly between visitors; the catalogue changes rarely.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
