"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  MoveHorizontal,
  Sparkles,
} from "lucide-react";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mode: "dark" | "light";
}

export interface SiteImageItem {
  url: string;
  caption: string;
  role?: string;
}

// ============================================================================
// 1. TYPOGRAPHY ENGINE (8 distinct styles)
// ============================================================================
export function ThemedHeading({
  text,
  variant,
  colors,
  liteMode = false,
  className = "",
}: {
  text: string;
  variant: string;
  colors: ThemeColors;
  liteMode?: boolean;
  className?: string;
}) {
  const [typedLen, setTypedLen] = useState(variant === "typewriter" && !liteMode ? 0 : text.length);

  useEffect(() => {
    if (variant !== "typewriter" || liteMode) {
      setTypedLen(text.length);
      return;
    }
    setTypedLen(0);
    const id = window.setInterval(() => {
      setTypedLen((prev) => {
        if (prev >= text.length) {
          window.clearInterval(id);
          return prev;
        }
        return prev + 1;
      });
    }, 45);
    return () => window.clearInterval(id);
  }, [text, variant, liteMode]);

  const base = `font-bold leading-tight tracking-tight ${className}`;

  switch (variant) {
    case "typewriter":
      return (
        <h1 className={base}>
          <span>{text.slice(0, typedLen)}</span>
          {!liteMode && typedLen < text.length && (
            <span
              className="mr-1 inline-block h-[0.9em] w-[3px] animate-pulse align-middle"
              style={{ backgroundColor: colors.primary }}
            />
          )}
        </h1>
      );

    case "glow":
      return (
        <h1
          className={base}
          style={{
            textShadow: `0 0 28px ${colors.primary}66, 0 0 60px ${colors.accent}33`,
          }}
        >
          {text}
        </h1>
      );

    case "3d-text":
      return (
        <h1
          className={base}
          style={{
            textShadow: `0 2px 0 ${colors.primary}88, 0 5px 0 ${colors.primary}44, 0 14px 28px rgba(0,0,0,0.45)`,
          }}
        >
          {text}
        </h1>
      );

    case "gradient-text":
      return (
        <h1
          className={`${base} bg-clip-text text-transparent`}
          style={{
            backgroundImage: `linear-gradient(135deg, ${colors.text} 10%, ${colors.primary} 55%, ${colors.accent} 100%)`,
          }}
        >
          {text}
        </h1>
      );

    case "cinematic-text":
      return (
        <h1 className={`${base} font-extrabold leading-[1.22]`}>
          <span className="block">{text}</span>
          <span
            aria-hidden="true"
            className="mx-auto mt-4 block h-[2px] w-24 rounded-full opacity-80"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
            }}
          />
        </h1>
      );

    case "split-text":
      return (
        <h1 className={`${base} flex flex-wrap justify-center gap-x-2.5 gap-y-1`}>
          {text.split(" ").map((word, idx) => (
            <span
              key={`${word}-${idx}`}
              className="inline-block transition-transform duration-500"
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              {word}
            </span>
          ))}
        </h1>
      );

    case "animated-headings":
      return (
        <h1 className={`${base} relative inline-block`}>
          <span>{text}</span>
          <span
            aria-hidden="true"
            className="mt-2 block h-1 w-full rounded-full"
            style={{
              backgroundImage: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.secondary})`,
            }}
          />
        </h1>
      );

    case "reveal":
    default:
      return <h1 className={`${base} lc-fade-up`}>{text}</h1>;
  }
}

// ============================================================================
// 2. BUTTON ENGINE (10 distinct styles with touch/mouse/keyboard support)
// ============================================================================
export function ThemedButton({
  children,
  variant,
  colors,
  onClick,
  type = "button",
  className = "",
  liteMode = false,
}: {
  children: React.ReactNode;
  variant: string;
  colors: ThemeColors;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  liteMode?: boolean;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isLight = colors.mode === "light";

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (variant !== "magnetic" || liteMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.22;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.22;
    setOffset({ x, y });
  };

  const base =
    "group relative inline-flex cursor-pointer items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]";

  switch (variant) {
    case "glass":
      return (
        <button
          type={type}
          onClick={onClick}
          className={`${base} rounded-2xl border backdrop-blur-xl hover:-translate-y-0.5 ${
            isLight
              ? "border-stone-900/15 bg-stone-900/90 text-white shadow-lg"
              : "border-white/20 bg-white/12 text-white shadow-xl hover:bg-white/20"
          } ${className}`}
        >
          {children}
        </button>
      );

    case "neon":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            borderColor: colors.primary,
            boxShadow: `0 0 22px ${colors.primary}66, inset 0 0 12px ${colors.primary}33`,
            backgroundColor: `${colors.primary}22`,
          }}
          className={`${base} rounded-xl border-2 text-white hover:brightness-125 ${className}`}
        >
          {children}
        </button>
      );

    case "3d":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            backgroundColor: colors.primary,
            boxShadow: `0 6px 0 ${colors.secondary}99, 0 12px 24px ${colors.primary}44`,
          }}
          className={`${base} rounded-2xl text-white hover:-translate-y-0.5 active:translate-y-1 ${className}`}
        >
          {children}
        </button>
      );

    case "animated":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            backgroundImage: `linear-gradient(120deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
          }}
          className={`${base} overflow-hidden rounded-full text-white shadow-xl hover:shadow-2xl ${className}`}
        >
          <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
        </button>
      );

    case "svg-icons":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{ backgroundColor: colors.primary }}
          className={`${base} rounded-xl text-white shadow-lg hover:brightness-110 ${className}`}
        >
          <span>{children}</span>
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </button>
      );

    case "magnetic":
      return (
        <button
          type={type}
          onClick={onClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setOffset({ x: 0, y: 0 })}
          style={{
            backgroundColor: colors.primary,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          }}
          className={`${base} rounded-full text-white shadow-xl ${className}`}
        >
          {children}
        </button>
      );

    case "floating":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            backgroundColor: colors.primary,
            boxShadow: `0 18px 38px -8px ${colors.primary}88`,
          }}
          className={`${base} rounded-full text-white hover:-translate-y-1 ${className}`}
        >
          {children}
        </button>
      );

    case "minimal":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{ borderColor: colors.text, color: colors.text }}
          className={`${base} rounded-lg border hover:opacity-80 ${className}`}
        >
          {children}
        </button>
      );

    case "interactive":
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
          }}
          className={`${base} rounded-2xl text-white shadow-lg ring-2 ring-white/20 hover:scale-[1.03] ${className}`}
        >
          <Sparkles className="h-4 w-4" />
          <span>{children}</span>
        </button>
      );

    case "gradient":
    default:
      return (
        <button
          type={type}
          onClick={onClick}
          style={{
            backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            boxShadow: `0 12px 30px -6px ${colors.primary}66`,
          }}
          className={`${base} rounded-2xl text-white hover:-translate-y-0.5 hover:brightness-110 ${className}`}
        >
          {children}
        </button>
      );
  }
}

