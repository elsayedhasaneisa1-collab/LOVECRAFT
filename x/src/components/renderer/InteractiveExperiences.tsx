"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GiftIllustration } from "./GiftIllustration";
import {
  Check,
  Compass,
  DoorOpen,
  ExternalLink,
  Gift,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  MailOpen,
  MapPin,
  RotateCw,
  Sparkles,
  Trophy,
  Unlock,
  ArrowUp,
} from "lucide-react";
import { ThemedButton, type ThemeColors } from "./ComponentShowcaseBlocks";

const GiftObject = dynamic(() => import("./GiftObject"), {ssr:false});

interface ExperienceProps {
  enableGift3d?: boolean;
  liteMode?: boolean;
  siteSlug?: string;
  isPreview?: boolean;
  experienceType: string;
  colors: ThemeColors;
  buttonVariant: string;
  senderName: string;
  recipientName: string;
  mainMessage: string;
  finalSurpriseText?: string | null;
  eventDate?: string | null;
  coverImage: string;
  customFields: Record<string, unknown>;
  onCelebrate: (kind?: "confetti" | "fireworks") => void;
}

export function InteractiveExperienceModule(props: ExperienceProps) {
  const { experienceType, colors } = props;
  const isLight = colors.mode === "light";
  const surfaceCard = isLight
    ? "border-stone-900/10 bg-white/90 text-stone-900 shadow-xl"
    : "border-white/12 bg-white/[0.045] text-white shadow-2xl";

  switch (experienceType) {
    case "envelope-letter":
      return <EnvelopeLetterExperience {...props} surfaceCard={surfaceCard} />;
    case "days-counter":
      return <DaysCounterExperience {...props} surfaceCard={surfaceCard} />;
    case "countdown-unlock":
      return <CountdownUnlockExperience {...props} surfaceCard={surfaceCard} />;
    case "secret-vault":
      return <SecretVaultExperience {...props} surfaceCard={surfaceCard} />;
    case "gift-box-reveal":
      return <GiftBoxExperience {...props} surfaceCard={surfaceCard} />;
    case "mystery-boxes":
      return <MysteryBoxesExperience {...props} surfaceCard={surfaceCard} />;
    case "mystery-doors":
      return <MysteryDoorsExperience {...props} surfaceCard={surfaceCard} />;
    case "lucky-wheel":
      return <LuckyWheelExperience {...props} surfaceCard={surfaceCard} />;
    case "interactive-quiz":
      return <InteractiveQuizExperience {...props} surfaceCard={surfaceCard} />;
    case "true-false-game":
      return <TrueFalseExperience {...props} surfaceCard={surfaceCard} />;
    case "memory-order-game":
      return <MemoryOrderExperience {...props} surfaceCard={surfaceCard} />;
    case "treasure-stages":
      return <TreasureQuestExperience {...props} surfaceCard={surfaceCard} />;
    case "scratch-photo":
      return <ScratchRevealExperience {...props} surfaceCard={surfaceCard} />;
    case "love-jar":
      return <NotesJarExperience {...props} surfaceCard={surfaceCard} />;
    case "proposal-choice":
      return <ProposalExperience {...props} surfaceCard={surfaceCard} />;
    case "celebration-rsvp":
      return <CelebrationRsvpExperience {...props} surfaceCard={surfaceCard} />;
    case "portfolio-studio":
    case "cv-architect":
    case "agency-flagship":
    case "links-showcase":
      return <PortfolioExperience {...props} surfaceCard={surfaceCard} />;
    default:
      return <ProgressiveStoryExperience {...props} surfaceCard={surfaceCard} />;
  }
}

