import React from "react";
import { and, eq } from "drizzle-orm";
import { db, botSettings, templates } from "@/db";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { DeveloperFooter } from "@/components/shared/DeveloperFooter";
import { InteractiveBotClient } from "@/components/bot/InteractiveBotClient";

export const dynamic = "force-dynamic";

interface BotPageProps {
  searchParams: Promise<{ template?: string; start?: string }>;
}

export default async function BotStudioPage({ searchParams }: BotPageProps) {
  await ensurePlatformSeeded();
  const sp = await searchParams;

  const [cfg] = await db.select().from(botSettings).limit(1);
  const botUsername = cfg?.botUsername || "LoveCraftMakerBot";

  let preselectedTemplateId: number | null = null;
  if (sp.template) {
    const [found] = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.slug, sp.template), eq(templates.isPublished, true)))
      .limit(1);
    preselectedTemplateId = found?.id ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08070d] text-zinc-100">
      <SiteHeader activePath="/bot" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-2xl text-center">
          <span className="inline-block rounded-full border border-sky-400/25 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300">
            LOVECRAFT Telegram Bot
          </span>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-4xl">
            أنشئ موقعك المستقل خطوة بخطوة
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
            اختر التصنيف والقالب، خصّص الأسماء والرسائل والصور والألوان ومؤثرات 3D، واحصل فوراً على
            رابط موقعك المستقل <code dir="ltr">/s/unique-site</code> القابل للمشاركة.
          </p>
        </div>

        <InteractiveBotClient
          botUsername={botUsername}
          preselectedTemplateId={preselectedTemplateId}
          startRef={sp.start || null}
        />

        <div className="mt-6 text-center">
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            أو افتح البوت مباشرة في تطبيق Telegram (@{botUsername})
          </a>
        </div>
      </main>

      <DeveloperFooter mode="dark" accentColor="#f59e0b" />
    </div>
  );
}