// ============================================================================
// 3. BACKGROUND ENGINE (12 distinct designs with deterministic particles)
// ============================================================================
export function BackgroundLayer({
  variant,
  colors,
  liteMode = false,
}: {
  variant: string;
  colors: ThemeColors;
  liteMode?: boolean;
}) {
  // Deterministic coordinates so SSR & CSR always match cleanly
  const items = useMemo(
    () =>
      Array.from({ length: liteMode ? 10 : 28 }, (_, i) => ({
        id: i,
        left: ((i * 37 + 13) % 96) + 2,
        top: ((i * 53 + 7) % 94) + 3,
        size: (i % 4) + 2,
        delay: (i % 7) * 0.8,
        duration: 6 + (i % 6) * 1.6,
      })),
    [liteMode]
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base ambient wash tailored per background type */}
      {variant === "space" && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 20% 20%, ${colors.primary}38 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, ${colors.accent}30 0%, transparent 50%)`,
          }}
        />
      )}
      {variant === "golden" && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 0%, #f59e0b36 0%, transparent 60%), radial-gradient(circle at 85% 85%, #fbbf2424 0%, transparent 45%)`,
          }}
        />
      )}
      {variant === "nature" && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 75% 15%, ${colors.accent}2e 0%, transparent 55%), radial-gradient(ellipse at 15% 85%, ${colors.primary}26 0%, transparent 55%)`,
          }}
        />
      )}
      {(variant === "gradient" ||
        variant === "animated-gradient" ||
        variant === "glassmorphism" ||
        variant === "video") && (
        <>
          <div
            className={`absolute -top-32 -right-24 h-96 w-96 rounded-full blur-3xl ${
              !liteMode && variant === "animated-gradient" ? "lc-slow-float" : ""
            }`}
            style={{ backgroundColor: `${colors.primary}30` }}
          />
          <div
            className={`absolute -bottom-32 -left-24 h-96 w-96 rounded-full blur-3xl ${
              !liteMode && variant === "animated-gradient" ? "lc-slow-float" : ""
            }`}
            style={{ backgroundColor: `${colors.accent}26`, animationDelay: "2s" }}
          />
        </>
      )}

      {/* Stars / Space / Golden dust */}
      {(variant === "stars" || variant === "space" || variant === "golden") &&
        items.map((p) => (
          <span
            key={p.id}
            className={!liteMode ? "animate-pulse rounded-full" : "rounded-full"}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: variant === "golden" ? "#fde68a" : "#ffffff",
              opacity: 0.45,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration * 0.6}s`,
            }}
          />
        ))}

      {/* Particles / Snow */}
      {(variant === "particles" || variant === "snow") &&
        items.map((p) => (
          <span
            key={p.id}
            className={`rounded-full ${!liteMode ? "lc-drift" : ""}`}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size + 2}px`,
              height: `${p.size + 2}px`,
              backgroundColor: variant === "snow" ? "#ffffff" : colors.accent,
              opacity: variant === "snow" ? 0.55 : 0.35,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}

      {/* Floating Hearts (exclusively for romantic sites, NEVER on /admin!) */}
      {variant === "floating-hearts" &&
        items.slice(0, liteMode ? 6 : 16).map((p) => (
          <span
            key={p.id}
            className={!liteMode ? "lc-drift select-none" : "select-none"}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              fontSize: `${10 + p.size * 3}px`,
              color: colors.primary,
              opacity: 0.24,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration + 2}s`,
            }}
          >
            ♥
          </span>
        ))}
    </div>
  );
}