// 1. WAX-SEAL ENVELOPE LETTER
function EnvelopeLetterExperience({
  colors,
  senderName,
  recipientName,
  mainMessage,
  eventDate,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      {!opened ? (
        <button
          type="button"
          onClick={() => {
            setOpened(true);
            onCelebrate("confetti");
          }}
          className={`group relative w-full cursor-pointer overflow-hidden rounded-3xl border p-10 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 ${surfaceCard}`}
        >
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${colors.secondary}, ${colors.primary})`,
              boxShadow: `0 12px 30px ${colors.primary}66`,
            }}
          >
            <Mail className="h-9 w-9" />
          </div>
          <p className="text-xs font-semibold tracking-wider uppercase opacity-60">مظروف مختوم خصيصاً</p>
          <h3 className="mt-2 text-2xl font-bold">إلى {recipientName}</h3>
          <p className="mt-2 text-sm opacity-75">اضغط لفضّ الختم الشمعي وقراءة الرسالة الكاملة</p>
        </button>
      ) : (
        <article
          className="lc-fade-up relative rounded-3xl border border-amber-900/15 bg-[#fffcf5] p-8 text-stone-800 shadow-2xl sm:p-12"
        >
          <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: colors.primary }}>
              <MailOpen className="h-4 w-4" />
              رسالة مفتوحة
            </span>
            {eventDate && <span>{eventDate}</span>}
          </div>
          <p className="mb-4 text-lg font-bold text-stone-900">إلى {recipientName}،</p>
          <p className="whitespace-pre-line text-base leading-[2] text-stone-700 sm:text-lg">
            {mainMessage}
          </p>
          <div className="mt-8 border-t border-stone-200 pt-5 text-left">
            <p className="text-xs text-stone-500">بكل صدق ومودة،</p>
            <p className="mt-1 text-lg font-bold" style={{ color: colors.primary }}>
              {senderName}
            </p>
          </div>
        </article>
      )}
    </div>
  );
}

// 2. LIVE REAL-TIME DAYS COUNTER
function DaysCounterExperience({
  colors,
  mainMessage,
  eventDate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [diff, setDiff] = useState({ days: 365, hours: 12, minutes: 30, seconds: 0, isFuture: false });

  useEffect(() => {
    const target = eventDate ? new Date(eventDate).getTime() : Date.now() - 365 * 86400_000;
    const safeTarget = Number.isFinite(target) ? target : Date.now() - 180 * 86400_000;

    const tick = () => {
      const delta = Date.now() - safeTarget;
      const isFuture = delta < 0;
      const abs = Math.abs(delta);
      const days = Math.floor(abs / 86400_000);
      const hours = Math.floor((abs % 86400_000) / 3600_000);
      const minutes = Math.floor((abs % 3600_000) / 60_000);
      const seconds = Math.floor((abs % 60_000) / 1000);
      setDiff({ days, hours, minutes, seconds, isFuture });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [eventDate]);

  const units = [
    { label: "يوم", value: diff.days },
    { label: "ساعة", value: diff.hours },
    { label: "دقيقة", value: diff.minutes },
    { label: "ثانية", value: diff.seconds },
  ];

  return (
    <div className={`mx-auto max-w-3xl rounded-3xl border p-8 text-center backdrop-blur-xl sm:p-10 ${surfaceCard}`}>
      <p className="text-xs font-semibold opacity-65">
        {diff.isFuture ? "الوقت المتبقي للحظتنا المميزة" : "كل ثانية مرت منذ بدايتنا الجميلة"}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {units.map((u) => (
          <div
            key={u.label}
            className="rounded-2xl border p-4"
            style={{ borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}12` }}
          >
            <div className="font-mono text-3xl font-extrabold sm:text-4xl">{u.value}</div>
            <div className="mt-1 text-xs opacity-75">{u.label}</div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line text-base leading-loose opacity-90">
        {mainMessage}
      </p>
    </div>
  );
}

