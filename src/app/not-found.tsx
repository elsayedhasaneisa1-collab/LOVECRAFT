import React from "react";
import Link from "next/link";
import { DeveloperFooter } from "@/components/shared/DeveloperFooter";

export default function NotFoundPage() {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col justify-between bg-[#08070d] text-zinc-100"
    >
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span dir="ltr" className="font-mono text-sm text-amber-400">
          404
        </span>
        <h1 className="mt-2 text-2xl font-extrabold">الصفحة أو الموقع غير موجود</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          تأكد من صحة الرابط، أو أنشئ موقعك المستقل الجديد خلال دقائق عبر LOVECRAFT BOT.
        </p>
        <div className="mt-7 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-white px-6 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-zinc-200"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/templates"
            className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            تصفح القوالب
          </Link>
        </div>
      </main>
      <DeveloperFooter mode="dark" />
    </div>
  );
}
