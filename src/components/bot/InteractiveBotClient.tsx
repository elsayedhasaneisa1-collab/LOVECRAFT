"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  UserCheck,
} from "lucide-react";

interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface BotView {
  mode: "edit_text" | "edit_media";
  text: string;
  photo_url?: string | null;
  reply_markup: { inline_keyboard: InlineButton[][] };
  awaiting_input?: "none" | "text" | "photo_or_skip";
  input_placeholder?: string;
}

interface BotProfile {
  telegramUserId: number;
  firstName: string;
  username: string;
}

/**
 * Safe Telegram HTML subset renderer (<b>, <i>, <u>, <code>) — zero raw HTML injection
 */
function renderSafeTelegramHtml(html: string): React.ReactNode {
  const unescape = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  const tokens = html.split(/(<(?:b|i|u|code)>[\s\S]*?<\/(?:b|i|u|code)>)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith("<b>") && tok.endsWith("</b>")) {
      return (
        <strong key={idx} className="font-bold text-white">
          {unescape(tok.slice(3, -4))}
        </strong>
      );
    }
    if (tok.startsWith("<i>") && tok.endsWith("</i>")) {
      return (
        <em key={idx} className="italic text-zinc-300">
          {unescape(tok.slice(3, -4))}
        </em>
      );
    }
    if (tok.startsWith("<u>") && tok.endsWith("</u>")) {
      return (
        <span key={idx} className="underline underline-offset-4">
          {unescape(tok.slice(3, -4))}
        </span>
      );
    }
    if (tok.startsWith("<code>") && tok.endsWith("</code>")) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="inline-block max-w-full break-all rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-xs text-sky-300"
        >
          {unescape(tok.slice(6, -7))}
        </code>
      );
    }
    return <React.Fragment key={idx}>{unescape(tok)}</React.Fragment>;
  });
}

