# QR Studio on Vercel

Open **🎟️ رمز QR لموقعي** in the Telegram bot or in the web studio. The category sets the artwork: heart (love), gift (events), rings (friends), controller (games), palette (portfolio), envelope (messages), and star (referral). The watermark and bot handle remain outside the scannable grid. The template renderer does not put a QR card inside the published site.

A signed, same-origin `/api/qr/image/[file]` URL describes the QR content. Only a signed descriptor can render an image; anonymous clients cannot ask the backend to sign arbitrary URLs or other people's sites. The route emits a PNG and Vercel CDN caches it. `QR_SIGNING_SECRET` (or `BOT_API_SECRET`) must be shared by all website function instances. Rotating the signing secret invalidates uncached old image URLs; the site URL encoded in an already-sent PNG is unaffected.

The Python webhook fetches the QR from the configured website and uploads the PNG to Telegram. The message also carries the link and open/share buttons. No PNG is stored in Supabase, uploaded to GitHub, or written to a Vercel function's temporary filesystem. `QR_CACHE_DIR` is not required. Old hash-only image URLs from the retired disk cache cannot be recreated; generate a fresh card from the bot.

`npx tsx scripts/check-qr-studio.ts` verifies all seven designs at multiple scan sizes. `npx tsx scripts/check-qr-bot-flow.ts` exercises a real site creation and decodes its live QR image on the running website. See [Vercel deployment](deploy-vercel.md) for the two projects' settings.
