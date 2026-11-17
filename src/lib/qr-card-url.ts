import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
// Deliberately separate from the image renderer: sending a link does not load Sharp.
export const qrThemes = ["love", "events", "friends", "games", "portfolio", "messages", "bot"] as const;
export type QrCardTheme = typeof qrThemes[number];
const Descriptor = z.object({ v: z.literal(1), url: z.string().max(450), theme: z.enum(qrThemes), handle: z.string().regex(/^[a-zA-Z0-9_]{5,32}$/) }).strict();
type QrCard = z.infer<typeof Descriptor>;
const globalKey = globalThis as typeof globalThis & { __loveCraftPreviewQrKey?: Buffer };

function key() {
  const secret = process.env.QR_SIGNING_SECRET?.trim() || process.env.BOT_API_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  // Local preview only. Vercel instances MUST share a configured secret.
  if (process.env.VERCEL || process.env.VERCEL_ENV) return null;
  return globalKey.__loveCraftPreviewQrKey ??= randomBytes(32);
}

function validate(data: unknown): QrCard | null {
  const parsed = Descriptor.safeParse(data);
  if (!parsed.success) return null;
  const card = parsed.data;
  try {
    const target = new URL(card.url);
    if (target.username || target.password || target.hash) return null;
    if (card.theme === "bot") {
      if (target.origin !== "https://t.me" || target.pathname.toLowerCase() !== `/${card.handle.toLowerCase()}` ||
        !/^\?start=[a-z0-9_-]{1,64}$/i.test(target.search)) return null;
    } else if (!/^\/s\/[a-z0-9-]{3,80}$/.test(target.pathname) || target.search ||
      (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))) return null;
    return { ...card, url: target.href };
  } catch { return null; }
}

export function signQrCard(params: Omit<QrCard, "v">): string | null {
  const secret = key();
  const card = validate({ v: 1, ...params });
  if (!secret || !card) return null;
  const payload = Buffer.from(JSON.stringify(card)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`lovecraft:qr:${payload}`).digest("base64url");
  return `${payload}.${signature}.png`;
}

export function readQrCard(file: string): QrCard | null {
  const matched = /^([\w-]{32,830})\.([A-Za-z0-9_-]{43})\.png$/.exec(file);
  const secret = key();
  if (!matched || !secret) return null;
  const [, payload, sig] = matched;
  const expected = createHmac("sha256", secret).update(`lovecraft:qr:${payload}`).digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return validate(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); }
  catch { return null; }
}
