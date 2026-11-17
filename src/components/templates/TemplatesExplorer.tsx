"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Search, Send, Loader2 } from "lucide-react";

interface CategoryItem {
  id: number;
  slug: string;
  nameAr: string;
  emoji: string;
  descriptionAr: string;
  accentColor: string;
  templateCount: number;
}

interface TemplateItem {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  previewImage: string;
  version: string;
  tier: "free" | "premium";
  creditCost: number;
  experienceType: string;
  categorySlug: string;
  categoryNameAr: string;
  categoryEmoji: string;
  hero: string;
  background: string;
  gallery: string;
}

export function TemplatesExplorer({ initialCategory = "all" }: { initialCategory?: string }) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [tier, setTier] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({
        category,
        tier,
        q: query,
        page: String(page),
        pageSize: "18",
      });
      const res = await fetch(`/api/templates?${sp}`);
      if (res.ok) {
        const d = await res.json();
        setCategories(d.categories || []);
        setItems(d.templates || []);
        setTotalPages(d.pagination?.totalPages || 1);
        setTotal(d.pagination?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [category, tier, query, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-8">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCategory("all");
            setPage(1);
          }}
          className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition ${
            category === "all"
              ? "border-white bg-white text-zinc-950"
              : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25"
          }`}
        >
          جميع القوالب
        </button>
        {categories.map((c) => {
          const active = category === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                setCategory(c.slug);
                setPage(1);
              }}
              className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "border-white bg-white text-zinc-950"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25"
              }`}
            >
              <span>{c.emoji}</span> <span>{c.nameAr}</span>{" "}
              <span className="opacity-60">({c.templateCount})</span>
            </button>
          );
        })}
      </div>

      {/* Search & Tier Filter */}
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ابحث عن قالب (مثل: اعتراف بالحب، زفاف، عجلة الحظ، Portfolio)..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pr-10 pl-4 text-xs text-white placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
          aria-label="فلترة الفئة"
          className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-xs text-zinc-200"
        >
          <option value="all">الكل ({total})</option>
          <option value="free">مجاني</option>
          <option value="premium">مميز</option>
        </select>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-zinc-400">
          لا توجد قوالب مطابقة للبحث الحالي.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tpl) => (
            <article
              key={tpl.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-900/55 transition duration-300 hover:-translate-y-1 hover:border-white/20"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={tpl.previewImage}
                  alt={tpl.nameAr}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent" />
                <div className="absolute top-3 right-3 left-3 flex items-center justify-between text-[11px]">
                  <span className="rounded-full bg-black/65 px-3 py-1 font-medium text-white backdrop-blur-md">
                    {tpl.categoryEmoji} {tpl.categoryNameAr}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold backdrop-blur-md ${
                      tpl.tier === "premium"
                        ? "bg-amber-500/85 text-zinc-950"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {tpl.tier === "premium" ? "مميز" : "مجاني"}
                  </span>
                </div>
                <div className="absolute right-4 bottom-3 left-4 flex items-center justify-between text-[11px] text-zinc-300">
                  <span dir="ltr" className="font-mono opacity-80">
                    Hero: {tpl.hero} • BG: {tpl.background}
                  </span>
                  <span dir="ltr" className="font-mono opacity-70">
                    v{tpl.version}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h3 className="text-base font-bold text-white">{tpl.nameAr}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                    {tpl.descriptionAr}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2.5 pt-2">
                  <Link
                    href={`/preview/${tpl.slug}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] py-2.5 text-xs font-semibold text-zinc-100 transition hover:bg-white/10"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>معاينة حية</span>
                  </Link>
                  <Link
                    href={`/bot?template=${encodeURIComponent(tpl.slug)}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>اختيار القالب</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="cursor-pointer rounded-xl border border-white/15 px-4 py-2 text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-zinc-400">
            صفحة <strong className="text-white">{page}</strong> من {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="cursor-pointer rounded-xl border border-white/15 px-4 py-2 text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
