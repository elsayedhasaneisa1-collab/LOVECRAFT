'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUpLeft, Bookmark, BookOpen, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Crown, Eye, Gamepad2, Heart, LayoutGrid, Layers3, Mail, Menu, Palette, PanelTop, PartyPopper, Route, WandSparkles, Play, Plus, Search, Send, SlidersHorizontal, Sparkles, UsersRound, X } from 'lucide-react';
import type { LibraryData, LibraryItem } from '@/lib/studio-catalog';
import type { StudioSearch } from './StudioHome';
import { StudioBrand, StudioMark } from './StudioBrand';
import { DeveloperFooter } from '@/components/shared/DeveloperFooter';
import { StudioJourneyGuide } from './StudioJourneyGuide';
import './studio.css';
import './motion-studio.css';

const categoryIcons = { love: Heart, events: PartyPopper, friends: UsersRound, games: Gamepad2, portfolio: Palette, messages: Mail };
const shortNames: Record<string, string> = { love:'الحب والرومانسية', events:'المناسبات', friends:'الأصدقاء', games:'الألعاب', portfolio:'التصميم والإبداع', messages:'الرسائل والمفاجآت' };
const priority = ['love-confession','wedding-celebration','squad-memories','choose-your-box','personal-portfolio','msg-after-countdown','anniversary','newborn-welcome','wheel-of-fortune','photography-exhibition','first-meeting','msg-video-surprise'];
const collectionNames: Record<string, string> = { love:'Love Letters', events:'Golden Occasions', friends:'Memory Lane', games:'Playroom', portfolio:'Creative Studio', messages:'After Midnight' };
const heroSlides = [
  { label:'مجموعة التجارب التفاعلية', title:'لحظاتك، بتجربة', accent:'تنبض بالحياة.', description:'قوالب تفاعلية تجمع الحركة والعمق ثلاثي الأبعاد، لتحكي حكايتك بطريقتك.', image:'/images/motion-collection.webp', slug:'love-interactive-gift', index:'MOTION COLLECTION' },
  { label:'مجموعة اللحظات', title:'كلمات من القلب،', accent:'في مساحة تخصّك.', description:'رسالة تختار كلماتها، وختم يفتحه من تحب. اصنع لحظة لا تشبه الرسائل العادية.', image:'/images/moments-collection.webp', slug:'love-confession', index:'LETTER COLLECTION' },
  { label:'مجموعة المناسبات', title:'احتفالاتك تبدأ', accent:'بدعوة لا تُنسى.', description:'اجمع تفاصيل يومك المميز في دعوة أنيقة، وشاركها مع كل من تحب.', image:'/images/cat-events.jpg', slug:'wedding-celebration', index:'OCCASION COLLECTION' },
];
const STORAGE = 'lovecraft.saved.templates.v2';
const PAGE_SIZE = 9;
function categoryIcon(slug: string) { return categoryIcons[slug as keyof typeof categoryIcons] || Layers3; }
function cleanQuery(s: string) { return s.toLowerCase().replace(/[\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').trim(); }

export function StudioLibrary({ data, initial }: { data: LibraryData; initial: StudioSearch }) {
  const initialCategory = data.categories.some(c => c.slug === initial.category) ? initial.category! : 'all';
  const [category, setCategory] = useState(initialCategory);
  const [savedOnly, setSavedOnly] = useState(initial.view === 'saved');
  const [tier, setTier] = useState(initial.tier === 'premium' || initial.tier === 'free' ? initial.tier : 'all');
  const [query, setQuery] = useState(initial.q || '');
  const [motionFilter,setMotionFilter] = useState(initial.motion==='3d'?'3d':'all');
  const [sort, setSort] = useState('curated');
  const [slide, setSlide] = useState(0);
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<'guide'|'help'|'journey'>('guide');
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileNav = useRef<HTMLDialogElement>(null);
  const filter = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const load = () => { try { const a: unknown = JSON.parse(localStorage.getItem(STORAGE)||'[]'); if (Array.isArray(a)) setSaved(a.filter((s): s is string => typeof s === 'string')); } catch { /* Storage may be disabled. */ } };
    load(); window.addEventListener('storage',load);
    const keyboard = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))) {
        e.preventDefault(); input.current?.focus();
      }
      if (e.key === 'Escape') setFilterOpen(false);
    };
    window.addEventListener('keydown',keyboard);
    return () => { window.removeEventListener('storage',load); window.removeEventListener('keydown',keyboard); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    if (!filterOpen) return;
    const close = (event: PointerEvent) => { if (!filter.current?.contains(event.target as Node)) setFilterOpen(false); };
    document.addEventListener('pointerdown',close); return () => document.removeEventListener('pointerdown',close);
  }, [filterOpen]);
  useEffect(() => { if (drawer) mobileNav.current?.showModal(); else mobileNav.current?.close(); }, [drawer]);

  const announce = (message: string) => { setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(()=>setNotice(''),2400); };
  const toggleSave = (slug: string) => {
    const removing = saved.includes(slug);
    const next = removing ? saved.filter(s => s!==slug) : [...saved,slug];
    setSaved(next); try { localStorage.setItem(STORAGE,JSON.stringify(next)); } catch { /* Keep session selection. */ }
    announce(removing ? 'أُزيل القالب من المحفوظات' : 'تم حفظ القالب في مجموعتك');
  };
  const focusGallery = () => { setTimeout(() => gallery.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}),30); };
  const selectCategory = (slug:string, scroll=false) => { setCategory(slug); setPage(1); setSavedOnly(false); setDrawer(false); if(scroll) focusGallery(); };
  const openSaved = () => { setSavedOnly(true); setCategory('all'); setQuery(''); setTier('all'); setMotionFilter('all'); setPage(1); setDrawer(false); window.scrollTo({top:0}); };
  const openHelp = (topic:'help'|'guide'|'journey') => { setHelpTopic(topic); setDrawer(false); dialog.current?.showModal(); };
  const reset = () => { setCategory('all'); setQuery(''); setTier('all'); setMotionFilter('all'); setPage(1); setSort('curated'); };
  const filtered = useMemo(() => {
    const q = cleanQuery(query);
    const list = data.items.filter(t => (!savedOnly || saved.includes(t.slug)) && (category === 'all' || t.category===category) && (tier === 'all' || t.tier===tier) && (motionFilter==='all' || (motionFilter==='3d' ? t.motion.three : t.motion.transitions)) && (!q || cleanQuery([t.title,t.english,t.description,shortNames[t.category]].join(' ')).includes(q)));
    return list.sort((a,b) => {
      if(sort === 'name') return a.title.localeCompare(b.title,'ar');
      if(sort === 'latest') return b.id - a.id;
      const aRank=priority.indexOf(a.slug), bRank=priority.indexOf(b.slug);
      return (aRank<0?999:aRank)-(bRank<0?999:bRank) || Number(b.featured)-Number(a.featured) || a.order-b.order || a.id-b.id;
    });
  }, [data.items,saved,savedOnly,category,tier,query,sort,motionFilter]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const current=Math.min(page,pages);
  const visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
  const publishedSlugs = new Set(data.items.map(t=>t.slug));
  const slides = heroSlides.filter(h=>publishedSlugs.has(h.slug));
  const hero=slides[slide%Math.max(1,slides.length)];
  const threeCount=data.items.filter(t=>t.motion.three).length;
  const journeySample=data.items.find(t=>t.slug==='love-interactive-gift')?.slug || data.items.find(t=>t.motion.three)?.slug;
  function open3d() {setCategory('all');setSavedOnly(false);setTier('all');setQuery('');setSort('curated');setMotionFilter('3d');setPage(1);setDrawer(false);focusGallery();}
  const showHero=!savedOnly && !query;
  const sectionTitle=savedOnly?'القوالب المحفوظة':motionFilter==='3d'?'مشاهد ثلاثية الأبعاد':'مكتبة القوالب';

  function sidebar() { return <>
    <div className="rail-brand"><StudioBrand/></div>
    <div className="rail-scroll">
      <p className="rail-label">مساحة العمل</p>
      <nav className="rail-menu" aria-label="مساحة العمل">
        <button className={!savedOnly&&motionFilter!=='3d'?'selected':''} onClick={()=>{reset();setSavedOnly(false);setDrawer(false);window.scrollTo({top:0,behavior:'smooth'});}}><LayoutGrid size={18}/>مكتبة القوالب<i className="rail-active-dot"/></button>
        <button className={!savedOnly&&motionFilter==='3d'?'selected':''} onClick={open3d}><Boxes size={18}/>مشاهد ثلاثية الأبعاد<small className="rail-3d-tag" dir="ltr">3D</small></button>
        <Link href="/components-lab"><Layers3 size={18}/>عناصر التصميم</Link>
        <button className={savedOnly?'selected':''} onClick={openSaved}><Bookmark size={18}/>المحفوظات{saved.length>0 && <span className="rail-count">{saved.length}</span>}</button>
      </nav>
      <div className="rail-rule"/>
      <p className="rail-label">تصنيفات القوالب</p>
      <nav className="rail-menu rail-collections" aria-label="تصنيفات القوالب">{data.categories.map(c=>{const Icon=categoryIcon(c.slug);return <button key={c.slug} className={!savedOnly&&category===c.slug?'category-selected':''} onClick={()=>selectCategory(c.slug,true)}><Icon size={17}/><span>{c.title}</span><small>{c.total}</small></button>;})}</nav>
      <div className="rail-rule"/>
      <p className="rail-label">مركز المساعدة</p>
      <nav className="rail-menu" aria-label="مركز المساعدة"><button onClick={()=>openHelp('journey')}><Route size={17}/>رحلة المستخدم</button><button onClick={()=>openHelp('guide')}><BookOpen size={17}/>دليل الاستخدام</button><button onClick={()=>openHelp('help')}><CircleHelp size={17}/>الأسئلة الشائعة</button></nav>
    </div>
    <div className="rail-bottom"><a href={`https://t.me/${data.botUsername}`} target="_blank" rel="noopener noreferrer"><span className="rail-tg"><Send size={16}/></span><span><strong>بوت تيليجرام</strong><small dir="ltr">@{data.botUsername}</small></span><ArrowUpLeft size={15}/></a><p dir="ltr">Your Moments. Your Website.</p></div>
  </>; }

  return <div className="lc-studio" dir="rtl">
    <aside className="studio-rail">{sidebar()}</aside>
    <dialog className="studio-mobile-rail" ref={mobileNav} onCancel={()=>setDrawer(false)} onClose={()=>setDrawer(false)} onClick={e=>{if(e.target===e.currentTarget)setDrawer(false);}}><div className="mobile-rail-inner"><button className="mobile-rail-close" aria-label="إغلاق القائمة" onClick={()=>setDrawer(false)}><X size={19}/></button>{drawer && sidebar()}</div></dialog>
    <div className="studio-body">
      <header className="studio-toolbar">
        <div className="studio-crumbs"><button className="mobile-nav-open" aria-label="فتح القائمة" onClick={()=>setDrawer(true)}><Menu size={21}/></button><span className="crumb-home"><PanelTop size={15}/>مساحة العمل</span><ChevronLeft size={12}/><b className="crumb-section">{sectionTitle}</b><span className="mobile-wordmark" dir="ltr">LOVECRAFT<StudioMark size={22}/></span></div>
        <div className="toolbar-actions"><label className="studio-search"><Search size={16}/><input ref={input} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="ابحث عن قالب..." aria-label="ابحث عن قالب"/>{query ? <button type="button" aria-label="مسح البحث" onClick={()=>{setQuery('');input.current?.focus();}}><X size={13}/></button>:<kbd dir="ltr">/</kbd>}</label><Link href="/bot" className="studio-create"><Plus size={16}/><span>إنشاء موقع</span></Link></div>
      </header>
      <main className="studio-content">
        {showHero && hero && <>
          <section className={`collection-banner slide-${slide}`} aria-label="مجموعة الاستوديو المختارة">
            <img key={hero.image} className="banner-image" src={hero.image} alt="" fetchPriority="high"/>
            <div className="banner-shade"/>
            <div className="hero-copy" key={hero.slug}>
              <span className="collection-eyebrow"><Sparkles size={13}/>{hero.label}<span className="eyebrow-dot"/>٢٠٢٦</span>
              <h1>{hero.title}<em>{hero.accent}</em></h1>
              <p>{hero.description}</p>
              <div className="hero-actions"><Link className="hero-primary-link" prefetch={false} href={`/preview/${hero.slug}?journey=1`}><Play size={12} fill="currentColor"/>جرّب الرحلة</Link><button className="hero-secondary-action" onClick={()=>{reset();focusGallery();}}>استكشف القوالب<ArrowLeft size={14}/></button></div>
            </div>
            <div className="hero-index" dir="ltr"><span>LC</span><i/>{hero.index}</div>
            <div className="hero-pagination" dir="ltr">{slides.map((s,i)=><button key={s.slug} className={slide===i?'active':''} aria-label={`عرض ${s.label}`} aria-pressed={slide===i} onClick={()=>setSlide(i)}/>)}</div>
          </section>
          <div className="studio-facts motion-studio-facts" aria-label="إحصائيات المكتبة">
            <div><span className="fact-icon"><PanelTop size={21}/></span><p><strong>{data.items.length}</strong><span>قالب جاهز</span></p></div>
            <div><span className="fact-icon"><LayoutGrid size={21}/></span><p><strong>{String(data.categories.length).padStart(2,'0')}</strong><span>تصنيفات متنوعة</span></p></div>
            <div><span className="fact-icon"><Layers3 size={21}/></span><p><strong>{data.components}</strong><span>عنصر تصميم</span></p></div>
            <div><button type="button" className="fact-3d-link" onClick={open3d} aria-label={`عرض ${threeCount} قالبًا ثلاثي الأبعاد`}><span className="fact-icon"><Boxes size={21}/></span><p><strong>{threeCount}</strong><span>قالب ثلاثي الأبعاد</span></p><ArrowUpLeft size={12}/></button></div>
          </div>
        </>}
        <section ref={gallery} className="library-section" id="library" aria-label={sectionTitle}>
          <div className="library-heading"><div><span className="editorial-kicker" dir="ltr"><i/>{savedOnly?'SAVED COLLECTION':'TEMPLATE LIBRARY'}</span><h2>{sectionTitle}</h2><p>{savedOnly?'مجموعة القوالب التي احتفظت بها على هذا الجهاز.':'تصفّح التصاميم، واختر القالب الذي يناسب لحظتك.'}</p></div>
            <div className="library-filter-box" ref={filter}><button className={`library-filter ${tier!=='all'||sort!=='curated'||motionFilter!=='all'?'has-filter':''}`} aria-expanded={filterOpen} onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={14}/>تصفية وترتيب<ChevronDown size={12}/></button>
              {filterOpen && <div className="library-filter-pop"><strong>خيارات العرض</strong><label>فئة القالب<select aria-label="فئة القالب" value={tier} onChange={e=>{setTier(e.target.value);setPage(1);}}><option value="all">جميع الفئات</option><option value="free">مجاني</option><option value="premium">مميز</option></select></label><label>المؤثرات<select aria-label="المؤثرات" value={motionFilter} onChange={e=>{setMotionFilter(e.target.value);setPage(1);}}><option value="all">كل التجارب</option><option value="3d">مشاهد 3D · Three.js</option><option value="transitions">انتقالات المشاهد · Motion</option></select></label><label>ترتيب حسب<select aria-label="ترتيب حسب" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="curated">اختيارات الاستوديو</option><option value="latest">الأحدث أولًا</option><option value="name">الاسم (أ – ي)</option></select></label><button className="filter-done" onClick={()=>setFilterOpen(false)}>عرض {filtered.length} قالبًا<Check size={14}/></button></div>}
            </div>
          </div>
          <div className="library-tabs" role="group" aria-label="تصفية القوالب بالتصنيف">
            <button className={category==='all'?'active':''} aria-pressed={category==='all'} onClick={()=>{setCategory('all');setPage(1);}}><LayoutGrid size={14}/>الكل</button>
            {data.categories.map(c=>{const Icon=categoryIcon(c.slug);return <button key={c.slug} className={category===c.slug?'active':''} aria-pressed={category===c.slug} onClick={()=>{setCategory(c.slug);setPage(1);}}><Icon size={14}/>{c.title}</button>;})}
          </div>
          {(query||tier!=='all'||motionFilter!=='all') && <div className="result-note"><span>{filtered.length} نتيجة {query ? `للبحث عن «${query}»` : motionFilter==='3d'?'بمشاهد Three.js':motionFilter==='transitions'?'بانتقالات Motion':tier==='free'?'ضمن القوالب المجانية':'ضمن القوالب المميزة'}</span><button onClick={reset}>مسح التصفية<X size={12}/></button></div>}
          {visible.length ? <div className="studio-card-grid">{visible.map((t,i)=><TemplateCard key={t.slug} item={t} isSaved={saved.includes(t.slug)} toggle={()=>toggleSave(t.slug)} eager={i<3}/>)}</div> : <div className="studio-empty">{savedOnly?<Bookmark size={30}/>:<Search size={30}/>}<h3>{savedOnly&&!saved.length?'مجموعتك تبدأ من هنا':'لا توجد قوالب مطابقة'}</h3><p>{savedOnly&&!saved.length?'اضغط على علامة الحفظ في أي قالب لتعود إليه هنا.':'جرّب اسم قالب آخر أو غيّر خيارات التصفية.'}</p><button onClick={()=>{reset();if(savedOnly&&!saved.length)setSavedOnly(false);}}>عرض القوالب<ArrowLeft size={14}/></button></div>}
          {pages>1 && <div className="studio-pager"><span>عرض {(current-1)*PAGE_SIZE+1}–{Math.min(current*PAGE_SIZE,filtered.length)} من {filtered.length} قالب</span><div><button disabled={current===1} aria-label="الصفحة السابقة" onClick={()=>{setPage(current-1);focusGallery();}}><ChevronRight size={16}/></button><b>{current}</b><span>/ {pages}</span><button disabled={current===pages} aria-label="الصفحة التالية" onClick={()=>{setPage(current+1);focusGallery();}}><ChevronLeft size={16}/></button></div></div>}
        </section>
      </main>
      <DeveloperFooter mode="light"/>
    </div>
    <div className={`studio-notice ${notice?'visible':''}`} role="status">{notice && <><Check size={15}/>{notice}</>}</div>
    <dialog ref={dialog} className="studio-help" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}><div className="studio-help-inner"><button className="help-close" onClick={()=>dialog.current?.close()} aria-label="إغلاق"><X size={18}/></button>{helpTopic==='journey'?<StudioJourneyGuide slug={journeySample} onClose={()=>dialog.current?.close()}/>:<><span className="help-symbol">{helpTopic==='guide'?<BookOpen size={24}/>:<CircleHelp size={24}/>}</span><p className="editorial-kicker" dir="ltr">STUDIO HANDBOOK</p><h2>{helpTopic==='guide'?'من لحظة إلى موقع':'أسئلتك عن القوالب'}</h2>{helpTopic==='guide'?<ol><li><b>اختر التصميم</b><p>تصفّح التصنيفات وافتح المعاينة الحية لتجربة التفاعلات قبل الاختيار.</p></li><li><b>أضف لمستك</b><p>اختر «استخدم هذا القالب»، ثم أضف رسالتك وصورك وحدّد الألوان والمدة.</p></li><li><b>شارك موقعك</b><p>راجع الملخص وأكّد الإنشاء لتحصل على رابط مستقل قابل للمشاركة.</p></li></ol>:<div className="studio-faq">{[['هل يمكنني تجربة القالب قبل إنشائه؟','نعم. افتح معاينة أي قالب لتجربة التصميم والتفاعلات دون إنشاء موقع أو استهلاك رصيد.'],['ما الفرق بين القالب المجاني والمميز؟','القالب المجاني متاح وفق حدود حسابك. القوالب المميزة تحتاج رصيد إنشاء من الإحالات المعتمدة، وتظهر التكلفة قبل التأكيد.'],['هل يعمل الموقع على الهاتف؟','تتكيّف الواجهات مع حجم الشاشة. ويمكن للزائر تفعيل الوضع الخفيف وإبقاء الموسيقى متوقفة.'],['هل يمكن تعديل الموقع بعد الإنشاء؟','من قائمة «مواقعي» في البوت، اختر الموقع ثم عدّل العنوان أو الرسالة أو الخاتمة. يظل رابط الموقع كما هو.']].map(([q,a],i)=><details key={q} open={i===0}><summary>{q}</summary><p>{a}</p></details>)}</div>}<button className="help-action" onClick={()=>{dialog.current?.close();focusGallery();}}>تصفّح المكتبة<ArrowDown size={14}/></button></>}</div></dialog>
  </div>;
}

