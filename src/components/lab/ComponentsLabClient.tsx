"use client";

import React, { useState } from "react";
import {
  COMPONENT_LIBRARY,
  THEME_PALETTES,
  getComponentsByGroup,
  getPaletteById,
  type ComponentGroupKey,
} from "@/lib/components-catalog";
import {
  BackgroundLayer,
  ThemedButton,
  ThemedHeading,
} from "@/components/renderer/ComponentShowcaseBlocks";

const GROUP_TABS: Array<{ key: ComponentGroupKey; labelAr: string; count: number }> = [
  { key: "hero", labelAr: "Hero — الواجهات", count: 10 },
  { key: "background", labelAr: "Background — الخلفيات", count: 12 },
  { key: "typography", labelAr: "Typography — الخطوط", count: 8 },
  { key: "button", labelAr: "Buttons — الأزرار", count: 10 },
  { key: "gallery", labelAr: "Gallery — المعارض", count: 9 },
  { key: "section", labelAr: "Sections — الأقسام", count: 16 },
  { key: "effect", labelAr: "Effects — المؤثرات", count: 10 },
];

export function ComponentsLabClient() {
  const [activeGroup, setActiveGroup] = useState<ComponentGroupKey>("hero");
  const [paletteId, setPaletteId] = useState("crimson-velvet");
  const [bgVariant, setBgVariant] = useState("stars");
  const [typoVariant, setTypoVariant] = useState("gradient-text");
  const [btnVariant, setBtnVariant] = useState("3d");
  const [clicks,setClicks]=useState(0);
  const [liteMode, setLiteMode] = useState(false);

  const pal = getPaletteById(paletteId);
  const colors = {
    primary: pal.primary,
    secondary: pal.secondary,
    accent: pal.accent,
    background: pal.background,
    surface: pal.surface,
    text: pal.text,
    mode: pal.mode,
  };

  const groupItems = getComponentsByGroup(activeGroup);

  return (
    <div className="space-y-12">
      {/* Live Interactive Component Composer */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div
          style={{ backgroundColor: colors.background, color: colors.text }}
          className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/15 p-8 text-center shadow-2xl lg:col-span-7"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden [transform:translateZ(0)]">
            <BackgroundLayer variant={bgVariant} colors={colors} liteMode={liteMode} />
          </div>
          <div className="relative z-10 max-w-lg space-y-5">
            <span
              className="inline-block rounded-full border px-3.5 py-1 text-[11px] font-semibold"
              style={{ borderColor: `${colors.primary}60`, backgroundColor: `${colors.primary}18` }}
            >
              معاينة حية لتركيب العناصر
            </span>
            <ThemedHeading
              text="لحظاتك تتحول إلى تجربة بصرية خالدة"
              variant={typoVariant}
              colors={colors}
              liteMode={liteMode}
              className="text-2xl sm:text-4xl"
            />
            <p className="text-xs opacity-75 sm:text-sm">
              BG: {bgVariant} • Typography: {typoVariant} • Button: {btnVariant}
            </p>
            <div className="pt-2">
              <ThemedButton variant={btnVariant} colors={colors} liteMode={liteMode} onClick={()=>setClicks(c=>c+1)}>
                {clicks ? `تم التفاعل · ${clicks}` : "جرب تفاعل الزر الآن"}
              </ThemedButton>
            </div>
          </div>
        </div>

        {/* Mixer Controls */}
        <div className="space-y-4 rounded-3xl border border-white/10 bg-zinc-900/60 p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">أداة الدمج الفوري</h2>
            <button
              type="button"
              onClick={() => setLiteMode((v) => !v)}
              className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium ${
                liteMode ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-zinc-300"
              }`}
            >
              {liteMode ? "الوضع الخفيف: مفعّل" : "الوضع الخفيف: إيقاف"}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">لوحة الألوان</label>
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_PALETTES.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaletteId(p.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs transition ${
                    paletteId === p.id
                      ? "border-white bg-white/15 text-white"
                      : "border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: p.primary }}
                  />
                  <span className="truncate">{p.nameAr}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <label className="space-y-1">
              <span className="text-zinc-400">الخلفية</span>
              <select
                value={bgVariant}
                onChange={(e) => setBgVariant(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-2 text-white"
              >
                {getComponentsByGroup("background").map((c) => (
                  <option key={c.variantKey} value={c.variantKey}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-zinc-400">الخط</span>
              <select
                value={typoVariant}
                onChange={(e) => setTypoVariant(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-2 text-white"
              >
                {getComponentsByGroup("typography").map((c) => (
                  <option key={c.variantKey} value={c.variantKey}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-zinc-400">الزر</span>
              <select
                value={btnVariant}
                onChange={(e) => setBtnVariant(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-2 text-white"
              >
                {getComponentsByGroup("button").map((c) => (
                  <option key={c.variantKey} value={c.variantKey}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-500">
            إجمالي العناصر القابلة للتركيب: {COMPONENT_LIBRARY.length} تصميماً مستقلاً مع الحفاظ
            الكامل على الفوتر العالمي الموحد والتجاوب عبر كافة المتصفحات.
          </p>
        </div>
      </div>

      {/* Full Component Catalog Explorer */}
      <div className="space-y-6">
        <div className="flex flex-wrap justify-center gap-2">
          {GROUP_TABS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setActiveGroup(g.key)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeGroup === g.key
                  ? "border-white bg-white text-zinc-950"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25"
              }`}
            >
              {g.labelAr} ({g.count})
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupItems.map((item) => (
            <div
              key={`${item.componentGroup}-${item.variantKey}`}
              onClick={() => {
                if (item.componentGroup === "background") setBgVariant(item.variantKey);
                if (item.componentGroup === "typography") setTypoVariant(item.variantKey);
                if (item.componentGroup === "button") setBtnVariant(item.variantKey);
              }}
              className="cursor-pointer rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-5 transition hover:border-amber-400/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span dir="ltr" className="font-mono text-xs font-semibold text-amber-300">
                  {item.nameEn}
                </span>
                {item.requires3d && (
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                    3D Engine
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-sm font-bold text-white">{item.nameAr}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{item.descriptionAr}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
