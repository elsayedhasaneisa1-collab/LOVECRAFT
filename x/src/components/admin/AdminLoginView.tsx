"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

/**
 * Standalone Luxury Minimalist Dark Admin Login (/admin)
 * STRICT DESIGN RULE: Zero romantic imagery/icons (no hearts, roses, gifts).
 * STRICT SECURITY RULE: No public signup, no default credentials, HttpOnly session cookie.
 */
export function AdminLoginView() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!identifier.trim() || !password) {
      setError("يرجى إدخال البريد الإلكتروني أو اسم المستخدم وكلمة المرور.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "بيانات الدخول غير صحيحة.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم. يرجى المحاولة بعد لحظات.");
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#07080b] px-4 py-12 text-zinc-100 selection:bg-zinc-700"
    >
      {/* Subtle architectural ambient illumination (zero romantic motifs) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.11)_0%,rgba(7,8,11,0)_70%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40"
      />

      <div className="relative z-10 w-full max-w-[430px]">
        {/* Minimal Geometric LOVECRAFT Wordmark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] shadow-inner backdrop-blur-xl">
            <span className="h-4 w-4 rotate-45 border-[1.75px] border-zinc-200" />
          </div>
          <span
            dir="ltr"
            className="text-xs font-semibold tracking-[0.34em] text-zinc-300 uppercase"
          >
            LOVECRAFT
          </span>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-white">
            Admin Login
          </h1>
          <p className="mt-1.5 text-xs text-zinc-500">
            بوابة الإدارة المركزية المحمية — وصول المالك فقط
          </p>
        </div>

        {/* Refined Glassmorphism Login Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/55 p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-9">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="admin-identifier"
                className="block text-xs font-medium text-zinc-300"
              >
                البريد الإلكتروني أو اسم المستخدم
              </label>
              <input
                id="admin-identifier"
                name="identifier"
                type="text"
                dir="ltr"
                autoComplete="username"
                required
                disabled={loading}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@domain.com"
                className="w-full rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-left text-sm text-white placeholder-zinc-600 transition focus:border-zinc-400 focus:bg-black/65 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-password"
                className="block text-xs font-medium text-zinc-300"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/10 bg-black/45 py-3 pr-4 pl-11 text-left text-sm text-white placeholder-zinc-600 transition focus:border-zinc-400 focus:bg-black/65 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute top-1/2 left-3 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-zinc-500 transition hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ التحقق من الجلسة...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            <span>جلسة مشفّرة (HttpOnly • SameSite) مع تسجيل محاولات الدخول</span>
          </div>
        </div>
      </div>
    </div>
  );
}
