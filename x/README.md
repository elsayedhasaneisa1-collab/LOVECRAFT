# LOVECRAFT BOT

**Your Moments. Your Website.**

منصة لإنشاء مواقع تفاعلية من Telegram Bot واستوديو الويب: **110 قوالب**، مشاهد ثلاثية الأبعاد، وبطاقات QR، وإدارة مواقع وإحالات.

## النشر على Vercel

انشر [المستودع نفسه](https://github.com/elsayedhasaneisa1-collab/LOVECRAFT) كمشروعين، كلاهما على Vercel:

| المشروع | Root Directory | Framework | التحقق |
| --- | --- | --- | --- |
| الموقع ولوحة الإدارة | جذر المستودع | Next.js | `/api/health` |
| `@LoveCraftMakerBot` | `bot` | FastAPI / aiogram | `/healthz` |

البوت يستقبل التحديثات على `/webhook` في مشروع Python. لا يوجد Polling، أو خادم يحتاج إلى العمل باستمرار. تُرفع الصور الجديدة إلى Vercel Blob، وتُولّد بطاقات QR من الموقع بروابط موقّعة دون متطلبات تخزين خارجية. **Supabase PostgreSQL** يبقى قاعدة بيانات الموقع فقط. لا يحتاج البوت إلى بيانات الاتصال بقاعدة البيانات.

اتبع [دليل Vercel بالعربي](docs/deploy-vercel.md) لإعداد متغيرات المشروعين، وتهيئة Supabase، وتسجيل الـWebhook بأمان. لا تضع `.env` في Git.

## التشغيل المحلي

1. استخدم Node.js 22 وPython 3.12. ثبّت حزم الويب بـ`npm ci`، وحزم البوت باستخدام `bot/requirements.txt`.
2. انسخ `.env.example` إلى ملف `.env` غير متتبّع واضبط رابط PostgreSQL المحلي.
3. شغّل `npx drizzle-kit push`، ثم طبّق `sql/rls_policies.sql` و`sql/resource-efficiency.sql` على قاعدة البيانات المحلية. يمكن تشغيل التطوير عبر `npm run dev`.
4. لإنشاء أول مسؤول، اضبط `OWNER_USERNAME` و`OWNER_EMAIL` و`OWNER_PASSWORD` في بيئة خاصة وشغّل `node scripts/create-owner.mjs`. لا يوجد حساب أو كلمة مرور افتراضية.

## القوالب والـQR

القوالب مدمجة في المشروع ومخططها وصفي، وليس كود JavaScript مستوردًا. يمكن مزامنة كتالوج قوالب إضافي من صفحة `/admin`؛ يبقى الإصدار المستورد غير منشور حتى يراجعه المالك. `npx tsx scripts/export-templates.ts` يعيد توليد الكتالوج من المصدر المعتمد.

القسم **🎟️ رمز QR لموقعي** ينشئ بطاقة حسب التصنيف، بالعلامة المائية واسم البوت. لا تُحفظ البطاقات في Supabase أو GitHub. راجع [دليل QR](docs/qr-studio.md) و[إدارة موارد قاعدة البيانات](docs/resource-efficiency.md).

## الاختبارات

- `npx tsx scripts/check-vercel-backend.ts`: سجل تسليم Telegram، ثبات المعالج وإعادة التسليم، توقيع الـQR وفك قراءته، والتحقق من الصور. استخدم فقط قاعدة اختبار محلية.
- `npx tsx scripts/check-template-readiness.ts` و`npx tsx scripts/check-studio-creation.ts`: القوالب وإنشاء المواقع.
- `npx tsx scripts/check-qr-bot-flow.ts`: اختبار توليد QR وزر المشاركة في الاستوديو.
- `node scripts/check-all-template-renders.mjs`: عرض القوالب على Chromium وFirefox وWebKit بعد تثبيت المتصفحات بـPlaywright.
- `python -m unittest test_webhook.py` من مجلد `bot/` (مع `httpx==0.28.1`): اختبار الـWebhook بمزوّد Telegram مُحاكَى.

جميع المواقع المنشأة تحمل الفوتر الإلزامي `developed by elsayed hasan`، المرتبط بواتساب مع رسالة جاهزة. تراخيص الخطوط في `public/fonts/`.
