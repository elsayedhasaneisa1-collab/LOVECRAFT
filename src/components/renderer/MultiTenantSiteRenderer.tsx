"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Feather, LayoutPanelTop, RotateCcw, Route, Share2, Sparkles } from 'lucide-react';
import { DeveloperFooter } from '@/components/shared/DeveloperFooter';
import { templateMotion } from '@/lib/template-motion';
import { AmbientAudioPlayer } from './AmbientAudioPlayer';
import { BackgroundLayer, GalleryBlock, HeroBlock, ThemedButton, type SiteImageItem, type ThemeColors } from './ComponentShowcaseBlocks';
import { TemplateScenes, sceneExperiences } from './TemplateScenes';
import { InteractiveExperienceModule } from './InteractiveExperiences';
import { SceneMotion } from './SceneMotion';
import { JourneyProgress, sceneNames, type SceneKey } from './JourneyProgress';
import './journey.css';

const ThreeSceneCanvas = dynamic(() => import('./ThreeSceneCanvas'), { ssr: false });

export interface RenderedSitePayload {
  siteId: number; slug: string; title: string; pinnedVersion: string; durationMode: string;
  expiresAt?: string | null; viewsCount: number; categorySlug: string; categoryNameAr: string;
  templateSlug: string; templateNameAr: string; experienceType: string;
  senderName: string; recipientName: string; headline: string; subheadline?: string | null;
  mainMessage: string; finalSurpriseText?: string | null; eventDate?: string | null;
  themeColors: ThemeColors;
  componentsConfig: { hero: string; background: string; typography: string; button: string; gallery: string; sections: string[]; effects: string[]; introStyle: string; liteModeDefault?: boolean };
  musicTrack: string; customFields: Record<string, unknown>; images: SiteImageItem[]; isPreview?: boolean;
}

