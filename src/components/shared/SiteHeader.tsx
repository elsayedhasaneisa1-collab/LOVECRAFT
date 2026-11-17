import React from "react";
import Link from "next/link";
import { Send } from "lucide-react";

interface SiteHeaderProps {
  activePath?: "/" | "/templates" | "/components-lab" | "/bot";
}

export function SiteHeader({ activePath = "/" }: SiteHeaderProps) {
  const links: Array<{ href: "/" | "/templates" | "/components-lab" | "/bot"; label: string }> = [
    { href: "/", label: "الرئيسية" },
    { href: "/templates", label: "القوالب" },
    { href: "/components-lab", label: "عناصر التصميم" },
    { href: "/bot", label: "البوت التفاعلي" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#08070d]/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/30 bg-gradient-to-br from-rose-500/20 to-amber-500/20">
            <span className="h-3 w-3 rotate-45 bg-gradient-to-tr from-rose-400 to-amber-300" />
          </span>
          <div className="leading-none">
            <span
              dir="ltr"
              className="block text-sm font-bold tracking-[0.2em] text-white uppercase"
            >
              LOVECRAFT
            </span>
            <span dir="ltr" className="mt-0.5 hidden text-[10px] text-zinc-400 sm:block">
              Your Moments. Your Website.
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = activePath === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/templates"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white md:hidden"
          >
            القوالب
          </Link>
          <Link
            href="/bot"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-rose-600 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/40 transition hover:brightness-110"
          >
            <Send className="h-3.5 w-3.5" />
            <span>اصنع موقعك</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
