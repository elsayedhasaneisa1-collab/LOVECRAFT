# QR Studio

Every published site can be turned into a branded, scannable card. The card follows the
template's category, so a love site gets a heart, an event site gets a gift, a friends site
gets linked rings, a games site gets a controller, a portfolio site gets a palette and a
messages site gets an envelope. A referral card uses a star.

## How a user gets a card

1. `🎟️ رمز QR لموقعي` in the bot menu (also available as a button on the site screen).
2. The user picks one of their sites, or asks for the referral card.
3. The bot answers with the card as a photo, the direct link in the caption, and inline
   buttons for opening and sharing the site.

## The artwork

- The QR matrix is generated with error correction level **M** and is never obstructed:
  the finder patterns, the alignment modules and the four-module quiet zone stay intact,
  which is why the cards scan reliably.
- The category shape frames the card as an outline, and the palette changes per category.
- `watermark.png` from the repository root is embedded as the brand mark in the lower lockup,
  together with the handle `@LoveCraftMakerBot`.
- The card is rendered at 1240×1360 PNG.

## Verified behaviour

`scripts/check-qr-studio.ts` renders all seven shapes and decodes each one with a real QR
decoder at six different scan sizes (1400 → 700 px), proving that a phone camera reads the
link at any distance. `scripts/check-qr-bot-flow.ts` walks the whole bot flow: menu entry,
site list, card generation, image download, decode back to the site link, cache reuse,
referral card, path-traversal rejection and cross-origin rejection.

## Where the file lives

Cards are written to `QR_CACHE_DIR` (the system temp folder by default) and served from
`/api/qr/image/[file]`, which only accepts the exact generated file name. When
`GITHUB_TOKEN` is configured the same file is also published to the repository root through
the GitHub Contents API; the bot then prefers the durable public GitHub image URL. On
serverless hosting the local cache is ephemeral and cannot be used as persistent hosting
without a separately configured storage provider/token. Use a new, restricted deployment
credential rather than the token used for the initial Git push.
`scripts/publish-qr-to-github.mjs` can publish the whole cache in one run.

## Resource protection

- The card is cached on disk and reused, so a repeated request never re-encodes or
  re-rasterises anything.
- Generation is rate limited per client.
- Publishing to GitHub is skipped when the remote file already has the same size.
- The watermark and the catalogue stay in memory after the first read.
