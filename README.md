# LOVECRAFT BOT

**Your Moments. Your Website.**

منصة متكاملة لإنشاء مواقع ويب مستقلة وتفاعلية من خلال Telegram Bot: مكتبة قوالب ضخمة،
مكتبة عناصر تصميم داخلية، محرك مشاهد ثلاثية الأبعاد، مولّد بطاقات QR احترافية، نظام إحالات
ورصيد، ولوحة إدارة مركزية محمية.

---

## What is inside

| Area | Details |
| --- | --- |
| Templates | 110 ready templates across 6 categories, each with its own interaction engine and pinned version |
| Component library | 75 interior design variants: 10 Hero, 12 Background, 8 Typography, 10 Button, 9 Gallery, 16 Section, 10 Effect |
| 3D & motion | Three.js scenes (procedural, no external assets), Motion transitions, canvas-confetti celebrations |
| Bot | Python + aiogram 3, inline keyboards only, webhook or polling, no owner commands |
| Website engine | Multi-tenant rendering: one template serves thousands of isolated sites at `/s/<slug>` |
| QR studio | Category-shaped, scannable cards with the brand watermark and `@LoveCraftMakerBot` |
| Referrals | Strict separation between creation credit and weekly site continuity, anti-duplicate, non-refundable ledger |
| Admin | `/admin` — users, bans, sites, referrals, templates, bot settings, system settings, audit log, resource monitor |

## Stack

Next.js 16 (App Router) · React 19 · PostgreSQL + Drizzle ORM · Tailwind CSS 4 · Three.js ·
Motion · canvas-confetti · aiogram 3 · Sharp · Vercel Cron.

## Getting started

```bash
npm install
cp .env.example .env      # fill DATABASE_URL and the secrets below
npx drizzle-kit push      # create the schema
psql "$DATABASE_URL" -f sql/rls_policies.sql
psql "$DATABASE_URL" -f sql/resource-efficiency.sql
npm run build && npm start
```

Create the owner account securely (there is no public signup and no default credentials):

```bash
OWNER_USERNAME="owner" \
OWNER_EMAIL="owner@yourdomain.com" \
OWNER_PASSWORD="a-strong-password" \
node scripts/create-owner.mjs
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin used in links and QR cards |
| `TELEGRAM_BOT_TOKEN` | for Telegram | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | for webhook | Secret token for `X-Telegram-Bot-Api-Secret-Token` |
| `BOT_API_SECRET` | yes | Shared secret between the bot and the backend |
| `CRON_SECRET` | yes | Protects the scheduled maintenance endpoints |
| `GITHUB_TOKEN` | optional | Server-side token for future GitHub imports and QR uploads; do not reuse the one-time push token |
| `GITHUB_TEMPLATES_OWNER` / `_REPO` / `_BRANCH` | optional | Defaults to `elsayedhasaneisa1-collab/LOVECRAFT` on `main` |
| `CATBOX_USERHASH` | optional | Catbox account hash for image hosting |
| `DATABASE_POOL_MAX` | optional | Connection pool size (default 20) |
| `RETENTION_*` | optional | Data retention windows in days |

## Deploying to Vercel and Telegram

1. Import `https://github.com/elsayedhasaneisa1-collab/LOVECRAFT` into Vercel and choose the `main` branch. Vercel runs `npm run build` automatically.
2. Before the first live request, apply the PostgreSQL schema from a trusted environment with `DATABASE_URL` set: `npx drizzle-kit push`, then apply `sql/rls_policies.sql` and `sql/resource-efficiency.sql` with `psql`. The Drizzle config reads `DATABASE_URL` from the environment; no database passwords are committed.
3. In Vercel → Project Settings → Environment Variables configure `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` (the actual HTTPS deployment origin), `CRON_SECRET` (at least 32 random bytes), `BOT_API_SECRET`, `TELEGRAM_BOT_USERNAME=LoveCraftMakerBot`, and the Telegram secrets if using the webhook. Generate each secret independently. Do not reuse or store any personal token used to push this repository.
4. The `vercel.json` cron jobs invoke daily site-validity checks and retention; both endpoints require `Authorization: Bearer <CRON_SECRET>`. The standalone Python aiogram bot needs its own continuously running host; do not run polling and the Next.js webhook at the same time.
5. If you want newly generated QR cards permanently available across Vercel serverless instances, set a **new, narrowly scoped** `GITHUB_TOKEN` in Vercel (Contents: Read and write, only this repository) and keep the repository public for the resulting artwork links. Without it the QR image fallback uses an ephemeral filesystem cache and cannot be guaranteed to survive between serverless invocations.
6. Provision the first owner securely with `scripts/create-owner.mjs` from a trusted environment; there are no default admin credentials or public admin registration.

The code can build without any `.env` file, but API routes that query PostgreSQL require `DATABASE_URL` when they run. Never commit `.env` or push deployment credentials to GitHub.

## Templates and GitHub

The catalogue is declarative data, never executable third-party code.

```bash
npx tsx scripts/export-templates.ts    # regenerate templates/catalog.json and the manifests
npx tsx scripts/refresh-library.ts     # apply schema upgrades without touching existing sites
```

Commit the `templates/` folder, set the repository in the owner console, then use
**مزامنة GitHub** in `/admin`. Imported versions stay unpublished until the owner approves
them. The importer validates renderer identifiers, component variants, input schemas and
artwork paths, and refuses anything that does not match the studio schema.

## QR studio

The bot answers **🎟️ رمز QR لموقعي** with a branded card shaped after the site category
(heart, gift, rings, controller, palette, envelope, star). Cards carry the repository
watermark and `@LoveCraftMakerBot`.

```bash
npx tsx scripts/check-qr-studio.ts      # renders and decodes all shapes
node scripts/publish-qr-to-github.mjs    # publishes the cached cards to the repository root
```

Cards are cached on disk (`QR_CACHE_DIR`, the system temp folder by default) and served
from `/api/qr/image/[file]`.

## Verification

```bash
npx tsx scripts/check-resource-efficiency.ts  # query, write, retention and cache measurements
npx tsx scripts/check-template-readiness.ts    # catalogue, versions and footer integrity
npx tsx scripts/check-studio-creation.ts       # creation lifecycle, idempotency, no refunds
npx tsx scripts/check-qr-bot-flow.ts           # QR flow end to end with real decoding
node scripts/check-all-template-renders.mjs    # every template hydrated in three engines
node scripts/browser-library-check.mjs         # library interactions in three engines
node scripts/check-motion-journey.mjs          # 3D gift, guided journey and fallbacks
```

## Operations

- `vercel.json` schedules `/api/cron/evaluate-sites` daily and `/api/cron/retention` at night.
- The credit ledger and referral history are financial records and are never pruned.
- Raw visit rows are short-lived; a daily rollup keeps the durable analytics.
- `/admin` → **النظام والأمان** shows the live database footprint and pool utilisation.

## Developer credit

Every generated website carries a mandatory, non-removable footer:

> © 2026 | developed by elsayed hasan

The name links to WhatsApp with a prepared message. The footer lives in the shared renderer,
outside template customisation, so it can be neither removed nor replaced.

## License

The bundled templates, component library and artwork are part of this project. The bundled
fonts keep their own licence notices in `public/fonts/`.