// ============================================================================
// 4. HERO ENGINE (10 distinct layouts)
// ============================================================================
export function HeroBlock({
  variant,
  typographyVariant,
  buttonVariant,
  colors,
  recipientName,
  senderName,
  headline,
  subheadline,
  eventDate,
  coverImage,
  onPrimaryAction,
  liteMode = false,
}: {
  variant: string;
  typographyVariant: string;
  buttonVariant: string;
  colors: ThemeColors;
  recipientName: string;
  senderName: string;
  headline: string;
  subheadline?: string | null;
  eventDate?: string | null;
  coverImage: string;
  onPrimaryAction: () => void;
  liteMode?: boolean;
}) {
  const isLight = colors.mode === "light";

  // Split Screen Hero
  if (variant === "split-screen") {
    return (
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pt-20 pb-14 lg:grid-cols-12 lg:pt-28">
        <div className="space-y-6 text-right lg:col-span-7">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
            style={{ borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}15` }}
          >
            <span>إهداء خاص إلى {recipientName}</span>
            {eventDate && <span className="opacity-70">• {eventDate}</span>}
          </div>
          <ThemedHeading
            text={headline}
            variant={typographyVariant}
            colors={colors}
            liteMode={liteMode}
            className="text-3xl sm:text-5xl lg:text-6xl"
          />
          {subheadline && (
            <p className="max-w-xl text-base leading-relaxed opacity-80 sm:text-lg">{subheadline}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <ThemedButton
              variant={buttonVariant}
              colors={colors}
              onClick={onPrimaryAction}
              liteMode={liteMode}
            >
              ابدأ التجربة التفاعلية
            </ThemedButton>
            <span className="text-sm opacity-65">— {senderName}</span>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div
            className="relative overflow-hidden rounded-3xl border shadow-2xl"
            style={{ borderColor: `${colors.primary}40` }}
          >
            <img
              src={coverImage}
              alt={headline}
              className="aspect-[4/5] w-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute right-5 bottom-5 left-5 text-white">
              <p className="text-xs opacity-80">{recipientName}</p>
              <p className="text-sm font-semibold">{senderName}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Full Image Background Hero
  if (variant === "image-bg" || variant === "video") {
    return (
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6">
        <div className="relative min-h-[72vh] overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
          <img
            src={coverImage}
            alt={headline}
            className={`absolute inset-0 h-full w-full object-cover ${
              variant === "video" && !liteMode ? "scale-105 transition-transform duration-1000" : ""
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
          {variant === "video" && (
            <div className="absolute top-5 right-5 flex items-center gap-2 rounded-full bg-black/50 px-3.5 py-1 text-[11px] tracking-widest text-white/85 uppercase backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              CINEMA FRAME
            </div>
          )}
          <div className="relative z-10 flex min-h-[72vh] flex-col items-center justify-end px-6 pb-14 text-center text-white sm:px-12">
            <p className="mb-3 text-xs font-medium tracking-wide uppercase opacity-80">
              {recipientName} • {senderName}
            </p>
            <ThemedHeading
              text={headline}
              variant={typographyVariant}
              colors={{ ...colors, text: "#ffffff", mode: "dark" }}
              liteMode={liteMode}
              className="max-w-3xl text-3xl sm:text-5xl lg:text-6xl"
            />
            {subheadline && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-lg">
                {subheadline}
              </p>
            )}
            <div className="mt-8">
              <ThemedButton
                variant={buttonVariant}
                colors={colors}
                onClick={onPrimaryAction}
                liteMode={liteMode}
              >
                اكتشف التفاصيل
              </ThemedButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Glass / Neon / 3D / Countdown / Minimal / Parallax / Cinematic centered compositions
  const cardClasses =
    variant === "glass"
      ? `rounded-[2rem] border p-8 sm:p-14 backdrop-blur-2xl shadow-2xl ${
          isLight ? "border-stone-900/10 bg-white/75" : "border-white/15 bg-white/[0.05]"
        }`
      : variant === "neon"
      ? "rounded-[2rem] border-2 p-8 sm:p-14 backdrop-blur-xl"
      : variant === "3d"
      ? `rounded-[2rem] border p-8 sm:p-14 backdrop-blur-xl shadow-2xl ${
          isLight ? "border-stone-900/10 bg-white/80" : "border-white/12 bg-black/30"
        }`
      : "py-6";

  return (
    <section className="relative z-10 mx-auto max-w-4xl px-5 pt-20 pb-14 text-center sm:pt-28">
      <div
        className={cardClasses}
        style={
          variant === "neon"
            ? {
                borderColor: `${colors.primary}99`,
                boxShadow: `0 0 50px -12px ${colors.primary}88, inset 0 0 30px ${colors.accent}22`,
              }
            : undefined
        }
      >
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{
            borderColor: `${colors.primary}50`,
            backgroundColor: `${colors.primary}14`,
          }}
        >
          <span>{recipientName}</span>
          <span aria-hidden="true" className="opacity-40">
            •
          </span>
          <span className="opacity-80">{senderName}</span>
        </div>

        <ThemedHeading
          text={headline}
          variant={typographyVariant}
          colors={colors}
          liteMode={liteMode}
          className="mx-auto max-w-3xl text-3xl sm:text-5xl lg:text-6xl"
        />

        {subheadline && (
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed opacity-80 sm:text-lg">
            {subheadline}
          </p>
        )}

        {variant === "countdown" && eventDate && (
          <div
            className="mx-auto mt-6 inline-flex items-center gap-3 rounded-2xl border px-5 py-2.5 font-mono text-sm"
            style={{ borderColor: `${colors.accent}55`, backgroundColor: `${colors.accent}14` }}
          >
            <span className="opacity-70">التاريخ المميز:</span>
            <strong className="tracking-wider">{eventDate}</strong>
          </div>
        )}

        <div className="mt-9 flex justify-center">
          <ThemedButton
            variant={buttonVariant}
            colors={colors}
            onClick={onPrimaryAction}
            liteMode={liteMode}
          >
            استكشف اللحظة
          </ThemedButton>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 5. GALLERY ENGINE (9 distinct layouts including Before/After & Lightbox)
// ============================================================================
export function BeforeAfterSlider({
  beforeImg,
  afterImg,
  primaryColor,
}: {
  beforeImg: SiteImageItem;
  afterImg: SiteImageItem;
  primaryColor: string;
}) {
  const [percent, setPercent] = useState(50);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const updateFromClientX = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(95, Math.max(5, raw)));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div
        ref={boxRef}
        dir="ltr"
        onPointerDown={(e) => updateFromClientX(e.clientX)}
        onPointerMove={(e) => {
          if (e.buttons === 1) updateFromClientX(e.clientX);
        }}
        className="relative aspect-[16/10] w-full cursor-ew-resize touch-none overflow-hidden rounded-3xl border border-white/15 shadow-2xl select-none"
      >
        <img src={afterImg.url} alt={afterImg.caption} className="h-full w-full object-cover" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        >
          <img src={beforeImg.url} alt={beforeImg.caption} className="h-full w-full object-cover" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${percent}%` }}
        >
          <span
            style={{ backgroundColor: primaryColor }}
            className="absolute top-1/2 -left-5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-xl"
          >
            <MoveHorizontal className="h-4 w-4" />
          </span>
        </div>
        <span className="absolute top-4 left-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-md">
          البداية
        </span>
        <span className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-md">
          اليوم
        </span>
      </div>
      <input
        type="range"
        min={5}
        max={95}
        value={Math.round(percent)}
        onChange={(e) => setPercent(Number(e.target.value))}
        aria-label="شريط المقارنة بين الصورتين"
        className="sr-only"
      />
    </div>
  );
}

export function GalleryBlock({
  variant,
  images,
  colors,
}: {
  variant: string;
  images: SiteImageItem[];
  colors: ThemeColors;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => ((i ?? 0) + 1) % images.length);
      if (e.key === "ArrowRight")
        setLightboxIdx((i) => ((i ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, images.length]);

  if (images.length === 0) return null;

  const paddedImages =
    images.length >= 3
      ? images
      : [
          ...images,
          { url: "/images/gallery-memories-1.jpg", caption: "لحظة مختارة" },
          { url: "/images/gallery-memories-2.jpg", caption: "ذكرى خالدة" },
        ].slice(0, 3);

  return (
    <section className="relative z-10 mx-auto max-w-5xl px-5 py-14">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-wider uppercase opacity-60">معرض اللحظات</p>
        <h2 className="mt-1.5 text-2xl font-bold sm:text-3xl">لقطات تحكي الحكاية</h2>
      </div>

      {/* 1. Carousel */}
      {variant === "carousel" && (
        <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl">
          <img
            src={paddedImages[slideIdx % paddedImages.length]!.url}
            alt={paddedImages[slideIdx % paddedImages.length]!.caption}
            loading="lazy"
            className="aspect-[16/10] w-full object-cover transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
          <div className="absolute right-6 bottom-5 left-6 flex items-center justify-between text-white">
            <p className="text-sm font-medium">
              {paddedImages[slideIdx % paddedImages.length]!.caption}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="الصورة السابقة"
                onClick={() =>
                  setSlideIdx((s) => (s - 1 + paddedImages.length) % paddedImages.length)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="الصورة التالية"
                onClick={() => setSlideIdx((s) => (s + 1) % paddedImages.length)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Before / After Slider */}
      {variant === "before-after" && (
        <BeforeAfterSlider
          beforeImg={paddedImages[0]!}
          afterImg={paddedImages[1]!}
          primaryColor={colors.primary}
        />
      )}

      {/* 3. Polaroid Memory Gallery */}
      {variant === "memory-gallery" && (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {paddedImages.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setLightboxIdx(i)}
              style={{ transform: `rotate(${i % 2 === 0 ? -1.8 : 1.8}deg)` }}
              className="group cursor-pointer rounded-xl bg-white p-3.5 pb-6 text-right text-stone-800 shadow-2xl transition-all duration-300 hover:rotate-0 hover:scale-[1.03]"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-stone-100">
                <img
                  src={img.url}
                  alt={img.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="mt-3.5 text-sm font-semibold text-stone-700">{img.caption}</p>
            </button>
          ))}
        </div>
      )}

      {/* 4. 3D Perspective Gallery */}
      {variant === "3d-gallery" && (
        <div className="grid gap-6 sm:grid-cols-3" style={{ perspective: "1200px" }}>
          {paddedImages.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setLightboxIdx(i)}
              style={{
                transform:
                  i === 0 ? "rotateY(-8deg)" : i === 2 ? "rotateY(8deg)" : "translateZ(18px)",
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/15 shadow-2xl transition-transform duration-500 hover:rotate-0 hover:scale-[1.03]"
            >
              <img
                src={img.url}
                alt={img.caption}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="absolute right-4 bottom-4 left-4 text-right text-sm font-medium text-white">
                {img.caption}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 5. Cinematic 21:9 Strip */}
      {variant === "cinematic" && (
        <div className="space-y-6">
          {paddedImages.slice(0, 3).map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              onClick={() => setLightboxIdx(i)}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
            >
              <img
                src={img.url}
                alt={img.caption}
                loading="lazy"
                className="aspect-[21/9] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <p className="absolute right-6 bottom-4 text-sm font-medium text-white">
                {img.caption}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 6. Grid / Masonry / Parallax / Fullscreen */}
      {!["carousel", "before-after", "memory-gallery", "3d-gallery", "cinematic"].includes(
        variant
      ) && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {paddedImages.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-white/12 shadow-xl ${
                variant === "parallax" && i === 1 ? "sm:translate-y-6" : ""
              }`}
            >
              <img
                src={img.url}
                alt={img.caption}
                loading="lazy"
                className={`${
                  variant === "masonry" && i === 0 ? "aspect-[4/5]" : "aspect-[4/3]"
                } w-full object-cover transition-transform duration-500 group-hover:scale-105`}
              />
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent p-4 text-white opacity-90">
                <span className="text-xs font-medium">{img.caption}</span>
                <Maximize2 className="h-4 w-4 opacity-75" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard-accessible Lightbox */}
      {lightboxIdx !== null && paddedImages[lightboxIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIdx(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg"
        >
          <button
            type="button"
            aria-label="إغلاق المعاينة"
            onClick={() => setLightboxIdx(null)}
            className="absolute top-5 left-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl"
          >
            <img
              src={paddedImages[lightboxIdx]!.url}
              alt={paddedImages[lightboxIdx]!.caption}
              className="max-h-[78vh] w-auto rounded-2xl object-contain"
            />
            <p className="mt-3 text-center text-sm text-white/85">
              {paddedImages[lightboxIdx]!.caption}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