export function MultiTenantSiteRenderer({ site, startJourney = false }: { site: RenderedSitePayload; startJourney?: boolean }) {
  const { themeColors: colors, componentsConfig: cfg } = site;
  const light = colors.mode === 'light';
  const capabilities = templateMotion(cfg);
  const [ready, setReady] = useState(false);
  const [manualLite, setManualLite] = useState(Boolean(cfg.liteModeDefault));
  const [reduced, setReduced] = useState(false);
  const lite = manualLite || reduced;
  const [guided, setGuided] = useState(startJourney);
  const [step, setStep] = useState(0);
  const [introDismissed, setIntroDismissed] = useState(Boolean(site.isPreview) || cfg.introStyle === 'minimal-fade' || site.categorySlug === 'portfolio');
  const [finaleOpened, setFinaleOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState('');
  const experienceRef = useRef<HTMLElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const celebrationTimer = useRef<number | undefined>(undefined);
  const celebration = useRef<{ reset: () => void } | null>(null);
  const canAnimate = useRef(false);
  const hasGallery = site.images.length > 0 && !['cinema-premiere','memory-showcase','links-showcase'].includes(site.experienceType);
  const scenes = useMemo<SceneKey[]>(() => ['intro', 'experience', ...(hasGallery ? ['gallery' as const] : []), ...(site.finalSurpriseText ? ['finale' as const] : [])], [hasGallery, site.finalSurpriseText]);
  const current = scenes[Math.min(step,scenes.length-1)];
  const showIntro = guided ? current === 'intro' : !introDismissed;
  const show = (scene: SceneKey) => !showIntro && (!guided || current === scene);
  const useTransitions = ready && !lite && capabilities.transitions;
  const has3d = ready && !lite && capabilities.three;
  const giftScene = site.experienceType === 'gift-box-reveal' && show('experience');
  const cover = site.images[0]?.url || '/images/cat-love.jpg';

  useEffect(() => {
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(pref.matches);
    sync();
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (memory && memory <= 2) setManualLite(true);
    setReady(true);
    pref.addEventListener?.('change', sync);
    return () => { pref.removeEventListener?.('change', sync); clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => {
    canAnimate.current = ready && !lite;
    return () => { canAnimate.current = false; clearTimeout(celebrationTimer.current); celebration.current?.reset(); };
  }, [ready, lite]);

  const celebrate = useCallback(async (kind: 'confetti'|'fireworks' = 'confetti') => {
    if (!canAnimate.current || !cfg.effects.some(e=>['confetti','fireworks','floating-hearts','stars','particles'].includes(e))) return;
    try {
      const fire = (await import('canvas-confetti')).default;
      if (!canAnimate.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      celebration.current = fire;
      const palette = [colors.primary, colors.secondary, colors.accent, '#ffffff'];
      const burst = (x: number) => {
        if (canAnimate.current) void fire({ particleCount: 56, spread: 72, origin: { x, y: 0.62 }, colors: palette, disableForReducedMotion: true });
      };
      if (kind === 'fireworks' || cfg.effects.includes('fireworks')) {
        burst(0.3); clearTimeout(celebrationTimer.current); celebrationTimer.current = window.setTimeout(() => burst(0.7), 260);
      } else burst(0.5);
    } catch { /* Celebrations are decorative: revealing content never depends on a canvas. */ }
  }, [cfg.effects,colors.primary,colors.secondary,colors.accent]);

  function go(index: number) {
    setStep(Math.min(scenes.length-1,Math.max(0,index)));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function switchMode() {
    setGuided(v=>!v); setStep(0); setIntroDismissed(true);
    window.scrollTo({top:0,behavior:'instant'});
  }
  async function share() {
    const url=window.location.href;
    if(navigator.share) {
      try { await navigator.share({title:site.title,url});return; } catch(err) { if(err instanceof DOMException && err.name === 'AbortError')return; }
    }
    try { await navigator.clipboard.writeText(url);setCopied(true);clearTimeout(copyTimer.current);copyTimer.current=window.setTimeout(()=>setCopied(false),2200); }
    catch { setShareFallback(url); }
  }
  const surface = light ? 'border-stone-900/10 bg-white/85' : 'border-white/15 bg-black/40';

  return <div dir="rtl" className="lc-rendered relative flex min-h-screen w-full max-w-full flex-col overflow-x-clip" data-lite={lite?'true':'false'} data-journey-mode={guided?'guided':'page'} style={{backgroundColor:colors.background,color:colors.text}}>
    {(showIntro || (site.isPreview && ['cinematic','countdown','parallax'].includes(cfg.hero))) && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[640px] max-h-screen overflow-hidden"><img src={cover} alt="" className="h-full w-full object-cover opacity-40"/><div className="absolute inset-0" style={{background:`linear-gradient(0deg,${colors.background},transparent 85%)`}}/></div>}
    <BackgroundLayer variant={cfg.background} colors={colors} liteMode={lite}/>
    {has3d && !giftScene && <ThreeSceneCanvas primaryColor={colors.primary} accentColor={colors.accent}/>}
    {site.isPreview && <header className="lc-preview-head relative z-40 border-b border-white/15 bg-zinc-950/90 text-white backdrop-blur-xl"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs sm:text-sm"><div className="flex flex-wrap items-center gap-2.5"><Link prefetch={false} href="/templates" className="inline-flex items-center gap-1 text-zinc-300 hover:text-white"><ArrowRight size={15}/>مكتبة القوالب</Link><i className="text-zinc-600">/</i><span>معاينة: {site.templateNameAr}</span><code dir="ltr" className="text-[10px] text-zinc-400">v{site.pinnedVersion}</code></div><Link prefetch={false} href={`/bot?template=${encodeURIComponent(site.templateSlug)}`} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200">استخدم هذا القالب الآن</Link></div></header>}
    <div className="relative z-30 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <AmbientAudioPlayer trackId={site.musicTrack} primaryColor={colors.primary} isLight={light} variant="floating"/>
        <button type="button" className={`render-tool ${surface}`} disabled={reduced} aria-label={lite?'إيقاف الوضع الخفيف':'تفعيل الوضع الخفيف'} aria-pressed={lite} title={reduced?'الحركة مخفّضة وفق إعدادات الجهاز':'تقليل المؤثرات البصرية'} onClick={()=>setManualLite(v=>!v)}><Feather size={14}/><span className="hidden sm:inline">{lite?'الوضع الخفيف: مفعّل':'وضع خفيف'}</span></button>
        <button type="button" className={`render-tool ${surface}`} aria-pressed={guided} onClick={switchMode}>{guided?<LayoutPanelTop size={14}/>:<Route size={14}/>}<span>{guided?'تصفّح الصفحة':'جرّب رحلة الزائر'}</span></button>
      </div>
      <button type="button" onClick={share} className={`render-tool ${surface}`}>{copied?<Check size={14}/>:<Share2 size={14}/>}<span>{copied?'تم نسخ الرابط':'مشاركة'}</span></button>
      {shareFallback && <label className="flex w-full items-center gap-2 text-xs">انسخ رابط الموقع<input aria-label="رابط المشاركة" dir="ltr" readOnly onFocus={e=>e.target.select()} value={shareFallback} className="min-w-0 flex-1 rounded-lg border border-current/30 bg-transparent p-2"/><button type="button" onClick={()=>setShareFallback('')}>إغلاق</button></label>}
    </div>
    {guided && <JourneyProgress scenes={scenes} current={step} onChange={go}/>}
    {showIntro ? <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-14 text-center sm:py-20">
      <SceneMotion enabled={useTransitions} sceneKey="intro"><article className={`space-y-5 rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl sm:p-12 ${surface}`}>
        <span dir="ltr" className="block text-[10px] tracking-[.28em] opacity-65">A PERSONAL EXPERIENCE</span><p className="text-xs font-semibold" style={{color:colors.accent}}>إلى {site.recipientName}</p>
        <h1 className="text-3xl leading-snug font-extrabold sm:text-5xl">{site.headline}</h1><p className="text-sm leading-loose opacity-80">{site.subheadline || `أعدّ ${site.senderName} هذه التجربة خصيصًا لك.`}</p>
        <ThemedButton variant={cfg.button} colors={colors} liteMode={lite} onClick={()=>{if(guided)go(1);else setIntroDismissed(true);}}>ابدأ التجربة<ArrowLeft size={15}/></ThemedButton>
        {site.isPreview && <p className="text-[11px] opacity-65">معاينة مجانية · لا تُنشئ موقعًا ولا تستخدم رصيدًا</p>}
      </article></SceneMotion>
    </main> : <main className="relative z-10 flex-1 pb-8">
      {guided ? <div className="mx-auto mt-8 max-w-4xl px-5 text-center"><p dir="ltr" className="text-[10px] tracking-[.24em] opacity-60">SCENE {String(step+1).padStart(2,'0')} / {String(scenes.length).padStart(2,'0')}</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{current==='experience'?site.templateNameAr:sceneNames[current]}</h1></div> : <SceneMotion enabled={useTransitions} sceneKey="hero"><HeroBlock variant={cfg.hero} typographyVariant={cfg.typography} buttonVariant={cfg.button} colors={colors} recipientName={site.recipientName} senderName={site.senderName} headline={site.headline} subheadline={site.subheadline} eventDate={site.eventDate} coverImage={cover} liteMode={!ready||lite} onPrimaryAction={()=>experienceRef.current?.scrollIntoView({behavior:lite?'instant':'smooth'})}/></SceneMotion>}
      {show('experience') && <section ref={experienceRef} className="relative mx-auto max-w-6xl px-5 py-10"><SceneMotion enabled={useTransitions} sceneKey="experience">
        {sceneExperiences.has(site.experienceType)?<TemplateScenes site={site} lite={lite} celebrate={()=>celebrate('confetti')}/>:<InteractiveExperienceModule siteSlug={site.slug} isPreview={site.isPreview} experienceType={site.experienceType} colors={colors} buttonVariant={cfg.button} senderName={site.senderName} recipientName={site.recipientName} mainMessage={site.mainMessage} finalSurpriseText={site.finalSurpriseText} eventDate={site.eventDate} coverImage={cover} customFields={site.customFields} onCelebrate={celebrate} enableGift3d={has3d && giftScene} liteMode={lite}/>}
      </SceneMotion></section>}
      {show('experience') && site.experienceType!=='voice-stage' && cfg.sections.includes('audio') && site.musicTrack!=='none' && <section className="px-5 py-6"><AmbientAudioPlayer trackId={site.musicTrack} primaryColor={colors.primary} isLight={light} variant="section" senderName={site.senderName}/></section>}
      {hasGallery && show('gallery') && <SceneMotion enabled={useTransitions} sceneKey="gallery"><GalleryBlock variant={cfg.gallery} images={site.images} colors={colors}/></SceneMotion>}
      {site.finalSurpriseText && show('finale') && <section className="mx-auto max-w-3xl px-5 py-8 text-center"><SceneMotion enabled={useTransitions} sceneKey={finaleOpened?'finale-revealed':'finale'}><article className={`space-y-5 rounded-[2rem] border p-8 backdrop-blur-xl sm:p-12 ${surface}`}><Sparkles size={29} className="mx-auto" style={{color:colors.accent}}/>
        {!finaleOpened && site.categorySlug!=='portfolio'?<><h2 className="text-2xl font-bold">المشهد الختامي</h2><p className="text-sm opacity-75">كلمة أخيرة من {site.senderName}، محفوظة لك في نهاية الحكاية.</p><ThemedButton variant={cfg.button} colors={colors} liteMode={lite} onClick={()=>{setFinaleOpened(true);void celebrate('fireworks');}}>اكشف الرسالة الختامية</ThemedButton></>:<><p className="text-xl leading-relaxed font-bold sm:text-2xl">{site.finalSurpriseText}</p><p className="text-sm opacity-70">{site.senderName} · {site.recipientName}</p></>}
      </article></SceneMotion></section>}
    </main>}
    {guided && step>0 && <div className="visitor-scene-controls"><button type="button" onClick={()=>go(step-1)}><ArrowRight size={15}/>السابق</button>{step<scenes.length-1?<button type="button" onClick={()=>go(step+1)}>التالي: {sceneNames[scenes[step+1]]}<ArrowLeft size={15}/></button>:<button type="button" onClick={()=>{setFinaleOpened(false);go(0);}}><RotateCcw size={14}/>إعادة الرحلة</button>}</div>}
    <DeveloperFooter mode={colors.mode} accentColor={colors.accent}/>
  </div>;
}