// 3. COUNTDOWN LOCK MESSAGE
function CountdownUnlockExperience({
  colors,
  senderName,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const initialSec = Math.min(15, Math.max(3, Number(customFields.countdownSeconds) || 5));
  const [remaining, setRemaining] = useState(initialSec);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    if (remaining <= 0) {
      setUnlocked(true);
      onCelebrate("fireworks");
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, unlocked, onCelebrate]);

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center backdrop-blur-xl sm:p-12 ${surfaceCard}`}>
      {!unlocked ? (
        <div className="space-y-5">
          <Lock className="mx-auto h-8 w-8 opacity-75" style={{ color: colors.accent }} />
          <p className="text-sm opacity-75">تُفتح الرسالة السرية تلقائياً بعد...</p>
          <div
            className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 font-mono text-5xl font-extrabold"
            style={{ borderColor: colors.primary, boxShadow: `0 0 40px ${colors.primary}55` }}
          >
            {remaining}
          </div>
          <button
            type="button"
            onClick={() => {
              setRemaining(0);
              setUnlocked(true);
              onCelebrate("fireworks");
            }}
            className="text-xs underline opacity-65 hover:opacity-100"
          >
            فتح الرسالة فوراً
          </button>
        </div>
      ) : (
        <div className="lc-fade-up space-y-5">
          <Unlock className="mx-auto h-8 w-8" style={{ color: colors.accent }} />
          <h3 className="text-xl font-bold">انفتح القفل — رسالتك الخاصة</h3>
          <p className="whitespace-pre-line text-base leading-loose opacity-90 sm:text-lg">
            {mainMessage}
          </p>
          <p className="pt-2 text-sm font-semibold" style={{ color: colors.primary }}>
            — {senderName}
          </p>
        </div>
      )}
    </div>
  );
}

// 4. SECRET CIPHER / PASSCODE VAULT
function SecretVaultExperience({
  colors,
  buttonVariant,
  mainMessage,
  senderName,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const expected = String(customFields.secretCode || "2026").trim().toLowerCase();
  const hint = String(customFields.secretHint || `جرب إدخال: ${expected}`);
  const [input, setInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === expected) {
      setUnlocked(true);
      setError(false);
      onCelebrate("confetti");
    } else {
      setError(true);
    }
  };

  return (
    <div className={`mx-auto max-w-xl rounded-3xl border p-8 text-center backdrop-blur-xl sm:p-10 ${surfaceCard}`}>
      {!unlocked ? (
        <form onSubmit={checkCode} className="space-y-5">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${colors.primary}22`, color: colors.primary }}
          >
            <KeyRound className="h-8 w-8" />
          </div>
          <h3 className="text-2xl font-bold">خزنة الرسالة التفاعلية</h3>
          <p className="text-sm opacity-75">أدخل الرمز السري لفك الشفرة وكشف المحتوى المحفوظ</p>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            aria-label="رمز القفل التفاعلي"
            placeholder="أدخل الرمز السري هنا..."
            className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-3.5 text-center font-mono text-lg focus:border-white/50 focus:outline-none"
          />
          {error && <p className="text-xs text-rose-400">الرمز غير مطابق — جرب التلميح أدناه!</p>}
          <div className="flex flex-col items-center gap-3">
            <ThemedButton type="submit" variant={buttonVariant} colors={colors}>
              فتح الخزنة الآن
            </ThemedButton>
            <button
              type="button"
              onClick={() => setShowHint((s) => !s)}
              className="inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              إظهار التلميح
            </button>
            {showHint && (
              <p className="rounded-xl bg-white/10 px-4 py-2 text-xs">
                💡 التلميح: <strong>{hint}</strong>
              </p>
            )}
          </div>
        </form>
      ) : (
        <div className="lc-fade-up space-y-4">
          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
            تم فك الشفرة بنجاح
          </span>
          <p className="whitespace-pre-line text-base leading-loose sm:text-lg">{mainMessage}</p>
          <p className="text-sm font-semibold" style={{ color: colors.accent }}>
            — {senderName}
          </p>
        </div>
      )}
    </div>
  );
}

// 5. 3D INTERACTIVE GIFT BOX (3-tap unbox)
function GiftBoxExperience({colors, mainMessage, senderName, onCelebrate, surfaceCard, enableGift3d, liteMode}:ExperienceProps & {surfaceCard:string}) {
  const [taps,setTaps]=useState(0);
  const opened=taps>=3;
  function open(){if(opened)return;const next=taps+1;setTaps(next);if(next===3)onCelebrate('fireworks');}
  return <div className={`mx-auto max-w-2xl rounded-3xl border p-6 text-center backdrop-blur-xl sm:p-9 ${surfaceCard}`}>
    <span dir="ltr" className="text-[10px] font-semibold tracking-[.25em] opacity-65">THE UNBOXING</span>
    <button type="button" className="gift-model-button" aria-label={opened?'الهدية مفتوحة':`افتح الهدية، الخطوة ${taps+1} من 3`} disabled={opened} onClick={open}>
      {enableGift3d&&!liteMode?<GiftObject primary={colors.primary} stage={taps}/>:<GiftIllustration primary={colors.primary} stage={taps}/>}
    </button>
    <div aria-live="polite" aria-atomic="true">{!opened?<><h3 className="text-xl font-bold">{['هدية صغيرة، من أجلك','بقيت لمستان للمفاجأة','لمسة أخيرة…'][taps]}</h3><p className="my-3 text-sm opacity-75">اضغط على الهدية لفتحها، خطوة بخطوة.</p><div className="mx-auto flex w-28 gap-1.5">{[0,1,2].map(i=><span key={i} className="h-1.5 flex-1 rounded-full" style={{background:i<taps?colors.accent:'rgba(128,128,128,.35)'}}/>)}</div></>:<div className="lc-fade-up space-y-4"><h3 className="text-2xl font-bold">مفاجأتك الخاصة!</h3><p className="whitespace-pre-line text-base leading-loose">{mainMessage}</p><p className="text-sm font-bold" style={{color:colors.accent}}>— {senderName}</p><button type="button" onClick={()=>setTaps(0)} className="text-xs underline underline-offset-4 opacity-70">إعادة فتح الهدية</button></div>}</div>
  </div>;
}

