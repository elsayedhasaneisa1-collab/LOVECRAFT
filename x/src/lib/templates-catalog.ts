import { getPaletteById } from "./components-catalog";

export type ExperienceType =
  | "envelope-letter"
  | "days-counter"
  | "countdown-unlock"
  | "secret-vault"
  | "gift-box-reveal"
  | "mystery-boxes"
  | "mystery-doors"
  | "lucky-wheel"
  | "interactive-quiz"
  | "true-false-game"
  | "memory-order-game"
  | "treasure-stages"
  | "scratch-photo"
  | "love-jar"
  | "proposal-choice"
  | "story-journey"
  | "memory-showcase"
  | "voice-stage"
  | "cinema-premiere"
  | "celebration-rsvp"
  | "portfolio-studio"
  | "cv-architect"
  | "links-showcase"
  | "agency-flagship"
  | "progressive-reveal";

export interface CategorySeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  descriptionAr: string;
  coverImage: string;
  accentColor: string;
  sortOrder: number;
}

export interface TemplateFieldSchema {
  key: string;
  labelAr: string;
  promptAr: string;
  type: "text" | "textarea" | "date" | "code" | "list";
  required: boolean;
  placeholderAr: string;
}

export interface TemplateSeed {
  categorySlug: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  previewImage: string;
  githubPath: string;
  tier: "free" | "premium";
  creditCost: number;
  isFeatured: boolean;
  sortOrder: number;
  experienceType: ExperienceType;
  paletteId: string;
  hero: string;
  background: string;
  typography: string;
  button: string;
  gallery: string;
  sections: string[];
  effects: string[];
  introStyle: string;
  musicTrack: string;
  extraFields?: TemplateFieldSchema[];
  sampleCustomFields?: Record<string, unknown>;
}

export const TEMPLATE_CATEGORIES_SEED: CategorySeed[] = [
  {
    slug: "love",
    nameAr: "الحب والرومانسية",
    nameEn: "Love & Romance",
    emoji: "❤️",
    descriptionAr: "مظاريف مختومة، عدادات أيام حية، صناديق رسائل، وقصص سينمائية تخلّد أصدق المشاعر.",
    coverImage: "/images/cat-love.jpg",
    accentColor: "#e11d48",
    sortOrder: 1,
  },
  {
    slug: "events",
    nameAr: "المناسبات",
    nameEn: "Events & Celebrations",
    emoji: "🎂",
    descriptionAr: "دعوات زفاف وخطوبة تفاعلية، أعياد ميلاد، تخرج، وأعياد بتصميم ملكي فاخر.",
    coverImage: "/images/cat-events.jpg",
    accentColor: "#d97706",
    sortOrder: 2,
  },
  {
    slug: "friends",
    nameAr: "الأصدقاء",
    nameEn: "Friends & Squad",
    emoji: "🫂",
    descriptionAr: "اختبارات الصداقة، ألبومات بولارويد الشلة، رسائل الامتنان، وتحديات مرحة.",
    coverImage: "/images/cat-friends.jpg",
    accentColor: "#ea580c",
    sortOrder: 3,
  },
  {
    slug: "games",
    nameAr: "الألعاب",
    nameEn: "Interactive Games",
    emoji: "🎮",
    descriptionAr: "عجلة الحظ، صناديق وأبواب الغموض، فك الشفرات، البحث عن الكنز، وترتيب الذكريات.",
    coverImage: "/images/cat-games.jpg",
    accentColor: "#8b5cf6",
    sortOrder: 4,
  },
  {
    slug: "portfolio",
    nameAr: "التصميم والإبداع",
    nameEn: "Portfolio & Creative",
    emoji: "🎨",
    descriptionAr: "معارض أعمال احترافية، سير ذاتية معمارية، صفحات مطورين ووكالات وروابط موحدة.",
    coverImage: "/images/cat-portfolio.jpg",
    accentColor: "#38bdf8",
    sortOrder: 5,
  },
  {
    slug: "messages",
    nameAr: "الرسائل والمفاجآت",
    nameEn: "Messages & Surprises",
    emoji: "💌",
    descriptionAr: "رسائل بعد العد التنازلي، خزائن سرية، كشط الصور المخفية، ومشاهد ختامية مؤثرة.",
    coverImage: "/images/cat-messages.jpg",
    accentColor: "#f59e0b",
    sortOrder: 6,
  },
];

// Compact definition helper to guarantee all 110 templates have distinct visual/interactive configurations
type CompactTpl = [
  slug: string,
  nameAr: string,
  nameEn: string,
  descriptionAr: string,
  experienceType: ExperienceType,
  paletteId: string,
  hero: string,
  background: string,
  typography: string,
  button: string,
  gallery: string,
  sections: string[],
  effects: string[],
  introStyle: string,
  tier?: "free" | "premium",
  featured?: boolean,
];

