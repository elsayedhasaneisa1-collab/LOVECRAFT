# نشر LOVECRAFT على Vercel فقط

اربط **نفس مستودع GitHub** بمشروعين في Vercel. GitHub لحفظ الكود والقوالب، وليس لتشغيل البوت أو استضافة الصور الجديدة.

إذا استلمت تحديث النشر كملف `LOVECRAFT-vercel.patch` بدل تحديث مباشر على GitHub، طبّقه في clone نظيف من فرع `main` الحالي قبل الاستيراد. سجّل الدخول إلى GitHub على جهازك بالطريقة المعتادة ثم ادفع commit باسم حسابك المرتبط بـVercel:

```sh
git switch main
git pull --ff-only
git apply --index /path/to/LOVECRAFT-vercel.patch
git commit -m "Deploy website and Telegram bot on Vercel"
git push origin main
```

| الإعداد | الموقع ولوحة الإدارة | بوت Telegram |
| --- | --- | --- |
| Project Name (مثال) | `lovecraft-web` | `lovecraft-telegram` |
| Root Directory | الجذر (اتركه فارغًا) | `bot` |
| Framework Preset | Next.js | FastAPI |
| فرع الإنتاج | `main` | `main` |
| التحقق | `/api/health` | `/healthz` |
| واجهة Telegram | لا تستخدم `/api/telegram/webhook` القديم | `/webhook` على نطاق الإنتاج |

الملف `bot/main.py` يصدّر `app` لـVercel Python. لا تحتاج `npm install` أو `npm run build` في مشروع البوت، ولا تحتاج Polling أو أي خادم يعمل طوال اليوم. اترك إعدادات البناء للكشف التلقائي، وفعّل Fluid Compute إذا كان معطلًا. اختر نطاقي الإنتاج الثابتين، وليس عنوان Preview محميًا بتسجيل الدخول. حماية `/webhook` تتم بسر Telegram، ولا تتطلب حساب Vercel من المتصل.

لو ظهر خطأ بصلاحية **Git Commit Author** على خطة Hobby، اربط حساب GitHub المالك من **Vercel → Account Settings → Login Connections**، وادفع commit من الهوية المرتبطة، ثم أعد النشر.

## 1. جهّز قاعدة البيانات والصور

- Vercel يشغّل الكود، وليس خادم PostgreSQL مدمجًا. استخدم **Supabase PostgreSQL** كما هو في المشروع، أو اربطه من Marketplace. Supabase مسؤول عن تخزين البيانات فقط؛ لا توجد عليه استضافة للموقع أو البوت.
- من بيئة موثوقة اتصل بقاعدة البيانات المقصودة عبر اتصال migrations مباشر أو Session Pooler، وطبّق `npx drizzle-kit push`، ثم `sql/rls_policies.sql` و`sql/resource-efficiency.sql` باستخدام `psql` مع إيقاف التنفيذ عند الخطأ. راجع تغييرات المخطط وخذ نسخة احتياطية قبل تحديث قاعدة موجودة. يتضمن المخطط جدول `telegram_deliveries`، الذي يمنع تكرار تأثير تحديثات Telegram بعد تبدّل نسخ Functions.
- في **مشروع الموقع** اضبط `DATABASE_URL` على رابط Transaction Pooler من Supabase مع TLS. الإعداد الافتراضي هو اتصالان لكل نسخة من Function. لا تحدّث المخطط من داخل أمر Build.
- اربط **Public Vercel Blob** بمشروع الموقع، وتأكد من وجود `BLOB_READ_WRITE_TOKEN` في بيئة الإنتاج. الصور الجديدة تُضغط إلى WebP (إطار واحد، بلا بيانات EXIF) وتحفظ على Vercel Blob. PostgreSQL يحفظ الرابط فقط. حد الصورة 4 MiB. ملفات Catbox القديمة تظل قابلة للعرض كما هي؛ لا يتم إرسال صور جديدة إليها. حذف الرابط من الموقع لا يجعل رابط Blob العام خاصًا.

## 2. اضبط الأسرار لكل مشروع