// 6. CHOOSE YOUR MYSTERY BOX GAME
function MysteryBoxesExperience({
  colors,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const boxes = (customFields.boxes as Array<{ title: string; prize: string; isGrand?: boolean }>) || [
    { title: "الصندوق الأول", prize: "ابتسامة دافئة ورسالة تقدير خاصة لك!" },
    { title: "الصندوق الذهبي", prize: mainMessage, isGrand: true },
    { title: "الصندوق الثالث", prize: "أمنية محققة ومفاجأة إضافية بانتظارك!" },
  ];
  const [openedSet, setOpenedSet] = useState<number[]>([]);

  const pick = (idx: number) => {
    if (!openedSet.includes(idx)) {
      setOpenedSet([...openedSet, idx]);
      onCelebrate(boxes[idx]?.isGrand ? "fireworks" : "confetti");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold">اختر صندوقاً لفتح محتواه</h3>
        <p className="mt-1 text-sm opacity-75">يمكنك تجربة جميع الصناديق للعثور على الجائزة الكبرى!</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {boxes.map((box, idx) => {
          const isOpen = openedSet.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => pick(idx)}
              className={`cursor-pointer rounded-3xl border p-6 text-center backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${surfaceCard}`}
              style={
                isOpen && box.isGrand
                  ? { borderColor: colors.accent, boxShadow: `0 0 35px ${colors.accent}44` }
                  : undefined
              }
            >
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
                style={{
                  background: isOpen
                    ? `linear-gradient(135deg, ${colors.accent}, ${colors.primary})`
                    : `${colors.primary}33`,
                }}
              >
                {isOpen ? <Trophy className="h-8 w-8" /> : <Gift className="h-8 w-8" />}
              </div>
              <h4 className="font-bold">{box.title}</h4>
              <p className="mt-3 text-sm leading-relaxed opacity-85">
                {isOpen ? box.prize : "اضغط للكشف عمّا بداخله ✨"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 7. THREE MYSTERY DOORS
function MysteryDoorsExperience({
  colors,
  mainMessage,
  finalSurpriseText,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const doors = [
    { name: "باب النجوم", reveal: "وراء هذا الباب ذكرى لا تبهت مهما مرّت الأيام." },
    { name: "باب السر الأكبر", reveal: mainMessage },
    { name: "باب الأمنيات", reveal: finalSurpriseText || "كل الأبواب القادمة تحمل لك الخير والسعادة." },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-center">
      <h3 className="text-2xl font-bold">ثلاثة أبواب أمامك — أيها ستفتح؟</h3>
      <div className="grid gap-5 sm:grid-cols-3">
        {doors.map((d, i) => {
          const active = selected === i;
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => {
                setSelected(i);
                onCelebrate("confetti");
              }}
              className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-t-[4rem] rounded-b-2xl border p-6 transition-all duration-500 hover:-translate-y-1 ${surfaceCard}`}
              style={active ? { borderColor: colors.primary } : undefined}
            >
              <DoorOpen className="mb-3 h-10 w-10" style={{ color: colors.accent }} />
              <h4 className="text-base font-bold">{d.name}</h4>
              {active ? (
                <p className="mt-3 text-sm leading-relaxed opacity-90">{d.reveal}</p>
              ) : (
                <span className="mt-3 text-xs opacity-60">اطرق الباب للفتح</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 8. SPINNING WHEEL OF FORTUNE
function LuckyWheelExperience({
  colors,
  buttonVariant,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const slices = (customFields.wheelSlices as string[]) || [
    "هدية مفاجئة",
    "دعوة خاصة",
    "أمنية محققة",
    "قهوة معاً",
    "مغامرة جديدة",
    "الجائزة الكبرى",
  ];
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    const pickIdx = Math.floor(Math.random() * slices.length);
    const sliceDeg = 360 / slices.length;
    const nextRot = rotation + 1440 + (360 - pickIdx * sliceDeg);
    setRotation(nextRot);
    window.setTimeout(() => {
      setSpinning(false);
      setWinner(slices[pickIdx] || slices[0]!);
      onCelebrate("confetti");
    }, 2600);
  };

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center backdrop-blur-xl ${surfaceCard}`}>
      <h3 className="text-2xl font-bold">أدِر عجلة الحظ!</h3>
      <p className="mt-1 text-sm opacity-75">{mainMessage}</p>

      <div className="relative mx-auto my-8 h-56 w-56 sm:h-64 sm:w-64">
        <div
          className="absolute -top-3 left-1/2 z-20 h-6 w-4 -translate-x-1/2 rounded-b-full"
          style={{ backgroundColor: colors.accent }}
        />
        <div
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 2.5s cubic-bezier(0.18, 0.89, 0.22, 1)" : "none",
            background: `conic-gradient(${colors.primary} 0deg 60deg, ${colors.secondary} 60deg 120deg, ${colors.accent} 120deg 180deg, ${colors.primary} 180deg 240deg, ${colors.secondary} 240deg 300deg, ${colors.accent} 300deg 360deg)`,
          }}
          className="flex h-full w-full items-center justify-center rounded-full border-4 border-white/30 shadow-2xl"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-md">
            <RotateCw className={`h-6 w-6 ${spinning ? "animate-spin" : ""}`} />
          </div>
        </div>
      </div>

      {winner && (
        <div
          className="lc-fade-up mb-5 rounded-2xl border p-4"
          style={{ borderColor: colors.accent, backgroundColor: `${colors.accent}18` }}
        >
          <p className="text-xs opacity-75">النتيجة التي توقفت عليها العجلة:</p>
          <p className="mt-1 text-xl font-extrabold">{winner}</p>
        </div>
      )}

      <ThemedButton variant={buttonVariant} colors={colors} onClick={spin}>
        {spinning ? "تدور الآن..." : winner ? "أدر العجلة مرة أخرى" : "أدِر العجلة الآن"}
      </ThemedButton>
    </div>
  );
}

// 9. INTERACTIVE QUIZ
function InteractiveQuizExperience({
  colors,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const questions = (customFields.quizItems as Array<{
    q: string;
    options: string[];
    correct: number;
  }>) || [
    {
      q: "ما هو أجمل ما يجمعنا دائماً؟",
      options: ["المواقف العفوية", "الثقة والدعم", "الذكريات الجميلة", "كل ما سبق"],
      correct: 3,
    },
  ];
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const answer = (optIdx: number) => {
    const isRight = optIdx === questions[step]!.correct;
    const nextScore = score + (isRight ? 1 : 0);
    setScore(nextScore);
    if (step + 1 >= questions.length) {
      setFinished(true);
      onCelebrate("fireworks");
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 backdrop-blur-xl sm:p-10 ${surfaceCard}`}>
      {!finished ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>التحدي التفاعلي</span>
            <span>
              السؤال {step + 1} من {questions.length}
            </span>
          </div>
          <h3 className="text-xl font-bold sm:text-2xl">{questions[step]!.q}</h3>
          <div className="grid gap-3">
            {questions[step]!.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => answer(idx)}
                className="cursor-pointer rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-right text-sm font-medium transition-all hover:-translate-x-1 hover:border-white/40 hover:bg-white/10"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="lc-fade-up space-y-4 text-center">
          <Trophy className="mx-auto h-12 w-12" style={{ color: colors.accent }} />
          <h3 className="text-2xl font-extrabold">
            نتيجتك: {score} من {questions.length}!
          </h3>
          <p className="whitespace-pre-line text-base leading-loose opacity-90">{mainMessage}</p>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setScore(0);
              setFinished(false);
            }}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            إعادة التحدي
          </button>
        </div>
      )}
    </div>
  );
}

// 10. TRUE OR FALSE ARENA
function TrueFalseExperience({
  colors,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const items = (customFields.statements as Array<{ text: string; answer: boolean }>) || [
    { text: "أجمل الذكريات تبدأ بموقف بسيط غير متوقع.", answer: true },
    { text: "هذا الموقع أُعدّ خصيصاً لك اليوم.", answer: true },
  ];
  const [idx, setIdx] = useState(0);
  const [hits, setHits] = useState(0);
  const done = idx >= items.length;

  const choose = (val: boolean) => {
    if (val === items[idx]!.answer) setHits((h) => h + 1);
    if (idx + 1 >= items.length) onCelebrate("confetti");
    setIdx(idx + 1);
  };

  return (
    <div className={`mx-auto max-w-xl rounded-3xl border p-8 text-center backdrop-blur-xl ${surfaceCard}`}>
      {!done ? (
        <div className="space-y-6">
          <span className="text-xs opacity-65">
            جولة صح أم غلط ({idx + 1}/{items.length})
          </span>
          <h3 className="text-xl font-bold leading-relaxed">{items[idx]!.text}</h3>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => choose(true)}
              className="cursor-pointer rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-emerald-500"
            >
              ✓ صح
            </button>
            <button
              type="button"
              onClick={() => choose(false)}
              className="cursor-pointer rounded-2xl bg-rose-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-rose-500"
            >
              ✕ غلط
            </button>
          </div>
        </div>
      ) : (
        <div className="lc-fade-up space-y-4">
          <h3 className="text-2xl font-bold" style={{ color: colors.accent }}>
            أحسنت! أجبت {hits} من {items.length} بشكل صحيح
          </h3>
          <p className="whitespace-pre-line text-base leading-loose">{mainMessage}</p>
        </div>
      )}
    </div>
  );
}

// 11. ORDER THE MEMORIES
function MemoryOrderExperience({
  colors,
  mainMessage,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [cards, setCards] = useState([
    { order: 2, label: "المرحلة الثانية: أجمل المواقف والضحكات المشتركة" },
    { order: 3, label: "المرحلة الثالثة: لحظة اليوم وهذه الرسالة الخاصة" },
    { order: 1, label: "المرحلة الأولى: أول لقاء وبداية الحكاية" },
  ]);
  const isSorted = cards.every((c, i) => c.order === i + 1);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...cards];
    const tmp = next[idx - 1]!;
    next[idx - 1] = next[idx]!;
    next[idx] = tmp;
    setCards(next);
    if (next.every((c, i) => c.order === i + 1)) onCelebrate("confetti");
  };

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 backdrop-blur-xl ${surfaceCard}`}>
      <h3 className="text-center text-xl font-bold">رتّب المحطات من البداية إلى اليوم</h3>
      <div className="mt-6 space-y-3">
        {cards.map((c, idx) => (
          <div
            key={c.order}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5"
          >
            <span className="text-sm font-medium">{c.label}</span>
            {idx > 0 && !isSorted && (
              <button
                type="button"
                onClick={() => moveUp(idx)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: colors.primary }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                لأعلى
              </button>
            )}
          </div>
        ))}
      </div>
      {isSorted && (
        <div className="lc-fade-up mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
          <p className="text-sm font-bold text-emerald-300">ترتيب مثالي! انكشفت الرسالة:</p>
          <p className="mt-2 whitespace-pre-line text-base leading-relaxed">{mainMessage}</p>
        </div>
      )}
    </div>
  );
}

// 12. TREASURE HUNT / STAGES QUEST
function TreasureQuestExperience({
  colors,
  buttonVariant,
  mainMessage,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const stages = [
    "المحطة الأولى: اتبع البوصلة المضيئة نحو بداية الرحلة.",
    "المحطة الثانية: وجدت المفتاح الفضي — اقتربت كثيراً!",
    "المحطة الثالثة: فُتحت البوابة الأخيرة لصندوق الكنز!",
    mainMessage,
  ];
  const [stage, setStage] = useState(0);

  const advance = () => {
    const next = Math.min(stages.length - 1, stage + 1);
    setStage(next);
    if (next === stages.length - 1) onCelebrate("fireworks");
  };

  const pct = Math.round(((stage + 1) / stages.length) * 100);

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center backdrop-blur-xl ${surfaceCard}`}>
      <Compass className="mx-auto mb-3 h-10 w-10" style={{ color: colors.accent }} />
      <div className="mx-auto mb-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: colors.primary }}
        />
      </div>
      <p className="text-xs opacity-65">تقدم الرحلة: {pct}%</p>
      <p className="my-5 whitespace-pre-line text-lg leading-relaxed font-medium">{stages[stage]}</p>
      {stage < stages.length - 1 && (
        <ThemedButton variant={buttonVariant} colors={colors} onClick={advance}>
          انتقل للمحطة التالية
        </ThemedButton>
      )}
    </div>
  );
}

// 13. SCRATCH / REVEAL BEHIND IMAGE
function ScratchRevealExperience({
  colors,
  mainMessage,
  coverImage,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={`mx-auto max-w-2xl overflow-hidden rounded-3xl border backdrop-blur-xl ${surfaceCard}`}>
      <div
        onClick={() => {
          if (!revealed) {
            setRevealed(true);
            onCelebrate("confetti");
          }
        }}
        className="relative min-h-[300px] cursor-pointer overflow-hidden"
      >
        <img
          src={coverImage}
          alt="الرسالة المخفية"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
            revealed ? "scale-100 blur-0 opacity-35" : "scale-110 blur-xl opacity-65"
          }`}
        />
        <div className="relative z-10 flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
          {!revealed ? (
            <>
              <span
                className="mb-3 rounded-full px-4 py-1.5 text-xs font-bold text-white"
                style={{ backgroundColor: colors.primary }}
              >
                طبقة مخفية تفاعلية
              </span>
              <h3 className="text-2xl font-bold">المس أو اضغط هنا لكشف الرسالة المخبأة خلف الصورة</h3>
            </>
          ) : (
            <div className="lc-fade-up space-y-3">
              <Sparkles className="mx-auto h-7 w-7" style={{ color: colors.accent }} />
              <p className="whitespace-pre-line text-lg leading-loose font-medium">{mainMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 14. LOVE / SECRET NOTES JAR
function NotesJarExperience({
  colors,
  buttonVariant,
  mainMessage,
  customFields,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const baseNotes = (customFields.notes as string[]) || [
    "حضورك يضيف بهجة حقيقية لكل يوم.",
    "شكراً لكل الذكريات الصادقة التي جمعتنا.",
    "بعض الكلمات تبقى دافئة في القلب دائماً.",
  ];
  const allNotes = [mainMessage, ...baseNotes];
  const [idx, setIdx] = useState(0);

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center backdrop-blur-xl sm:p-10 ${surfaceCard}`}>
      <span className="text-xs font-semibold opacity-65">
        بطاقة {idx + 1} من {allNotes.length}
      </span>
      <div
        className="my-6 rounded-2xl border p-6 sm:p-8"
        style={{ borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10` }}
      >
        <p className="whitespace-pre-line text-base leading-loose sm:text-lg">{allNotes[idx]}</p>
      </div>
      <ThemedButton
        variant={buttonVariant}
        colors={colors}
        onClick={() => {
          const next = (idx + 1) % allNotes.length;
          setIdx(next);
          if (next === allNotes.length - 1) onCelebrate("confetti");
        }}
      >
        اسحب رسالة جديدة من الصندوق
      </ThemedButton>
    </div>
  );
}

// 15. MARRIAGE PROPOSAL INTERACTIVE SCENE
function ProposalExperience({
  colors,
  buttonVariant,
  recipientName,
  senderName,
  mainMessage,
  onCelebrate,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className={`mx-auto max-w-2xl rounded-3xl border p-9 text-center backdrop-blur-xl sm:p-12 ${surfaceCard}`}>
      <p className="whitespace-pre-line text-base leading-loose opacity-90 sm:text-lg">
        {mainMessage}
      </p>
      {!accepted ? (
        <div className="mt-8 space-y-5">
          <h3 className="text-2xl font-extrabold sm:text-3xl" style={{ color: colors.accent }}>
            {recipientName}، هل تقبلين أن نكمل العمر معاً؟
          </h3>
          <ThemedButton
            variant={buttonVariant}
            colors={colors}
            onClick={() => {
              setAccepted(true);
              onCelebrate("fireworks");
            }}
          >
            نعم، بكل سعادة! 💍
          </ThemedButton>
        </div>
      ) : (
        <div
          className="lc-fade-up mt-8 rounded-2xl border p-6"
          style={{ borderColor: colors.accent, backgroundColor: `${colors.accent}18` }}
        >
          <h3 className="text-2xl font-extrabold">أجمل «نعم» في العمر كله! ✨</h3>
          <p className="mt-2 text-sm opacity-85">
            بداية فصلنا الأجمل معاً — {senderName} & {recipientName}
          </p>
        </div>
      )}
    </div>
  );
}

// 16. EVENT CELEBRATION & INTERACTIVE RSVP
function CelebrationRsvpExperience({colors,buttonVariant,mainMessage,eventDate,customFields,onCelebrate,surfaceCard,siteSlug,isPreview}: ExperienceProps & {surfaceCard:string}) {
  const [name,setName]=useState(''),[loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
  const location=String(customFields.eventLocation||'');
  const [requestId,setRequestId]=useState('');
  useEffect(()=>{const key='lc-attendance:'+siteSlug;let id=crypto.randomUUID();try{const old=localStorage.getItem(key);if(old)id=old as typeof id;else localStorage.setItem(key,id);}catch{}setRequestId(id);},[siteSlug]);
  async function submit(e:React.FormEvent){e.preventDefault();if(loading)return;if(isPreview){setConfirmed(true);onCelebrate('confetti');return;}setLoading(true);setError('');try{const res=await fetch(`/api/s/${encodeURIComponent(siteSlug||'')}/rsvp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,requestId})});const body=await res.json();if(!res.ok)throw new Error(body.error||'تعذّر تسجيل الحضور.');setConfirmed(true);onCelebrate('confetti');}catch(err){setError(err instanceof Error?err.message:'خطأ في الاتصال.');}finally{setLoading(false);}}
  return <div className={`mx-auto max-w-3xl rounded-3xl border p-8 text-center backdrop-blur-xl sm:p-12 ${surfaceCard}`}><p className="whitespace-pre-line text-base leading-loose sm:text-lg">{mainMessage}</p><div className="my-6 flex flex-wrap justify-center gap-3 text-sm">{eventDate&&<span className="rounded-full border px-4 py-2" style={{borderColor:colors.accent+'55'}}>الموعد: {eventDate}</span>}{location&&<span className="inline-flex items-center gap-2"><MapPin size={16}/>{location}</span>}</div>{confirmed?<p role="status" className="rounded-xl border border-emerald-400/30 p-4 text-sm"><Check className="mx-auto mb-2" size={18}/>{isPreview?'هكذا يظهر تأكيد الحضور. لم يُرسل أي رد في المعاينة.':'تم تسجيل حضورك بنجاح. ننتظر لقاءك!'}</p>:<form onSubmit={submit} className="mx-auto max-w-sm space-y-3">{!isPreview&&<label className="block text-right text-sm">اسم الضيف<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-xl border border-current/20 bg-transparent p-3"/></label>}<ThemedButton type="submit" colors={colors} variant={buttonVariant}>{loading?'جارٍ تسجيل الحضور…':isPreview?'جرّب تأكيد الحضور':'تأكيد حضوري'}</ThemedButton>{isPreview&&<p className="text-xs opacity-60">معاينة تفاعلية — لا تُرسل ردود حضور.</p>}{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}</form>}</div>;
}

// 17. PORTFOLIO / CV / AGENCY / LINKS HUB
function PortfolioExperience({
  colors,
  mainMessage,
  customFields,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const roleTitle = String(customFields.roleTitle || "استوديو تصميم وتطوير رقمي");
  const contactHandle = String(customFields.contactHandle || "");
  const stats = (customFields.stats as Array<{ label: string; value: string }>) || [];
  const highlights = (customFields.highlights as Array<{ title: string; desc: string }>) || [];
  const links = (customFields.links as Array<{ label: string; tag: string }>) || [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className={`rounded-3xl border p-8 backdrop-blur-xl sm:p-10 ${surfaceCard}`}>
        <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: colors.accent }}>
          {roleTitle}
        </p>
        <p className="mt-4 whitespace-pre-line text-base leading-loose opacity-90 sm:text-lg">
          {mainMessage}
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-center">
          {stats.map((st) => (
            <div key={st.label}>
              <div className="text-2xl font-extrabold sm:text-3xl" style={{ color: colors.primary }}>
                {st.value}
              </div>
              <div className="mt-1 text-xs opacity-70">{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.title} className={`rounded-2xl border p-6 backdrop-blur-xl ${surfaceCard}`}>
            <h4 className="text-base font-bold">{h.title}</h4>
            <p className="mt-2 text-sm leading-relaxed opacity-75">{h.desc}</p>
          </div>
        ))}
      </div>

      {links.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((lnk) => (
            <div
              key={lnk.label}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${surfaceCard}`}
            >
              <span className="text-sm font-semibold">{lnk.label}</span>
              <span className="inline-flex items-center gap-1.5 text-xs opacity-65">
                {lnk.tag}
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </div>
      )}

      {contactHandle && (
        <div className="text-center text-sm opacity-75">
          للتواصل المباشر: <strong className="font-mono">{contactHandle}</strong>
        </div>
      )}
    </div>
  );
}

// 18. PROGRESSIVE STORY & TIMELINE
function ProgressiveStoryExperience({
  colors,
  senderName,
  mainMessage,
  customFields,
  surfaceCard,
}: ExperienceProps & { surfaceCard: string }) {
  const milestones = (customFields.milestones as Array<{ title: string; desc: string }>) || [];
  const memoryNote = customFields.memoryNote ? String(customFields.memoryNote) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className={`rounded-3xl border p-8 backdrop-blur-xl sm:p-11 ${surfaceCard}`}>
        <p className="whitespace-pre-line text-base leading-[2] sm:text-lg">{mainMessage}</p>
        {memoryNote && (
          <blockquote
            className="mt-6 border-r-4 pr-4 text-sm italic opacity-85"
            style={{ borderColor: colors.accent }}
          >
            «{memoryNote}»
          </blockquote>
        )}
        <p className="mt-6 text-left text-sm font-bold" style={{ color: colors.primary }}>
          — {senderName}
        </p>
      </div>

      {milestones.length > 0 && (
        <div className="space-y-4">
          {milestones.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 rounded-2xl border p-5 backdrop-blur-xl ${surfaceCard}`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: colors.primary }}
              >
                {i + 1}
              </span>
              <div>
                <h4 className="font-bold">{m.title}</h4>
                <p className="mt-1 text-sm opacity-75">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
