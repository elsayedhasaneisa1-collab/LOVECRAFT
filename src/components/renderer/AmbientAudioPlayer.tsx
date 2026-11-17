"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { MUSIC_TRACKS } from "@/lib/components-catalog";

interface AmbientAudioPlayerProps {
  trackId: string;
  primaryColor: string;
  isLight?: boolean;
  variant?: "floating" | "section";
  senderName?: string;
}

/**
 * Web Audio Harmonic Ambient Player
 * STRICT POLICY: Never auto-plays audio before explicit visitor click/tap!
 */
export function AmbientAudioPlayer({
  trackId,
  primaryColor,
  isLight = false,
  variant = "floating",
  senderName,
}: AmbientAudioPlayerProps) {
  const track = MUSIC_TRACKS.find((t) => t.id === trackId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBar, setActiveBar] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const noteIdxRef = useRef(0);

  const stopAudio = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startAudio = useCallback(() => {
    if (!track || track.notesHz.length === 0) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      const playChime = () => {
        if (!ctxRef.current || ctxRef.current.state === "closed") return;
        const now = ctx.currentTime;
        const freq = track.notesHz[noteIdxRef.current % track.notesHz.length]!;
        noteIdxRef.current += 1;
        setActiveBar((b) => (b + 1) % 16);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.055, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.5);
      };

      playChime();
      const stepMs = Math.max(420, Math.round((60_000 / Math.max(60, track.tempoBpm)) * 1.1));
      intervalRef.current = window.setInterval(playChime, stepMs);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [track]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  if (!track || track.id === "none") return null;

  const toggle = () => {
    if (isPlaying) stopAudio();
    else startAudio();
  };

  if (variant === "section") {
    const barHeights = [34, 62, 48, 82, 55, 92, 66, 44, 78, 95, 58, 72, 46, 84, 52, 40];
    return (
      <div
        className={`mx-auto max-w-2xl rounded-3xl border p-6 backdrop-blur-xl transition-all ${
          isLight
            ? "border-stone-900/10 bg-white/85 shadow-lg"
            : "border-white/12 bg-white/[0.04] shadow-2xl"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? "إيقاف المقطع الصوتي" : "تشغيل المقطع الصوتي"}
              style={{ backgroundColor: primaryColor }}
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs opacity-65">
                {senderName ? `إهداء صوتي من ${senderName}` : "مقطع موسيقي اختياري"}
              </p>
              <h4 className="text-base font-bold">{track.nameAr}</h4>
              <p className="text-xs opacity-70">{track.descriptionAr}</p>
            </div>
          </div>

          <div className="flex h-11 items-end gap-1" aria-hidden="true">
            {barHeights.map((h, i) => {
              const active = isPlaying && (i + activeBar) % 3 === 0;
              return (
                <span
                  key={i}
                  style={{
                    height: `${isPlaying ? (active ? h : Math.max(20, h * 0.45)) : 24}%`,
                    backgroundColor: primaryColor,
                    opacity: isPlaying ? (active ? 1 : 0.45) : 0.28,
                  }}
                  className="w-1.5 rounded-full transition-all duration-300"
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? "كتم الموسيقى" : `تشغيل ${track.nameAr}`}
      title={isPlaying ? "إيقاف الموسيقى" : `تشغيل: ${track.nameAr}`}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-xl transition-all hover:scale-[1.03] active:scale-95 ${
        isLight
          ? "border-stone-900/15 bg-white/85 text-stone-800 shadow-sm"
          : "border-white/15 bg-black/55 text-zinc-100 shadow-lg"
      }`}
    >
      {isPlaying ? (
        <Volume2 className="h-3.5 w-3.5" style={{ color: primaryColor }} />
      ) : (
        <VolumeX className="h-3.5 w-3.5 opacity-70" />
      )}
      <span className="hidden sm:inline">{isPlaying ? "يعمل الآن" : "تشغيل اللحن"}</span>
    </button>
  );
}