| المتغير | الموقع | البوت |
| --- | :---: | :---: |
| `DATABASE_URL` | ✓ | – |
| `NEXT_PUBLIC_APP_URL` | ✓، رابط إنتاج الموقع HTTPS | – |
| `BLOB_READ_WRITE_TOKEN` | ✓ لرفع صور جديدة | – |
| `BOT_API_SECRET` | ✓ | ✓، **نفس القيمة** |
| `CRON_SECRET` | ✓ لتشغيل تنظيف البيانات والصلاحية | – |
| `TELEGRAM_BOT_USERNAME` | `LoveCraftMakerBot` | – |
| `TELEGRAM_BOT_TOKEN` | – | ✓، من BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | – | ✓، مختلف عن أسرار الموقع |
| `BACKEND_API_URL` | – | ✓، رابط HTTPS لإنتاج الموقع، بدون مسار |

- ولّد الأسرار محليًا بقيم عشوائية مستقلة، مثل `openssl rand -hex 32`. لا تضع قيم الأسرار في Git أو الشات. اضبطها لبيئة Production ثم أعد النشر. يمكنك وضع `QR_SIGNING_SECRET` على الموقع فقط (32 حرفًا على الأقل) حتى تستمر روابط QR عند تدوير `BOT_API_SECRET`.
- بطاقات QR تُولَّد داخل Vercel من رابط موقّع، ويُخزِّن Vercel CDN الصورة مؤقتًا. البوت يرسل ملف PNG لـTelegram مباشرة. لا تحتاج `QR_CACHE_DIR` ولا توكن GitHub لحفظ البطاقات.
- `GITHUB_TOKEN` اختياري للاستيراد من **ريبو قوالب خاص** فقط. المستودع العام لا يحتاجه. لا تُعد استخدام توكن ظهر في المحادثة؛ ألغِه من حساب GitHub.

## 3. سجل الـWebhook مرة واحدة بعد النشر

في نسخة محلية موثوقة من المشروع، ضع في بيئة محلية غير متتبّعة `TELEGRAM_BOT_TOKEN` و`TELEGRAM_WEBHOOK_SECRET` و`BOT_API_SECRET`، ثم `BOT_WEBHOOK_BASE_URL` (نطاق إنتاج مشروع Python) و`BACKEND_API_URL` (نطاق إنتاج الموقع). بعد `npm ci` شغّل:

```sh
node scripts/telegram-webhook.mjs register
node scripts/telegram-webhook.mjs status
```

السكربت يتحقق من اسم البوت وصحة المشروعين قبل استدعاء Telegram، ولا يطبع الأسرار. يترك التحديثات المعلقة ولا يحذفها. الافتراضي اتصال Webhook واحد للبدء بحمل خفيف؛ يمكن رفع `TELEGRAM_WEBHOOK_CONNECTIONS` إلى 4 عند الحاجة. تعديلات الكود العادية لا تتطلب إعادة تسجيل طالما لم يتغير النطاق أو السر.

أرسل `/start` في `@LoveCraftMakerBot` بعد التسجيل. جرّب تصفح القوالب، إنشاء موقع، فتح رابطه، ثم توليد بطاقة QR. جرّب رفع صورة بعد توصيل Blob. المسار القديم داخل Next.js يرجع HTTP 410 عمدًا حتى لا تعمل نسختان من البوت.

## تحقق محلي، بدون نشر خارجي

```sh
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
npx tsx scripts/check-vercel-backend.ts
```

يحتاج اختبار قاعدة البيانات إلى قاعدة **اختبار محلية** بعد تطبيق المخطط (ولا يرسل رسائل Telegram فعلية). اختبارات Python تستخدم `httpx==0.28.1` كاعتماد اختبار إضافي: من `bot/` شغّل `python -m unittest test_webhook.py` بعد تثبيت الاعتمادات. الاختبارات تتحقق من سر الـWebhook، معالجة التحديث، إعادة التسليم، ورفع بطاقة QR عبر Telegram API مُحاكَى. التحقق المحلي ليس إثباتًا أن حساب Vercel متصل أو أن webhook الإنتاج اتسجل بالفعل.