export function InteractiveBotClient({
  botUsername,
  preselectedTemplateId,
  startRef,
}: {
  botUsername: string;
  preselectedTemplateId?: number | null;
  startRef?: string | null;
}) {
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [view, setView] = useState<BotView | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [uploadAlert, setUploadAlert] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [showProfileBox, setShowProfileBox] = useState(false);

  // The browser never chooses a Telegram identity. Workspace ownership comes from an opaque HttpOnly session.
  useEffect(() => {
    let active=true;
    fetch('/api/studio/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
      .then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error||'تعذر فتح جلسة الاستوديو.');if(active){setProfile(data);setEditProfileName(data.firstName);}})
      .catch(err=>{if(active)setUploadAlert(err.message||'تعذر الاتصال بالاستوديو.');});
    return ()=>{active=false;};
  }, []);

  const callEngine = useCallback(
    async (
      prof: BotProfile,
      payload: {
        actionType: "start" | "callback" | "text" | "photo_uploaded";
        startPayload?: string | null;
        callbackData?: string | null;
        textInput?: string | null;
        uploadedAsset?: { assetId: number; url: string } | null;
      }
    ) => {
      setLoading(true);
      setUploadAlert(null);
      try {
        const res = await fetch("/api/bot/engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramUserId: prof.telegramUserId,
            telegramChatId: prof.telegramUserId,
            firstName: prof.firstName,
            username: prof.username,
            ...payload,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setView(data as BotView);
        } else {
          setUploadAlert(data.error || "تعذر تنفيذ العملية حالياً.");
        }
      } catch {
        setUploadAlert("انقطع الاتصال مؤقتاً، يرجى المحاولة مجدداً.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial /start or direct template launch
  useEffect(() => {
    if (!profile) return;
    if (preselectedTemplateId && preselectedTemplateId > 0) {
      callEngine(profile, {
        actionType: "callback",
        callbackData: `wiz:start:${preselectedTemplateId}`,
      });
    } else {
      callEngine(profile, {
        actionType: "start",
        startPayload: startRef || null,
      });
    }
  }, [profile, preselectedTemplateId, startRef, callEngine]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !textInput.trim() || loading) return;
    const msg = textInput.trim();
    setTextInput("");
    await callEngine(profile, { actionType: "text", textInput: msg });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    setUploadAlert(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("telegramUserId", String(profile.telegramUserId));
      form.append("telegramChatId", String(profile.telegramUserId));
      form.append("firstName", profile.firstName);

      const res = await fetch("/api/upload/catbox", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setUploadAlert(data.error || "فشل رفع الصورة إلى Catbox.");
      } else {
        await callEngine(profile, {
          actionType: "photo_uploaded",
          uploadedAsset: { assetId: data.assetId, url: data.url },
        });
      }
    } catch {
      setUploadAlert("تعذر الاتصال بخدمة رفع الصور Catbox.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSaveName = async () => {
    if (!profile || !editProfileName.trim()) return;
    try {
      const res=await fetch('/api/studio/session',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({firstName:editProfileName})});
      const d=await res.json();
      if(!res.ok){setUploadAlert(d.error);return;}
      setProfile({...profile,firstName:d.firstName});setShowProfileBox(false);
    }catch{setUploadAlert('تعذر حفظ الاسم. حاول مرة أخرى.');}
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Telegram Bot Window Frame */}
      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[#0e1621] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)]">
        {/* Telegram Chat Top Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#17212b] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-500 text-sm font-extrabold text-white shadow-md">
              LC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 dir="ltr" className="text-sm font-bold text-white">
                  @{botUsername}
                </h2>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-sky-300/80">
                استوديو الويب • جلسة مستقلة عن حساب تيليجرام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfileBox((s) => !s)}
              title="هويتك الحالية"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-200 hover:bg-white/10"
            >
              <UserCheck className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">{profile?.firstName || "..."}</span>
            </button>
            <button
              type="button"
              onClick={() => profile && callEngine(profile, { actionType: "start" })}
              title="إعادة فتح القائمة الرئيسية /start"
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Optional Identity Bar */}
        {showProfileBox && profile && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#131c26] px-5 py-3 text-xs">
            <div className="flex flex-1 items-center gap-2">
              <input
                value={editProfileName}
                onChange={(e) => setEditProfileName(e.target.value)}
                placeholder="اسمك في البوت"
                className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-white"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="cursor-pointer rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white"
              >
                حفظ
              </button>
            </div>
            <span dir="ltr" className="font-mono text-[11px] text-zinc-400">
              Workspace #{Math.abs(profile.telegramUserId).toString(36).slice(-6)}
            </span>
          </div>
        )}

        {/* Single Edited-In-Place Bot Message Canvas */}
        <div className="min-h-[430px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.06),transparent_60%)] p-4 sm:p-6">
          {!view ? (
            <div className="flex h-72 items-center justify-center text-zinc-400">
              {uploadAlert ? <div role="alert" className="p-5 text-center text-sm"><p>{uploadAlert}</p><button type="button" onClick={()=>window.location.reload()} className="mt-4 underline">إعادة المحاولة</button></div> : <Loader2 className="h-6 w-6 animate-spin" />}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Bot Message Bubble (edited in place via edit_text / edit_media) */}
              <div className="overflow-hidden rounded-2xl rounded-tr-sm border border-white/[0.06] bg-[#182533] shadow-lg">
                {view.mode === "edit_media" && view.photo_url && (
                  <div className="relative flex w-full justify-center bg-black/40 p-2">
                    <img
                      src={view.photo_url}
                      alt="بطاقة QR أو معاينة القالب"
                      className="max-h-[420px] w-auto rounded-xl object-contain"
                    />
                  </div>
                )}
                <div className="whitespace-pre-line p-4 text-sm leading-relaxed text-zinc-100 sm:p-5">
                  {renderSafeTelegramHtml(view.text)}
                </div>
              </div>

              {/* STRICT InlineKeyboardMarkup Grid (ZERO ReplyKeyboardMarkup) */}
              <div className="space-y-1.5">
                {view.reply_markup.inline_keyboard.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                  >
                    {row.map((btn, bIdx) => {
                      if (btn.url) {
                        const isLocalSite =
                          btn.url.includes("/s/") || btn.url.includes("/preview/");
                        let targetHref = btn.url;
                        if (isLocalSite) {
                          try {
                            const parsed = new URL(btn.url);
                            targetHref = parsed.pathname;
                          } catch {
                            targetHref = btn.url;
                          }
                        }
                        return (
                          <a
                            key={bIdx}
                            href={targetHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#243447]/90 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-[#2f445c]"
                          >
                            <span className="truncate">{btn.text}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                          </a>
                        );
                      }

                      return (
                        <button
                          key={bIdx}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            profile &&
                            btn.callback_data &&
                            callEngine(profile, {
                              actionType: "callback",
                              callbackData: btn.callback_data,
                            })
                          }
                          className="flex min-h-[42px] cursor-pointer items-center justify-center rounded-xl bg-[#243447]/90 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-[#2f445c] active:scale-[0.99] disabled:opacity-55"
                        >
                          <span className="line-clamp-1">{btn.text}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {uploadAlert && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  {uploadAlert}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Composer (for wizard answers & Catbox photo upload) */}
        <form
          onSubmit={handleSendText}
          className="flex items-center gap-2 border-t border-white/[0.08] bg-[#17212b] px-4 py-3"
        >
          {view?.awaiting_input === "photo_or_skip" && (
            <label
              title="رفع صورة إلى Catbox"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span>{uploading ? "جارٍ الرفع..." : "رفع صورة"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}

          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              view?.input_placeholder ||
              (view?.awaiting_input === "text"
                ? "اكتب إجابتك هنا ثم اضغط إرسال..."
                : "اختر من الأزرار أعلاه أو اكتب /start...")
            }
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0e1621] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-sky-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading || !textInput.trim()}
            aria-label="إرسال"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