const LOVE_ITEMS: CompactTpl[] = [
  ["love-confession", "اعتراف بالحب", "Love Confession", "ظرف مخملي مختوم بالشمع القرمزي ينفتح باللمس ليكشف رسالة اعتراف شاعرية مع نبض قلوب هادئ.", "envelope-letter", "crimson-velvet", "cinematic", "floating-hearts", "typewriter", "glass", "memory-gallery", ["interactive-messages", "audio", "final-surprise"], ["floating-hearts", "scroll-reveal", "smooth-transitions"], "wax-seal", "free", true],
  ["first-meeting", "أول لقاء", "First Meeting", "رحلة سردية سينمائية توثق تفاصيل اللقاء الأول بالمكان والتاريخ والمشاهد المتتابعة.", "story-journey", "crimson-velvet", "parallax", "stars", "cinematic-text", "floating", "cinematic", ["timeline", "storytelling", "final-surprise"], ["parallax", "stars", "scroll-reveal"], "curtain", "free", false],
  ["anniversary", "ذكرى الارتباط", "Anniversary", "احتفالية ذكرى الارتباط مع عداد حي للسنوات والأيام والثواني وخط زمني لأجمل المحطات.", "days-counter", "royal-gold", "3d", "golden", "gradient-text", "gradient", "3d-gallery", ["countdown", "timeline", "gift-box", "final-surprise"], ["3d-objects", "confetti", "scroll-reveal"], "portal", "premium", false],
  ["valentines-day", "عيد الحب", "Valentine's Day", "جرّة رسائل الحب المضيئة التي تمنح بطاقة حب جديدة مع كل نقرة ومشهد ختامي رومانسي.", "love-jar", "crimson-velvet", "glass", "floating-hearts", "glow", "animated", "carousel", ["interactive-messages", "cards", "final-surprise"], ["floating-hearts", "particles", "smooth-transitions"], "wax-seal", "free", false],
  ["beloved-birthday", "عيد ميلاد الحبيبة", "Beloved Birthday", "صندوق هدية ثلاثي الأبعاد يهتز وينفتح وسط قصاصات الاحتفال ليكشف التهنئة وألبوم الذكريات.", "gift-box-reveal", "ivory-champagne", "split-screen", "particles", "reveal", "3d", "masonry", ["gift-box", "audio", "final-surprise"], ["confetti", "floating-hearts", "scroll-reveal"], "gift-ribbon", "free", false],
  ["apology-reconcile", "اعتذار ومصالحة", "Apology & Reconcile", "رسالة هادئة داخل ظرف عاجي أنيق مع بطاقات وعود صادقة وزر قبول المصالحة التفاعلي.", "envelope-letter", "ivory-champagne", "minimal", "animated-gradient", "typewriter", "minimal", "grid", ["cards", "interactive-messages", "final-surprise"], ["smooth-transitions", "scroll-reveal"], "wax-seal", "free", false],
  ["second-chance", "طلب فرصة ثانية", "Second Chance", "فصول متدرجة تُفتح خطوة بخطوة تحكي قيمة العلاقة وتنتهي بطلب بداية جديدة.", "progressive-reveal", "midnight-cosmos", "cinematic", "stars", "split-text", "glass", "before-after", ["storytelling", "image-comparison", "final-surprise"], ["stars", "smooth-transitions", "scroll-reveal"], "curtain", "free", false],
  ["love-secret-message", "رسالة سرية", "Secret Love Message", "خزنة رقمية محمية برمز سري خاص لا يفتحها إلا من يعرف تاريخكما المميز.", "secret-vault", "midnight-cosmos", "neon", "space", "glow", "neon", "fullscreen", ["interactive-messages", "final-surprise"], ["particles", "stars", "magnetic-elements"], "vault-lock", "premium", false],
  ["love-story", "قصة حب", "Love Story", "كتاب رقمي فخم مقسم إلى فصول مصورة مع موسيقى بيانو اختيارية وخط زمني متكامل.", "story-journey", "crimson-velvet", "image-bg", "gradient", "cinematic-text", "gradient", "parallax", ["storytelling", "timeline", "audio", "final-surprise"], ["parallax", "scroll-reveal", "floating-hearts"], "curtain", "free", false],
  ["love-memory-album", "ألبوم ذكريات", "Memory Album", "معرض بولارويد تفاعلي مع مقارنة قبل وبعد وعارض ملء الشاشة لأجمل اللحظات المصورة.", "memory-showcase", "ivory-champagne", "split-screen", "glassmorphism", "reveal", "floating", "memory-gallery", ["image-comparison", "timeline", "final-surprise"], ["scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["days-together-counter", "عداد الأيام معاً", "Days Together Counter", "ساعة زمنية حية تحسب كل ثانية جمعتكما منذ أول يوم مع إحصائيات شاعرية مبهجة.", "days-counter", "crimson-velvet", "countdown", "3d", "3d-text", "magnetic", "carousel", ["countdown", "statistics", "final-surprise"], ["3d-objects", "floating-hearts", "particles"], "portal", "free", false],
  ["love-final-surprise", "مفاجأة في النهاية", "Surprise at the End", "تجربة تمرير مشوّقة تقود الزائر عبر إشارات لطيفة حتى تنفجر المفاجأة الكبرى في الخاتمة.", "progressive-reveal", "royal-gold", "parallax", "golden", "animated-headings", "animated", "cinematic", ["storytelling", "gift-box", "final-surprise"], ["fireworks", "confetti", "scroll-reveal"], "curtain", "free", false],
  ["marriage-proposal", "طلب الزواج", "Marriage Proposal", "مشهد سينمائي مهيب ثلاثي الأبعاد ينتهي بالسؤال الأغلى «هل تقبلين الزواج بي؟» واحتفال مبهر.", "proposal-choice", "royal-gold", "3d", "3d", "cinematic-text", "gradient", "3d-gallery", ["timeline", "audio", "final-surprise"], ["3d-objects", "fireworks", "floating-hearts", "confetti"], "portal", "premium", false],
  ["love-letters-box", "صندوق رسائل الحب", "Love Letters Box", "صندوق خشبي رقمي يضم رسائل مرقّمة «افتحيها عندما تشتاقين» بتصميم دافئ وحميمي.", "love-jar", "crimson-velvet", "glass", "particles", "reveal", "svg-icons", "grid", ["interactive-messages", "cards", "final-surprise"], ["floating-hearts", "particles", "smooth-transitions"], "wax-seal", "free", false],
  ["love-interactive-quiz", "أسئلة تفاعلية", "Couple Interactive Quiz", "لعبة أسئلة رومانسية ممتعة تختبر تفاصيل ذكرياتكما وتكشف رسالة خاصة عند إكمالها.", "interactive-quiz", "crimson-velvet", "neon", "animated-gradient", "animated-headings", "interactive", "carousel", ["cards", "final-surprise"], ["confetti", "floating-hearts", "magnetic-elements"], "minimal-fade", "free", false],
  ["love-envelope-letter", "رسالة داخل ظرف", "Letter Inside Envelope", "تصميم بريدي كلاسيكي بطابع تذكاري وختم شمعي ينطوي ثلاثي الأبعاد ليخرج الورق المعطّر.", "envelope-letter", "ivory-champagne", "minimal", "nature", "typewriter", "glass", "memory-gallery", ["interactive-messages", "final-surprise"], ["smooth-transitions", "floating-hearts"], "wax-seal", "free", false],
  ["love-voice-message", "رسالة صوتية", "Voice Note Tribute", "مشغّل موجات صوتية ونغمات دافئة يعمل بلمسة الزائر مترافقاً مع كلمات تظهر بإيقاع هادئ.", "voice-stage", "midnight-cosmos", "video", "stars", "glow", "floating", "cinematic", ["audio", "storytelling", "final-surprise"], ["stars", "particles", "smooth-transitions"], "curtain", "premium", false],
  ["love-animated-album", "ألبوم متحرك", "Animated Love Album", "معرض ثلاثي الأبعاد دوّار يعرض الصور كشريط ذكريات حي مع انتقالات حريرية.", "memory-showcase", "crimson-velvet", "video", "video", "gradient-text", "animated", "3d-gallery", ["video", "timeline", "final-surprise"], ["3d-objects", "parallax", "smooth-transitions"], "curtain", "premium", false],
  ["love-interactive-gift", "هدية تفاعلية", "Interactive Love Gift", "علبة مجوهرات مضيئة تُفتح على ثلاث نقرات متتالية مع مؤثرات ضوئية ورسالة مخصصة.", "gift-box-reveal", "royal-gold", "3d", "golden", "3d-text", "3d", "fullscreen", ["gift-box", "cards", "final-surprise"], ["confetti", "stars", "3d-objects"], "gift-ribbon", "free", false],
  ["love-countdown-message", "رسالة بعد العد التنازلي", "Message After Countdown", "مؤقت تنازلي مشوّق يحجب الرسالة الرومانسية حتى تصل الثواني إلى الصفر ثم يكشفها باحتفال.", "countdown-unlock", "crimson-velvet", "countdown", "stars", "glow", "gradient", "cinematic", ["countdown", "final-surprise"], ["fireworks", "floating-hearts", "stars"], "countdown-gate", "free", false],
  ["love-memories-trip", "رحلة ذكريات", "Journey of Memories", "خريطة محطات متتالية تنتقل فيها بين أجمل الأماكن والأوقات التي جمعتكما معاً.", "story-journey", "warm-sunset", "parallax", "nature", "split-text", "svg-icons", "parallax", ["timeline", "image-comparison", "final-surprise"], ["parallax", "scroll-reveal", "smooth-transitions"], "curtain", "free", false],
  ["love-hidden-message", "رسالة مخفية", "Hidden Love Message", "طبقة ضبابية ذهبية يمسحها الزائر بإصبعه أو المؤشر لتظهر الصورة والرسالة المخبأة تحتها.", "scratch-photo", "royal-gold", "glass", "particles", "reveal", "magnetic", "before-after", ["interactive-messages", "final-surprise"], ["particles", "stars", "floating-hearts"], "minimal-fade", "free", false],
  ["love-secrets-box", "صندوق الأسرار", "Box of Love Secrets", "صندوق مقفل بتلميح ذكي يضم ثلاث أسرار قلبية لم تُقل من قبل.", "secret-vault", "crimson-velvet", "3d", "space", "typewriter", "neon", "grid", ["interactive-messages", "gift-box", "final-surprise"], ["3d-objects", "particles", "stars"], "vault-lock", "premium", false],
  ["love-stepped-surprise", "مفاجأة متدرجة", "Stepped Love Surprise", "خمس بطاقات مغلقة تُفتح بالترتيب التصاعدي وتزداد عمقاً حتى المفاجأة الكبرى.", "progressive-reveal", "crimson-velvet", "split-screen", "animated-gradient", "animated-headings", "interactive", "carousel", ["cards", "gift-box", "final-surprise"], ["floating-hearts", "confetti", "smooth-transitions"], "gift-ribbon", "free", false],
  ["love-full-story-page", "صفحة قصة من البداية للنهاية", "Complete Story From Start to Finish", "تجربة ملحمية شاملة تجمع المقدمة السينمائية، عداد الأيام، الخط الزمني، الألبوم، والخاتمة.", "story-journey", "crimson-velvet", "cinematic", "3d", "cinematic-text", "gradient", "cinematic", ["countdown", "storytelling", "timeline", "audio", "final-surprise"], ["3d-objects", "parallax", "floating-hearts", "scroll-reveal"], "portal", "premium", false],
];

const EVENTS_ITEMS: CompactTpl[] = [
  ["birthday-celebration", "عيد ميلاد", "Birthday Celebration", "حفلة رقمية مبهجة مع ألعاب نارية تفاعلية، صندوق أمنيات، وألبوم أجمل سنوات العمر.", "celebration-rsvp", "royal-gold", "3d", "golden", "gradient-text", "3d", "carousel", ["countdown", "gift-box", "testimonials", "final-surprise"], ["confetti", "fireworks", "3d-objects"], "gift-ribbon", "free", false],
  ["wedding-celebration", "زفاف", "Royal Wedding", "دعوة وصفحة زفاف ملكية بتفاصيل الموعد والمكان، عداد تنازلي، وبطاقة تهنئة وتأكيد حضور.", "celebration-rsvp", "royal-gold", "cinematic", "golden", "cinematic-text", "gradient", "cinematic", ["countdown", "timeline", "contact", "final-surprise"], ["stars", "particles", "scroll-reveal"], "curtain", "premium", true],
  ["engagement-celebration", "خطوبة", "Engagement Celebration", "صفحة خطوبة أنيقة بألوان العاج والذهب مع قصة التعارف وموعد الحفل ودفتر مباركات.", "celebration-rsvp", "ivory-champagne", "split-screen", "particles", "reveal", "glass", "memory-gallery", ["countdown", "storytelling", "contact", "final-surprise"], ["confetti", "stars", "smooth-transitions"], "wax-seal", "free", false],
  ["graduation-celebration", "تخرج", "Graduation Milestone", "منصة احتفاء بالتخرج تستعرض رحلة الكفاح، أبرز الإنجازات، وتطلق قصاصات النجاح الذهبية.", "celebration-rsvp", "royal-gold", "parallax", "stars", "3d-text", "animated", "masonry", ["statistics", "timeline", "testimonials", "final-surprise"], ["fireworks", "confetti", "scroll-reveal"], "portal", "free", false],
  ["success-celebration", "نجاح", "Success Celebration", "هدية تهنئة بالنجاح والترقية مع صندوق مفاجأة وشهادة فخر واعتزاز تفاعلية.", "gift-box-reveal", "emerald-oasis", "glass", "particles", "gradient-text", "gradient", "grid", ["statistics", "gift-box", "final-surprise"], ["confetti", "stars", "magnetic-elements"], "gift-ribbon", "free", false],
  ["newborn-welcome", "استقبال مولود", "Newborn Welcome", "بطاقة استقبال مولود رقيقة ومضيئة تحمل اسم المولود وتاريخ قدومه ورسائل الدعاء.", "celebration-rsvp", "ivory-champagne", "minimal", "stars", "reveal", "floating", "memory-gallery", ["cards", "testimonials", "contact", "final-surprise"], ["stars", "particles", "smooth-transitions"], "minimal-fade", "free", false],
  ["mothers-day", "عيد الأم", "Mother's Day Tribute", "رسالة امتنان دافئة لأغلى إنسانة داخل مظروف فاخر مع ألبوم ذكريات العائلة.", "envelope-letter", "ivory-champagne", "image-bg", "nature", "cinematic-text", "glass", "memory-gallery", ["interactive-messages", "cards", "audio", "final-surprise"], ["particles", "smooth-transitions", "scroll-reveal"], "wax-seal", "free", false],
  ["fathers-day", "عيد الأب", "Father's Day Honor", "صفحة تقدير ووفاء للأب بتصميم كلاسيكي رصين يوثق مواقف العطاء والفخر.", "envelope-letter", "royal-gold", "minimal", "gradient", "reveal", "minimal", "cinematic", ["timeline", "cards", "final-surprise"], ["stars", "scroll-reveal", "smooth-transitions"], "wax-seal", "free", false],
  ["ramadan-greeting", "رمضان", "Ramadan Kareem", "تهنئة رمضانية روحانية تحت قبة النجوم والفوانيس الذهبية مع عداد وأدعية مختارة.", "countdown-unlock", "emerald-oasis", "cinematic", "stars", "glow", "glass", "grid", ["countdown", "interactive-messages", "final-surprise"], ["stars", "particles", "smooth-transitions"], "curtain", "free", false],
  ["eid-al-fitr", "عيد الفطر", "Eid Al-Fitr Greeting", "عيدية تفاعلية مبهجة داخل صندوق هدايا فاخر مع ألعاب نارية وتهنئة باسم المستلم.", "gift-box-reveal", "emerald-oasis", "3d", "golden", "gradient-text", "3d", "carousel", ["gift-box", "cards", "final-surprise"], ["fireworks", "confetti", "stars"], "gift-ribbon", "free", false],
  ["eid-al-adha", "عيد الأضحى", "Eid Al-Adha Mubarak", "بطاقة معايدة فخمة لعيد الأضحى المبارك مع رسائل تهنئة تفاعلية ومشاركة فورية.", "celebration-rsvp", "royal-gold", "glass", "golden", "cinematic-text", "gradient", "grid", ["cards", "interactive-messages", "final-surprise"], ["confetti", "stars", "smooth-transitions"], "curtain", "free", false],
  ["new-year-eve", "رأس السنة", "New Year Countdown", "عد تنازلي احتفالي للعام الجديد تحت سماء متلألئة بالثلج والألعاب النارية وأمنيات العام.", "countdown-unlock", "midnight-cosmos", "countdown", "snow", "glow", "neon", "fullscreen", ["countdown", "cards", "final-surprise"], ["fireworks", "confetti", "stars"], "countdown-gate", "free", false],
  ["party-invitation", "دعوة حفلة", "Party Invitation", "دعوة سهرة عصرية بإضاءة نيون، تفاصيل الموقع والموعد، وتأكيد الحضور بنقرة واحدة.", "celebration-rsvp", "neon-arcade", "neon", "animated-gradient", "animated-headings", "neon", "carousel", ["countdown", "features", "contact", "final-surprise"], ["confetti", "particles", "magnetic-elements"], "portal", "free", false],
  ["friends-gathering-invite", "دعوة تجمع أصدقاء", "Friends Gathering Invite", "دعوة دافئة للمّة الأصدقاء مع برنامج الأمسية، العد التنازلي، وتأكيد الحضور.", "celebration-rsvp", "warm-sunset", "split-screen", "nature", "split-text", "interactive", "memory-gallery", ["countdown", "cards", "contact", "final-surprise"], ["confetti", "scroll-reveal"], "minimal-fade", "free", false],
  ["interactive-wedding-invite", "دعوة زفاف تفاعلية", "Interactive 3D Wedding Invite", "دعوة زفاف ثلاثية الأبعاد بختم ذهبي، جدول فقرات الحفل، معرض الخطوبة، وبطاقة حضور.", "celebration-rsvp", "royal-gold", "3d", "3d", "cinematic-text", "gradient", "3d-gallery", ["countdown", "timeline", "audio", "contact", "final-surprise"], ["3d-objects", "stars", "particles", "smooth-transitions"], "wax-seal", "premium", false],
  ["engagement-invite", "دعوة خطوبة", "Engagement Invitation", "بطاقة دعوة خطوبة مصقولة بأسلوب الزجاج الفاخر مع عداد اللحظات وتفاصيل القاعة.", "celebration-rsvp", "ivory-champagne", "glass", "glassmorphism", "gradient-text", "floating", "carousel", ["countdown", "contact", "final-surprise"], ["stars", "confetti", "smooth-transitions"], "wax-seal", "free", false],
  ["graduation-invite", "دعوة تخرج", "Graduation Ceremony Invite", "دعوة رسمية مبهجة لحضور حفل التخرج ومشاركة فرحة الإنجاز.", "celebration-rsvp", "midnight-cosmos", "image-bg", "stars", "3d-text", "svg-icons", "grid", ["countdown", "statistics", "contact", "final-surprise"], ["fireworks", "confetti", "scroll-reveal"], "curtain", "free", false],
  ["success-congrats", "تهنئة نجاح", "Success Congratulations", "مفاجأة تهنئة متدرجة تبرز خطوات التميز وتختتم بعرض ألعاب نارية احتفالي.", "progressive-reveal", "royal-gold", "parallax", "golden", "animated-headings", "animated", "masonry", ["statistics", "cards", "final-surprise"], ["fireworks", "confetti", "stars"], "gift-ribbon", "free", false],
  ["newborn-congrats", "تهنئة مولود", "Newborn Blessing Jar", "صندوق دعوات وأمنيات طيبة للمولود الجديد وأسرته بتصميم هادئ ومشرق.", "love-jar", "ivory-champagne", "minimal", "particles", "reveal", "glass", "grid", ["interactive-messages", "cards", "final-surprise"], ["stars", "smooth-transitions"], "minimal-fade", "free", false],
  ["personal-celebration-page", "صفحة احتفال شخصية", "Personal Milestone Page", "صفحة احتفالية شاملة لأي إنجاز شخصي مميز مع هدية تفاعلية وموسيقى مبهجة.", "gift-box-reveal", "neon-arcade", "video", "space", "glow", "magnetic", "fullscreen", ["gift-box", "audio", "statistics", "final-surprise"], ["fireworks", "confetti", "particles"], "portal", "free", false],
  ["vip-event-invite", "دعوة مناسبة خاصة", "VIP Private Event Invite", "دعوة حصرية فاخرة بالأسود والذهب للمناسبات الخاصة وحفلات العشاء الراقية.", "celebration-rsvp", "royal-gold", "cinematic", "golden", "cinematic-text", "minimal", "cinematic", ["countdown", "features", "contact", "final-surprise"], ["particles", "stars", "smooth-transitions"], "curtain", "premium", false],
];

const FRIENDS_ITEMS: CompactTpl[] = [
  ["best-friend-tribute", "صديقك المفضل", "Best Friend Tribute", "صفحة وفاء ومرح لصديق العمر توثق أطرف المواقف وأقوى الذكريات المشتركة.", "story-journey", "warm-sunset", "split-screen", "animated-gradient", "animated-headings", "gradient", "memory-gallery", ["timeline", "statistics", "cards", "final-surprise"], ["confetti", "scroll-reveal", "smooth-transitions"], "curtain", "free", false],
  ["who-knows-better-quiz", "اختبار مين يعرف الثاني أكثر", "Who Knows Me Better Quiz", "مسابقة تفاعلية حماسية بحساب النقاط الفوري لاكتشاف مدى معرفة صديقك بتفاصيلك!", "interactive-quiz", "warm-sunset", "neon", "particles", "3d-text", "3d", "carousel", ["statistics", "final-surprise"], ["confetti", "magnetic-elements", "smooth-transitions"], "portal", "free", true],
  ["friends-challenges", "تحديات الأصدقاء", "Friends Challenge Wheel", "عجلة تحديات دوّارة تختار حكماً أو تحدياً طريفاً لكل جولة بين الأصدقاء.", "lucky-wheel", "neon-arcade", "3d", "space", "glow", "interactive", "grid", ["cards", "final-surprise"], ["confetti", "3d-objects", "particles"], "portal", "free", false],
  ["friends-secrets-box", "صندوق أسرار", "Friends Secret Vault", "خزنة الشلة السرية التي لا تُفتح إلا بكلمة السر المتفق عليها بينكم.", "secret-vault", "midnight-cosmos", "glass", "stars", "typewriter", "neon", "memory-gallery", ["interactive-messages", "final-surprise"], ["stars", "particles", "magnetic-elements"], "vault-lock", "free", false],
  ["anonymous-notes-wall", "رسائل مجهولة", "Mystery Friend Notes", "حائط مظاريف لطيفة يفتحها الصديق واحدة تلو الأخرى ليقرأ رسائل إيجابية مفاجئة.", "love-jar", "warm-sunset", "glass", "glassmorphism", "reveal", "floating", "masonry", ["interactive-messages", "testimonials", "final-surprise"], ["particles", "smooth-transitions"], "wax-seal", "free", false],
  ["squad-memories", "ذكريات الشلة", "Squad Memories Archive", "ألبوم بولارويد سينمائي مع مقارنة «أيام زمان واليوم» لأجمل جمعات الأصدقاء.", "memory-showcase", "warm-sunset", "parallax", "nature", "split-text", "svg-icons", "memory-gallery", ["image-comparison", "timeline", "testimonials", "final-surprise"], ["parallax", "scroll-reveal", "confetti"], "curtain", "free", false],
  ["farewell-traveler", "وداع صديق مسافر", "Farewell Traveler Letter", "رسالة وداع مؤثرة وأمنيات بالتوفيق لصديق يبدأ رحلة جديدة في بلد آخر.", "envelope-letter", "midnight-cosmos", "cinematic", "stars", "cinematic-text", "glass", "cinematic", ["timeline", "testimonials", "audio", "final-surprise"], ["stars", "scroll-reveal", "smooth-transitions"], "wax-seal", "free", false],
  ["gratitude-friend", "شكر وامتنان", "Thank You Friend", "بطاقة عرفان راقية تقول «شكراً لوجودك» بأسلوب صادق وتصميم مريح للعين.", "envelope-letter", "emerald-oasis", "minimal", "nature", "reveal", "minimal", "grid", ["cards", "interactive-messages", "final-surprise"], ["particles", "smooth-transitions"], "wax-seal", "free", false],
  ["friend-surprise", "مفاجأة لصديق", "Surprise Gift for Friend", "صندوق مفاجأة تفاعلي ينفجر بالبهجة والرسائل المضحكة لإسعاد صديقك في أي يوم.", "gift-box-reveal", "warm-sunset", "3d", "particles", "gradient-text", "3d", "carousel", ["gift-box", "cards", "final-surprise"], ["confetti", "fireworks", "3d-objects"], "gift-ribbon", "free", false],
  ["friends-photo-album", "ألبوم صور الأصدقاء", "Friends Fullscreen Gallery", "معرض صور تفاعلي بوضع ملء الشاشة وتعليقات طريفة تحت كل صورة.", "memory-showcase", "warm-sunset", "image-bg", "gradient", "reveal", "floating", "fullscreen", ["image-comparison", "final-surprise"], ["scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["friends-qa-cards", "أسئلة بين الأصدقاء", "Friends Q&A Game", "جولة أسئلة صراحة وذكريات تفاعلية مع تقييم ختامي لدرجة الصداقة الأسطورية.", "interactive-quiz", "emerald-oasis", "glass", "animated-gradient", "animated-headings", "interactive", "grid", ["faq", "final-surprise"], ["confetti", "smooth-transitions"], "minimal-fade", "free", false],
  ["school-memories", "ذكريات المدرسة", "School & Uni Days", "رحلة حنين إلى مقاعد الدراسة، المواقف التي لا تُنسى، وصور التخرج.", "story-journey", "warm-sunset", "video", "golden", "typewriter", "animated", "before-after", ["timeline", "storytelling", "testimonials", "final-surprise"], ["parallax", "scroll-reveal", "stars"], "curtain", "free", false],
  ["squad-hub", "صفحة الشلة", "Official Squad Hub", "الصفحة الرسمية لمجموعة الأصدقاء مع الألقاب، الإحصائيات الطريفة، وألبوم الرحلات.", "memory-showcase", "neon-arcade", "3d", "3d", "3d-text", "magnetic", "3d-gallery", ["statistics", "features", "testimonials", "final-surprise"], ["3d-objects", "confetti", "magnetic-elements"], "portal", "premium", false],
  ["group-tribute-board", "رسالة جماعية", "Group Message Board", "لوحة رسائل جماعية تضم كلمات كل أفراد الشلة في صفحة واحدة لا تُنسى.", "love-jar", "royal-gold", "split-screen", "particles", "gradient-text", "gradient", "masonry", ["testimonials", "interactive-messages", "final-surprise"], ["confetti", "stars", "scroll-reveal"], "gift-ribbon", "free", false],
  ["celebrate-friend", "احتفال بصديق", "Celebrate a Friend", "مهرجان تهنئة وتقدير لصديق حقق إنجازاً رائعاً مع ألعاب نارية ودفتر مباركات.", "celebration-rsvp", "warm-sunset", "cinematic", "golden", "glow", "3d", "carousel", ["statistics", "gift-box", "final-surprise"], ["fireworks", "confetti", "stars"], "gift-ribbon", "free", false],
];

const GAMES_ITEMS: CompactTpl[] = [
  ["choose-your-box", "اختار صندوقك", "Choose Your Mystery Box", "ثلاثة صناديق ثلاثية الأبعاد متوهجة؛ واحد يحمل الجائزة الكبرى والبقية مفاجآت طريفة!", "mystery-boxes", "neon-arcade", "3d", "3d", "3d-text", "3d", "grid", ["gift-box", "final-surprise"], ["3d-objects", "confetti", "fireworks"], "portal", "free", true],
  ["discover-the-surprise", "اكتشف المفاجأة", "Scratch & Discover Surprise", "امسح الطبقة اللامعة التفاعلية بإصبعك أو الفأرة لاكتشاف المفاجأة المخبأة بالكامل.", "scratch-photo", "neon-arcade", "neon", "particles", "glow", "neon", "fullscreen", ["final-surprise"], ["confetti", "particles", "stars"], "portal", "free", false],
  ["random-questions-game", "أسئلة عشوائية", "Random Questions Challenge", "تحدي أسئلة متنوعة ومفاجئة مع مؤشر تقدم ونتيجة فورية مخصصة.", "interactive-quiz", "neon-arcade", "glass", "animated-gradient", "animated-headings", "interactive", "grid", ["statistics", "final-surprise"], ["confetti", "magnetic-elements"], "minimal-fade", "free", false],
  ["true-or-false-game", "صح أم غلط", "True or False Arena", "مواجهة سريعة بنظام «صح أم غلط» مع تأثيرات فورية لكل إجابة وكشف الحقيقة.", "true-false-game", "midnight-cosmos", "neon", "space", "3d-text", "3d", "grid", ["statistics", "final-surprise"], ["confetti", "stars", "smooth-transitions"], "portal", "free", false],
  ["personality-test-game", "اختبار الشخصية", "Personality Mirror Game", "اختبار اختيارات ذكي وممتع يحلل اختيارات الزائر ويمنحه لقباً مميزاً في النهاية.", "interactive-quiz", "midnight-cosmos", "split-screen", "stars", "gradient-text", "glass", "carousel", ["cards", "final-surprise"], ["stars", "particles", "smooth-transitions"], "curtain", "free", false],
  ["know-me-test", "اختبار معرفة شخص", "How Well Do You Know Me", "اختبر أصدقاءك أو شريكك بأسئلة عن ذوقك وذكرياتك وشاهد درجتهم النهائية.", "interactive-quiz", "warm-sunset", "parallax", "particles", "split-text", "gradient", "memory-gallery", ["statistics", "final-surprise"], ["confetti", "scroll-reveal"], "minimal-fade", "free", false],
  ["crack-the-cipher", "فك الشفرة", "Crack the Secret Cipher", "غرفة شفرات مشوّقة تعرض تلميحات متدرجة لفك القفل الرقمي والوصول إلى الكنز.", "secret-vault", "midnight-cosmos", "neon", "space", "typewriter", "neon", "cinematic", ["faq", "final-surprise"], ["particles", "stars", "magnetic-elements"], "vault-lock", "premium", false],
  ["wheel-of-fortune", "عجلة الحظ", "Wheel of Fortune", "عجلة حظ فيزيائية ملونة تدور بانسيابية وتتوقف على هديتك أو رسالتك المكتوبة.", "lucky-wheel", "royal-gold", "3d", "golden", "3d-text", "3d", "grid", ["gift-box", "final-surprise"], ["fireworks", "confetti", "3d-objects"], "portal", "free", false],
  ["treasure-hunt-game", "البحث عن الكنز", "Interactive Treasure Hunt", "مغامرة من أربع محطات متتالية؛ حل كل إشارة يفتح الخريطة التالية حتى صندوق الكنز!", "treasure-stages", "royal-gold", "cinematic", "stars", "cinematic-text", "animated", "parallax", ["timeline", "gift-box", "final-surprise"], ["stars", "fireworks", "confetti"], "curtain", "premium", false],
  ["open-right-envelope", "افتح الرسالة الصحيحة", "Pick the Right Envelope", "خمسة مظاريف غامضة أمامك؛ ابحث عن المظروف الذهبي الذي يحمل الرسالة الحقيقية.", "mystery-boxes", "crimson-velvet", "glass", "particles", "reveal", "magnetic", "grid", ["interactive-messages", "final-surprise"], ["confetti", "stars", "smooth-transitions"], "wax-seal", "free", false],
  ["daily-challenges-deck", "تحديات يومية", "Daily Challenge Spinner", "أدر العجلة واحصل على تحدي اليوم المليء بالحماس والطاقة الإيجابية.", "lucky-wheel", "emerald-oasis", "minimal", "animated-gradient", "animated-headings", "interactive", "carousel", ["cards", "final-surprise"], ["confetti", "particles"], "minimal-fade", "free", false],
  ["brain-teasers-puzzle", "ألعاب ذكاء", "Mind & Logic Puzzles", "مجموعة ألغاز ذهنية ممتعة بتدرج ذكي تكافئ الفائز برسالة فخر ومفاجأة.", "interactive-quiz", "midnight-cosmos", "3d", "space", "glow", "glass", "grid", ["statistics", "final-surprise"], ["3d-objects", "stars", "confetti"], "portal", "free", false],
  ["choose-the-door", "اختيار الأبواب", "Three Mystery Doors", "ثلاثة أبواب معمارية مضيئة؛ اختر باباً وافتحه لتكتشف العالم والرسالة خلفه!", "mystery-doors", "neon-arcade", "3d", "3d", "cinematic-text", "neon", "3d-gallery", ["final-surprise"], ["3d-objects", "particles", "confetti"], "portal", "premium", false],
  ["reveal-hidden-photo", "اكتشاف الصور", "Hidden Image Uncover", "اكشف الصورة المموهة خطوة بخطوة عبر المسح التفاعلي واقرأ قصتها الكاملة.", "scratch-photo", "warm-sunset", "image-bg", "glassmorphism", "reveal", "floating", "before-after", ["image-comparison", "final-surprise"], ["particles", "scroll-reveal"], "minimal-fade", "free", false],
  ["order-the-memories", "ترتيب الذكريات", "Order the Memories Game", "رتّب الأحداث والمواقف بالتسلسل الزمني الصحيح لفتح قفل الرسالة الختامية!", "memory-order-game", "warm-sunset", "split-screen", "golden", "split-text", "3d", "memory-gallery", ["timeline", "final-surprise"], ["confetti", "stars", "smooth-transitions"], "curtain", "free", false],
  ["would-you-rather-game", "لعبة الاختيارات", "Choices & Scenarios Game", "مواقف واختيارات مشوّقة «لو خيّروك» تكشف في نهايتها رسالة مصممة لك.", "interactive-quiz", "neon-arcade", "neon", "animated-gradient", "gradient-text", "animated", "carousel", ["cards", "final-surprise"], ["confetti", "magnetic-elements"], "portal", "free", false],
  ["riddles-chamber", "الألغاز", "Chamber of Riddles", "حجرة الألغاز الغامضة: اقرأ اللغز الشعري وأدخل الكلمة المفتاحية لكشف السر.", "secret-vault", "emerald-oasis", "cinematic", "space", "typewriter", "glass", "cinematic", ["interactive-messages", "final-surprise"], ["stars", "particles", "smooth-transitions"], "vault-lock", "free", false],
  ["stages-progression-game", "ترتيب المراحل", "Level-Up Stages Quest", "أكمل المراحل الأربع المتتالية وارفع شريط الإنجاز إلى 100% لفتح الجائزة النهائية.", "treasure-stages", "neon-arcade", "video", "3d", "3d-text", "gradient", "grid", ["statistics", "gift-box", "final-surprise"], ["3d-objects", "fireworks", "confetti"], "portal", "free", false],
  ["speed-trivia-blitz", "الأسئلة السريعة", "Speed Trivia Blitz", "جولة أسئلة خاطفة عالية الحماس مع نتيجة فورية واحتفال بالفوز.", "true-false-game", "neon-arcade", "countdown", "particles", "glow", "interactive", "grid", ["statistics", "final-surprise"], ["confetti", "fireworks"], "countdown-gate", "free", false],
];

const PORTFOLIO_ITEMS: CompactTpl[] = [
  ["personal-portfolio", "Portfolio شخصي", "Personal Creative Portfolio", "معرض أعمال شخصي فخم يستعرض المشاريع المختارة، المهارات، الإحصائيات، ووسائل التواصل.", "portfolio-studio", "midnight-cosmos", "split-screen", "glassmorphism", "gradient-text", "magnetic", "masonry", ["statistics", "features", "testimonials", "social-links", "contact"], ["scroll-reveal", "magnetic-elements", "smooth-transitions"], "minimal-fade", "free", true],
  ["personal-bio-page", "صفحة تعريف شخصية", "Personal Identity Page", "واجهة تعريفية أنيقة تقدم قصتك المهنية واهتماماتك بأسلوب تحريري معاصر.", "portfolio-studio", "editorial-stone", "minimal", "gradient", "reveal", "minimal", "grid", ["storytelling", "features", "social-links", "contact"], ["scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["social-links-hub", "روابط اجتماعية", "Social Links Bio Hub", "بطاقة بلورية متجاوبة تجمع كافة حساباتك ومنصاتك الرقمية بتصميم فائق الأناقة.", "links-showcase", "midnight-cosmos", "glass", "animated-gradient", "glow", "glass", "carousel", ["social-links", "cards", "contact"], ["particles", "magnetic-elements", "smooth-transitions"], "minimal-fade", "free", false],
  ["interactive-cv-resume", "سيرة ذاتية", "Architectural CV & Resume", "سيرة ذاتية رقمية منظمة تشمل الخط الزمني للخبرات، المؤشرات المهارية، وأبرز الإنجازات.", "cv-architect", "editorial-stone", "minimal", "gradient", "cinematic-text", "svg-icons", "grid", ["statistics", "timeline", "features", "contact"], ["scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["designer-showcase", "معرض أعمال مصمم", "UI/UX & Brand Designer Folio", "استوديو بصري للمصممين يتضمن مقارنة قبل/بعد للتصاميم ومعرض ثلاثي الأبعاد.", "portfolio-studio", "royal-gold", "3d", "3d", "cinematic-text", "magnetic", "before-after", ["features", "image-comparison", "testimonials", "contact"], ["3d-objects", "parallax", "magnetic-elements"], "curtain", "premium", false],
  ["photography-exhibition", "معرض تصوير", "Photography Exhibition", "صالة عرض فوتوغرافية داكنة بكادرات سينمائية وعارض ملء الشاشة يبرز أدق التفاصيل.", "memory-showcase", "royal-gold", "image-bg", "gradient", "cinematic-text", "minimal", "fullscreen", ["image-comparison", "storytelling", "social-links", "contact"], ["parallax", "scroll-reveal", "smooth-transitions"], "curtain", "free", false],
  ["artist-monograph", "صفحة فنان", "Fine Artist Monograph", "صفحة فنية شاعرية تستعرض اللوحات والأعمال الإبداعية مع بيان الفنان والمقتنيات.", "portfolio-studio", "ivory-champagne", "parallax", "nature", "reveal", "floating", "masonry", ["storytelling", "testimonials", "social-links", "contact"], ["parallax", "scroll-reveal", "smooth-transitions"], "curtain", "free", false],
  ["web-developer-folio", "صفحة مطور ويب", "Fullstack Developer Portfolio", "بورتفوليو تقني عصري يستعرض التقنيات، المشاريع الحية، الأرقام، والخبرة الهندسية.", "cv-architect", "midnight-cosmos", "3d", "space", "typewriter", "neon", "grid", ["statistics", "features", "timeline", "social-links", "contact"], ["3d-objects", "particles", "magnetic-elements"], "minimal-fade", "premium", false],
  ["startup-launch-page", "صفحة مشروع ناشئ", "Startup Product Launch", "صفحة إطلاق احترافية لمشروعك الناشئ مع المزايا، الأرقام، الأسئلة الشائعة، والتواصل.", "agency-flagship", "midnight-cosmos", "cinematic", "3d", "gradient-text", "gradient", "carousel", ["statistics", "features", "testimonials", "faq", "contact"], ["3d-objects", "scroll-reveal", "smooth-transitions"], "minimal-fade", "premium", false],
  ["freelance-services-page", "صفحة خدمات شخصية", "Freelance Services Studio", "اعرض باقات خدماتك المستقلة، آراء العملاء، والأسئلة الشائعة لتحويل الزوار إلى عملاء.", "agency-flagship", "emerald-oasis", "split-screen", "glassmorphism", "animated-headings", "animated", "grid", ["features", "statistics", "testimonials", "faq", "contact"], ["scroll-reveal", "magnetic-elements"], "minimal-fade", "free", false],
  ["motion-reel-portfolio", "معرض أعمال متحرك", "Motion & Visual Reel Folio", "واجهة عرض حركية لصنّاع المحتوى والموشن جرافيك بانتقالات سينمائية غامرة.", "portfolio-studio", "neon-arcade", "video", "video", "3d-text", "animated", "3d-gallery", ["video", "features", "social-links", "contact"], ["3d-objects", "parallax", "smooth-transitions"], "portal", "premium", false],
  ["company-profile-page", "صفحة تعريف شركة", "Corporate Profile Page", "ملف تعريفي متكامل للشركات يستعرض الرؤية، الأرقام، الخدمات، وسجل الإنجازات.", "agency-flagship", "editorial-stone", "split-screen", "gradient", "reveal", "gradient", "cinematic", ["statistics", "features", "timeline", "faq", "contact"], ["scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["executive-profile", "صفحة شخصية احترافية", "Executive Digital Card", "بطاقة حضور تنفيذية بالأسود والذهب لرواد الأعمال والمستشارين.", "cv-architect", "royal-gold", "glass", "golden", "cinematic-text", "minimal", "grid", ["statistics", "timeline", "testimonials", "social-links", "contact"], ["particles", "scroll-reveal", "smooth-transitions"], "minimal-fade", "premium", false],
  ["multi-links-card", "صفحة روابط متعددة", "Multi-Link Creator Card", "صفحة روابط سريعة وخفيفة لصنّاع المحتوى والمتاجر مع أزرار تفاعلية جذابة.", "links-showcase", "emerald-oasis", "minimal", "particles", "gradient-text", "svg-icons", "grid", ["social-links", "features", "contact"], ["particles", "smooth-transitions"], "minimal-fade", "free", false],
  ["creative-agency-studio", "صفحة وكالة إبداعية", "Creative Agency Flagship", "واجهة وكالة إبداعية متكاملة بعمق بصري ثلاثي الأبعاد، دراسات حالة، وشهادات عملاء.", "agency-flagship", "royal-gold", "3d", "3d", "cinematic-text", "magnetic", "parallax", ["statistics", "features", "image-comparison", "testimonials", "faq", "contact"], ["3d-objects", "parallax", "magnetic-elements", "scroll-reveal"], "curtain", "premium", false],
];

const MESSAGES_ITEMS: CompactTpl[] = [
  ["msg-after-countdown", "رسالة بعد العد التنازلي", "Countdown Secret Message", "عداد رقمي متوهج يحبس الأنفاس قبل أن يفتح القفل تلقائياً ويكشف رسالتك الكاملة.", "countdown-unlock", "midnight-cosmos", "countdown", "stars", "glow", "gradient", "cinematic", ["countdown", "audio", "final-surprise"], ["stars", "fireworks", "confetti"], "countdown-gate", "free", true],
  ["msg-on-click-object", "رسالة عند الضغط على عنصر", "Tap-to-Reveal Crystal", "بلورة مضيئة تفاعلية تستجيب للنقر المتتابع لتكشف شذرات الرسالة حتى اكتمالها.", "mystery-boxes", "midnight-cosmos", "3d", "space", "glow", "interactive", "grid", ["interactive-messages", "final-surprise"], ["3d-objects", "particles", "stars"], "portal", "free", false],
  ["msg-inside-envelope", "رسالة داخل ظرف", "Sealed Parchment Envelope", "مظروف ورقي فاخر ينفتح بحركة ثلاثية الأبعاد ناعمة ليظهر الخطاب الموقع باسمك.", "envelope-letter", "royal-gold", "cinematic", "golden", "typewriter", "glass", "memory-gallery", ["interactive-messages", "final-surprise"], ["particles", "stars", "smooth-transitions"], "wax-seal", "free", false],
  ["msg-behind-photo", "رسالة خلف صورة", "Message Behind Photograph", "صورة تذكارية تخفي خلفها رسالة سرية تظهر عند مسح أو قلب الكادر المصوّر.", "scratch-photo", "ivory-champagne", "image-bg", "particles", "reveal", "floating", "memory-gallery", ["image-comparison", "final-surprise"], ["particles", "scroll-reveal", "smooth-transitions"], "minimal-fade", "free", false],
  ["msg-end-of-scroll", "رسالة عند نهاية الصفحة", "End-of-Journey Message", "رحلة تمرير شاعرية تحت سماء مرصعة بالنجوم تكشف سرها الحقيقي عند بلوغ المحطة الأخيرة.", "progressive-reveal", "midnight-cosmos", "parallax", "stars", "split-text", "glass", "parallax", ["storytelling", "final-surprise"], ["parallax", "stars", "scroll-reveal"], "curtain", "free", false],
  ["msg-interactive-giftbox", "صندوق هدايا تفاعلي", "Luxury Surprise Gift Box", "فك شريط الحرير الذهبي وارفع غطاء الصندوق لتنطلق المفاجأة والرسالة معاً.", "gift-box-reveal", "royal-gold", "3d", "golden", "3d-text", "3d", "carousel", ["gift-box", "cards", "final-surprise"], ["confetti", "fireworks", "3d-objects"], "gift-ribbon", "free", false],
  ["msg-voice-note", "رسالة صوتية", "Ambient Voice & Melody Card", "بطاقة سمعية بصرية أنيقة بموجات صوتية تفاعلية تعمل حصراً عند ضغط الزائر.", "voice-stage", "emerald-oasis", "glass", "nature", "reveal", "floating", "cinematic", ["audio", "interactive-messages", "final-surprise"], ["particles", "smooth-transitions"], "curtain", "free", false],
  ["msg-video-surprise", "فيديو مفاجأة", "Cinema Premiere Surprise", "قاعة عرض خاصة تفتح ستائرها لتشغيل شرائح المفاجأة المصوّرة والرسالة الختامية.", "cinema-premiere", "royal-gold", "video", "video", "cinematic-text", "animated", "cinematic", ["video", "audio", "final-surprise"], ["stars", "confetti", "smooth-transitions"], "curtain", "premium", false],
  ["msg-motion-album", "ألبوم صور متحرك", "Floating Motion Photo Story", "شريط ذكريات مصوّر يتحرك بانسيابية مع تعليق وجداني مرافق لكل كادر.", "memory-showcase", "warm-sunset", "parallax", "animated-gradient", "gradient-text", "svg-icons", "carousel", ["storytelling", "image-comparison", "final-surprise"], ["parallax", "scroll-reveal", "smooth-transitions"], "curtain", "free", false],
  ["msg-discovery-quest", "رحلة اكتشاف رسالة", "Message Discovery Quest", "اتبع النجوم المضيئة عبر أربع محطات متتالية لتجميع أجزاء الرسالة الكاملة.", "treasure-stages", "midnight-cosmos", "3d", "space", "cinematic-text", "magnetic", "grid", ["timeline", "final-surprise"], ["3d-objects", "stars", "particles"], "portal", "premium", false],
  ["msg-hidden-cipher", "رسالة مخفية", "Encrypted Secret Note", "رسالة محمية بكلمة مفتاحية وتلميح شخصي لا يعرفه سوى المرسل والمستلم.", "secret-vault", "midnight-cosmos", "neon", "stars", "typewriter", "neon", "grid", ["interactive-messages", "final-surprise"], ["stars", "particles", "magnetic-elements"], "vault-lock", "free", false],
  ["msg-interactive-cards", "رسالة تفاعلية", "Flip-Cards Message Deck", "مجموعة بطاقات مقلوبة تكشف كل واحدة منها سبباً أو أمنية خاصة عند لمسها.", "love-jar", "emerald-oasis", "split-screen", "glassmorphism", "animated-headings", "interactive", "grid", ["interactive-messages", "cards", "final-surprise"], ["particles", "confetti", "smooth-transitions"], "minimal-fade", "free", false],
  ["msg-layered-surprise", "مفاجأة متدرجة", "Multi-Layer Unfolding Surprise", "طبقات متتالية من المفاجآت: كلمة، ثم صورة، ثم ذكرى، ثم المشهد الاحتفالي الكبير.", "progressive-reveal", "warm-sunset", "glass", "golden", "reveal", "gradient", "masonry", ["storytelling", "gift-box", "final-surprise"], ["confetti", "fireworks", "scroll-reveal"], "gift-ribbon", "free", false],
  ["msg-vault-of-secrets", "صندوق الأسرار", "Golden Vault of Secrets", "خزنة ذهبية فخمة تحفظ رسالتك الخاصة وتفتحها بمؤثر ضوئي ساحر.", "secret-vault", "royal-gold", "3d", "golden", "3d-text", "3d", "fullscreen", ["gift-box", "final-surprise"], ["3d-objects", "stars", "particles"], "vault-lock", "premium", false],
  ["msg-grand-finale", "رسالة نهائية", "Grand Finale Message", "مشهد ختامي سينمائي مؤثر تحت السماء المضيئة يترك أثراً لا يُنسى في قلب القارئ.", "cinema-premiere", "midnight-cosmos", "cinematic", "3d", "cinematic-text", "gradient", "cinematic", ["storytelling", "audio", "final-surprise"], ["3d-objects", "fireworks", "stars", "smooth-transitions"], "portal", "premium", false],
];

const CATEGORY_PREVIEW: Record<string, string> = {
  love: "/images/cat-love.jpg",
  events: "/images/cat-events.jpg",
  friends: "/images/cat-friends.jpg",
  games: "/images/cat-games.jpg",
  portfolio: "/images/cat-portfolio.jpg",
  messages: "/images/cat-messages.jpg",
};

const CATEGORY_MUSIC: Record<string, string> = {
  love: "romantic-piano",
  events: "golden-celebration",
  friends: "joyful-chimes",
  games: "joyful-chimes",
  portfolio: "creative-pulse",
  messages: "starry-ambient",
};

function getExperienceExtraFields(exp: ExperienceType): {
  fields: TemplateFieldSchema[];
  sampleCustomFields: Record<string, unknown>;
} {
  switch (exp) {
    case "secret-vault":
      return {
        fields: [
          {
            key: "secretCode",
            labelAr: "الرمز السري لفتح الخزنة",
            promptAr: "🔐 أرسل الرمز السري لفتح الرسالة (مثال: 2026 أو كلمة قصيرة):",
            type: "code",
            required: true,
            placeholderAr: "2026",
          },
          {
            key: "secretHint",
            labelAr: "تلميح الرمز السري",
            promptAr: "💡 أرسل تلميحاً لطيفاً يساعد المستلم على معرفة الرمز:",
            type: "text",
            required: false,
            placeholderAr: "السنة التي بدأت فيها أجمل أيامنا",
          },
        ],
        sampleCustomFields: {
          secretCode: "2026",
          secretHint: "عام اللحظات الأجمل (2026)",
        },
      };
    case "interactive-quiz":
      return {
        fields: [
          {
            key: "quizQuestion",
            labelAr: "سؤال مخصص إضافي",
            promptAr: "❓ أرسل سؤالاً مميزاً تود طرحه على المستلم (أو اختر التخطي لاستخدام الأسئلة الجاهزة):",
            type: "text",
            required: false,
            placeholderAr: "ما هو أكثر مكان نحب زيارته معاً؟",
          },
        ],
        sampleCustomFields: {
          quizItems: [
            {
              q: "ما هو أكثر ما يميز ذكرياتنا المشتركة؟",
              options: ["الضحك من القلب", "المغامرات المفاجئة", "الوقوف معاً دائماً", "كل ما سبق وأكثر"],
              correct: 3,
            },
            {
              q: "ما هو الوقت المفضل لحديثنا الطويل؟",
              options: ["قهوة الصباح", "ساعة الغروب", "هدوء المساء", "في كل وقت"],
              correct: 2,
            },
            {
              q: "لو أعدنا أجمل يوم جمعنا، ماذا سنفعل؟",
              options: ["نعيشه بنفس التفاصيل", "نلتقط صوراً أكثر", "نسافر لمكان جديد", "نحتفل من جديد"],
              correct: 0,
            },
          ],
        },
      };
    case "true-false-game":
      return {
        fields: [
          {
            key: "customStatement",
            labelAr: "عبارة صح أم غلط مخصصة",
            promptAr: "⚡ أرسل عبارة لتحدي «صح أم غلط» (مثال: أول لقاء بيننا كان يوم خميس):",
            type: "text",
            required: false,
            placeholderAr: "أفضل مشروب لدي هو القوة المختصة",
          },
        ],
        sampleCustomFields: {
          statements: [
            { text: "أجمل اللحظات هي التي تأتي دون تخطيط مسبق.", answer: true },
            { text: "يمكن نسيان المواقف المضحكة التي جمعتنا بسهولة.", answer: false },
            { text: "هذا الموقع صُمم خصيصاً لرسم ابتسامة حقيقية اليوم.", answer: true },
            { text: "المفاجأة الأجمل لم تظهر بعد حتى تنهي هذه الجولة!", answer: true },
          ],
        },
      };
    case "lucky-wheel":
      return {
        fields: [
          {
            key: "wheelItems",
            labelAr: "خيارات عجلة الحظ (مفصولة بفاصلة)",
            promptAr: "🎡 أرسل خيارات عجلة الحظ مفصولة بفاصلة (مثال: دعوة عشاء، هدية مفاجئة، رحلة قريبة، رسالة خاصة):",
            type: "list",
            required: false,
            placeholderAr: "دعوة عشاء فاخرة، هدية مفاجئة، قهوة على حسابي، أمنية محققة، يوم مغامرة، رسالة من القلب",
          },
        ],
        sampleCustomFields: {
          wheelSlices: [
            "دعوة عشاء فاخرة",
            "هدية مفاجئة",
            "قهوة وحلوى معاً",
            "أمنية من اختيارك",
            "نزهة عند الغروب",
            "الجائزة الكبرى",
          ],
        },
      };
    case "celebration-rsvp":
      return {
        fields: [
          {
            key: "eventLocation",
            labelAr: "مكان المناسبة أو القاعة",
            promptAr: "📍 أرسل مكان المناسبة أو عنوان الاحتفال (اختياري):",
            type: "text",
            required: false,
            placeholderAr: "قاعة القصر الذهبي — الساعة الثامنة مساءً",
          },
        ],
        sampleCustomFields: {
          eventLocation: "القاعة الملكية — تمام الساعة الثامنة مساءً",
          eventTime: "08:00 مساءً",
        },
      };
    case "portfolio-studio":
    case "cv-architect":
    case "agency-flagship":
    case "links-showcase":
      return {
        fields: [
          {
            key: "roleTitle",
            labelAr: "المسمى المهني أو التخصص",
            promptAr: "💼 أرسل المسمى المهني أو شعار المشروع (مثال: مصمم تجارب رقمية وهويات بصرية):",
            type: "text",
            required: false,
            placeholderAr: "مصمم تجارب رقمية وهويات بصرية",
          },
          {
            key: "contactHandle",
            labelAr: "رابط أو بريد التواصل",
            promptAr: "🔗 أرسل البريد الإلكتروني أو اسم المستخدم للتواصل:",
            type: "text",
            required: false,
            placeholderAr: "hello@studio.example",
          },
        ],
        sampleCustomFields: {
          roleTitle: "تصميم تجارب رقمية وهويات بصرية متكاملة",
          contactHandle: "studio@lovecraft.example",
          stats: [
            { label: "مشروعاً منجزاً", value: "+48" },
            { label: "سنوات خبرة", value: "6" },
            { label: "عميلاً سعيداً", value: "+35" },
          ],
          highlights: [
            { title: "تصميم الواجهات والتجربة", desc: "بناء منتجات رقمية واضحة، سريعة، ومتقنة التفاصيل على كل الشاشات." },
            { title: "الهوية البصرية الكاملة", desc: "صياغة حضور بصري متماسك يعبّر عن جوهر العلامة ويبقى في الذاكرة." },
            { title: "التطوير التفاعلي الحديث", desc: "تحويل الأفكار إلى مواقع حية بأداء فائق وحركات مدروسة." },
          ],
          links: [
            { label: "معرض الأعمال الكامل — Behance", tag: "Portfolio" },
            { label: "المشاريع البرمجية — GitHub", tag: "Code" },
            { label: "الحساب المهني — LinkedIn", tag: "Network" },
            { label: "اليوميات البصرية — Instagram", tag: "Visuals" },
          ],
        },
      };
    default:
      return {
        fields: [
          {
            key: "memoryNote",
            labelAr: "تفصيلة أو ذكرى إضافية",
            promptAr: "✨ أرسل موقفاً أو عبارة قصيرة إضافية لتزيين البطاقات التفاعلية (اختياري):",
            type: "text",
            required: false,
            placeholderAr: "كل لحظة جميلة تصبح أجمل بوجودك",
          },
        ],
        sampleCustomFields: {
          notes: [
            "هناك أشخاص يجعلون الأيام العادية تبدو كأنها أعياد حقيقية.",
            "بعض التفاصيل الصغيرة تبقى محفورة في القلب مهما مرّت السنوات.",
            "أجمل ما في الذكريات أنها تمنحنا ابتسامة صادقة كلما عدنا إليها.",
            "شكراً لكل موقف صادق ولكل كلمة طيبة صنعت فرقاً جميلاً.",
          ],
          milestones: [
            { title: "البداية التي لا تُنسى", desc: "أول موقف جمعنا وكان بداية حكاية استثنائية بكل تفاصيلها." },
            { title: "أجمل المواقف المشتركة", desc: "أيام مليئة بالضحك الصادق والدعم الحقيقي في كل خطوة." },
            { title: "لحظة اليوم وما بعدها", desc: "نوثق هذه اللحظة لنعود إليها دائماً بامتنان وسعادة متجددة." },
          ],
        },
      };
  }
}

export function buildAllTemplateSeeds(): TemplateSeed[] {
  const groups: Array<{ categorySlug: string; items: CompactTpl[] }> = [
    { categorySlug: "love", items: LOVE_ITEMS },
    { categorySlug: "events", items: EVENTS_ITEMS },
    { categorySlug: "friends", items: FRIENDS_ITEMS },
    { categorySlug: "games", items: GAMES_ITEMS },
    { categorySlug: "portfolio", items: PORTFOLIO_ITEMS },
    { categorySlug: "messages", items: MESSAGES_ITEMS },
  ];

  const all: TemplateSeed[] = [];
  for (const group of groups) {
    group.items.forEach((item, idx) => {
      const [
        slug,
        nameAr,
        nameEn,
        descriptionAr,
        experienceType,
        paletteId,
        hero,
        background,
        typography,
        button,
        gallery,
        sections,
        effects,
        introStyle,
        tier = "free",
        featured = false,
      ] = item;
      const extra = getExperienceExtraFields(experienceType);
      all.push({
        categorySlug: group.categorySlug,
        slug,
        nameAr,
        nameEn,
        descriptionAr,
        previewImage: CATEGORY_PREVIEW[group.categorySlug] ?? "/images/cat-love.jpg",
        githubPath: `templates/${group.categorySlug}/${slug}/template.json`,
        tier,
        creditCost: tier === "premium" ? 2 : 1,
        isFeatured: featured,
        sortOrder: idx + 1,
        experienceType,
        paletteId,
        hero,
        background,
        typography,
        button,
        gallery,
        sections,
        effects,
        introStyle,
        musicTrack: CATEGORY_MUSIC[group.categorySlug] ?? "romantic-piano",
        extraFields: extra.fields,
        sampleCustomFields: extra.sampleCustomFields,
      });
    });
  }
  return all;
}

export function buildTemplateDefaultConfig(seed: TemplateSeed): Record<string, unknown> {
  const palette = getPaletteById(seed.paletteId);
  return {
    paletteId: seed.paletteId,
    themeColors: {
      primary: palette.primary,
      secondary: palette.secondary,
      accent: palette.accent,
      background: palette.background,
      surface: palette.surface,
      text: palette.text,
      mode: palette.mode,
    },
    componentsConfig: {
      hero: seed.hero,
      background: seed.background,
      typography: seed.typography,
      button: seed.button,
      gallery: seed.gallery,
      sections: seed.sections,
      effects: seed.effects,
      introStyle: seed.introStyle,
      liteModeDefault: false,
    },
    musicTrack: seed.musicTrack,
    sampleCustomFields: seed.sampleCustomFields ?? {},
  };
}

export function buildTemplateFieldsSchema(seed: TemplateSeed): Array<Record<string, unknown>> {
  const base: TemplateFieldSchema[] = [
    {
      key: "recipientName",
      labelAr: seed.categorySlug === "portfolio" ? "الاسم أو العلامة" : "اسم المُهدى إليه",
      promptAr:
        seed.categorySlug === "portfolio"
          ? "👤 أرسل اسمك الكامل أو اسم علامتك الإبداعية:"
          : "👤 أرسل اسم الشخص المُهدى إليه الموقع:",
      type: "text",
      required: true,
      placeholderAr: seed.categorySlug === "portfolio" ? "كريم المنصور" : "نور",
    },
    {
      key: "senderName",
      labelAr: seed.categorySlug === "portfolio" ? "التوقيع أو المدينة" : "اسم المُرسِل",
      promptAr:
        seed.categorySlug === "portfolio"
          ? "✍️ أرسل المدينة أو التوقيع التعريفي المختصر:"
          : "✍️ أرسل اسمك كما سيظهر في توقيع الموقع:",
      type: "text",
      required: true,
      placeholderAr: seed.categorySlug === "portfolio" ? "القاهرة — استوديو رقمي" : "أحمد",
    },
    {
      key: "headline",
      labelAr: "العنوان الرئيسي للموقع",
      promptAr: "🏷️ أرسل العنوان الرئيسي الذي يتصدر واجهة الموقع:",
      type: "text",
      required: true,
      placeholderAr: seed.nameAr,
    },
    {
      key: "mainMessage",
      labelAr: seed.categorySlug === "portfolio" ? "النبذة التعريفية" : "الرسالة الأساسية",
      promptAr:
        seed.categorySlug === "portfolio"
          ? "📝 أرسل النبذة التعريفية عنك وعن أبرز أعمالك وخدماتك:"
          : "💌 أرسل رسالتك الكاملة التي تود عرضها داخل الموقع:",
      type: "textarea",
      required: true,
      placeholderAr: "اكتب كلماتك الصادقة هنا...",
    },
    {
      key: "eventDate",
      labelAr: "التاريخ المميز",
      promptAr: "📅 أرسل التاريخ المرتبط بالمناسبة بصيغة YYYY-MM-DD (أو اختر التخطي):",
      type: "date",
      required: false,
      placeholderAr: "2026-05-20",
    },
    {
      key: "finalSurpriseText",
      labelAr: "رسالة المشهد الختامي",
      promptAr: "🎁 أرسل عبارة المفاجأة الختامية التي تظهر في نهاية التجربة:",
      type: "textarea",
      required: false,
      placeholderAr: "دمتَ أجمل ما في الأيام!",
    },
  ];
  const linksField:TemplateFieldSchema = {key:'profileLinks',labelAr:'روابط الحسابات',promptAr:'أدخل الروابط، رابطًا في كل سطر بهذا الشكل: اسم الحساب | https://example.com/profile',type:'textarea',required:false,placeholderAr:'المعرض | https://www.behance.net/your-profile'};
  return [...base, ...(seed.extraFields ?? []), ...(seed.experienceType==='links-showcase'?[linksField]:[])] as unknown as Array<Record<string, unknown>>;
}

export const DEFAULT_COMPATIBILITY = {
  browsers: [
    "Chrome 90+",
    "Safari 14+",
    "Edge 90+",
    "Firefox 88+",
    "Samsung Internet 15+",
    "Opera 76+",
    "Android WebView",
    "iOS Safari 14+",
  ],
  responsive: ["mobile-first", "tablet", "desktop"],
  inputs: ["touch", "mouse", "keyboard"],
  reducedMotion: true,
  webglFallback: true,
  liteMode: true,
};
