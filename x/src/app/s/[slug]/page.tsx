import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, PauseCircle, EyeOff } from "lucide-react";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { loadRenderedSiteBySlug } from "@/lib/site-engine";
import { detectDeviceAndBrowser } from "@/lib/security";
import { MultiTenantSiteRenderer } from "@/components/renderer/MultiTenantSiteRenderer";
import { DeveloperFooter } from "@/components/shared/DeveloperFooter";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  await ensurePlatformSeeded();
  const result = await loadRenderedSiteBySlug(slug);
  if (result.state !== "active") {
    return {
      title: "LOVECRAFT BOT — موقع غير متاح حالياً",
    };
  }
  return {
    title: `${result.payload.title} | LOVECRAFT`,
    description: `${result.payload.headline} — إهداء خاص إلى ${result.payload.recipientName}`,
  };
}

export default async function GeneratedSitePage({ params }: PageProps) {
  const { slug } = await params;
  await ensurePlatformSeeded();

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "127.0.0.1";
  const ua = hdrs.get("user-agent");
  const { deviceType, browserFamily } = detectDeviceAndBrowser(ua);

  const loaded = await loadRenderedSiteBySlug(slug, {
    ip,
    deviceType,
    browserFamily,
    referrer: hdrs.get("referer"),
  });

  if (loaded.state === "not_found") {
    notFound();
  }

  if (loaded.state === "unavailable") {
    const reasonMeta: Record<string, { title: string; desc: string; icon: React.ReactNode }> = {
      expired: {
        title: "انتهت مدة عرض هذا الموقع",
        desc: "انتهت فترة الصلاحية المحددة لهذا الموقع وتوقف تلقائياً من السيرفر.",
        icon: <Clock className="h-10 w-10 text-amber-400" />,
      },
      paused_referrals: {
        title: "هذا الموقع المستمر متوقف مؤقتاً",
        desc: "سيعود الموقع للعمل تلقائياً فور استكمال صاحبه لشرط الإحالات الأسبوعية في LOVECRAFT BOT.",
        icon: <PauseCircle className="h-10 w-10 text-indigo-400" />,
      },
      paused_admin: {
        title: "الموقع متوقف مؤقتاً",
        desc: "تم إيقاف عرض هذا الموقع مؤقتاً من قِبل إدارة المنصة.",
        icon: <PauseCircle className="h-10 w-10 text-zinc-400" />,
      },
      hidden: {
        title: "هذا الموقع مخفي حالياً",
        desc: "قام صاحب الموقع بإخفائه مؤقتاً من العرض العام.",
        icon: <EyeOff className="h-10 w-10 text-zinc-400" />,
      },
    };
    const meta = reasonMeta[loaded.reason] ?? reasonMeta.expired!;

    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col justify-between bg-zinc-950 text-zinc-100"
      >
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
            {meta.icon}
          </div>
          <h1 className="text-2xl font-bold">{meta.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{meta.desc}</p>
          <Link
            href="/"
            className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            اصنع موقعك عبر LOVECRAFT BOT
          </Link>
        </main>
        <DeveloperFooter mode="dark" />
      </div>
    );
  }

  return <MultiTenantSiteRenderer site={loaded.payload} />;
}