function TemplateCard({ item:t, isSaved, toggle, eager }: {item:LibraryItem;isSaved:boolean;toggle:()=>void;eager:boolean}) {
  const Icon=categoryIcon(t.category);
  const img=t.image===`/images/cat-${t.category}.jpg`?`/images/cover-${t.category}.webp`:t.image;
  return <article className={`studio-card card-${t.category}`} data-three={t.motion.three?'true':'false'}>
    <div className="card-picture"><Link href={`/preview/${t.slug}`} prefetch={false} aria-label={`معاينة ${t.title}`}><img src={img} alt={t.title} loading={eager?'eager':'lazy'} width={750} height={480}/><span className="card-picture-shade"/><span className="cover-lettering" dir="ltr">{collectionNames[t.category]||t.english}</span><span className="card-preview-hover"><Eye size={16}/>معاينة مباشرة</span></Link>
      <span className={`card-tier ${t.tier==='premium'?'tier-premium':''}`}>{t.tier==='premium'?<Crown size={11}/>:<i/>}{t.tier==='premium'?'مميز':'مجاني'}</span>
      <button aria-label={isSaved?`إزالة ${t.title} من المحفوظات`:`حفظ ${t.title}`} title={isSaved?'إزالة من المحفوظات':'حفظ القالب'} aria-pressed={isSaved} className={`save-template ${isSaved?'is-saved':''}`} onClick={toggle}><Bookmark size={15} fill={isSaved?'currentColor':'none'}/></button>
    </div>
    <div className="card-description"><div className="card-meta-line"><span className="card-category"><Icon size={12}/>{shortNames[t.category]||t.category}</span><span className="card-motion-label" title={t.motion.three?'مشهد تفاعلي يستخدم Three.js':t.motion.transitions?'انتقالات باستخدام Motion':'تفاعلات مخصّصة داخل القالب'}>{t.motion.three?<Boxes size={11}/>:<WandSparkles size={11}/>}<small dir="ltr">{t.motion.three?'3D':t.motion.transitions?'Motion':'Interactive'}</small></span></div><h3><Link href={`/preview/${t.slug}`} prefetch={false}>{t.title}</Link></h3><p>{t.description}</p></div>
    <div className="card-links"><Link href={`/preview/${t.slug}`} prefetch={false}><Eye size={14}/>معاينة القالب</Link><Link className="use-template-link" href={`/bot?template=${t.slug}`} prefetch={false}>استخدام القالب<ArrowLeft size={13}/></Link></div>
  </article>;
}
