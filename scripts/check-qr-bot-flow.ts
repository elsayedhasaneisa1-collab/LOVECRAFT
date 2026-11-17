import 'dotenv/config';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { and, eq, lt } from 'drizzle-orm';
import { db, pool, sites, users, templates } from '../src/db';

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:3000';
const ORIGIN = { Origin: BASE, Host: '127.0.0.1:3000' };
// A dedicated client identity keeps the test clear of the shared rate limit.
const CLIENT = { 'X-Forwarded-For': `203.0.113.${Math.floor(Math.random() * 250) + 2}` };

async function decode(buffer: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize({ width: 1100 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data ?? null;
}

let testIdentity: number | undefined;
async function main() {
  const anonymous = await fetch(`${BASE}/api/bot/engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ORIGIN, ...CLIENT },
    body: JSON.stringify({
      telegramUserId: 990000777,
      telegramChatId: 990000777,
      firstName: 'x',
      actionType: 'start',
    }),
  });
  assert.equal(anonymous.status, 401, 'The engine must require authentication');

  const sessionRes = await fetch(`${BASE}/api/studio/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ORIGIN, ...CLIENT },
    body: '{}',
  });
  assert.equal(sessionRes.status, 200);
  const cookie = (sessionRes.headers.get('set-cookie') || '').split(';')[0]!;
  const profile = (await sessionRes.json()) as { telegramUserId: number; firstName: string };
  testIdentity = profile.telegramUserId;
  assert(profile.telegramUserId < 0, 'A studio session must not impersonate a Telegram account');

  const call = async (payload: Record<string, unknown>) => {
    const response = await fetch(`${BASE}/api/bot/engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...ORIGIN, ...CLIENT },
      body: JSON.stringify({
        telegramUserId: profile.telegramUserId,
        telegramChatId: profile.telegramUserId,
        firstName: profile.firstName,
        ...payload,
      }),
    });
    const raw = await response.text();
    assert.equal(response.status, 200, raw);
    return JSON.parse(raw) as {
      mode: string;
      text: string;
      photo_url?: string | null;
      reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };
    };
  };

  const [template] = await db.select().from(templates).where(eq(templates.slug, 'love-confession')).limit(1);
  await call({ actionType: 'callback', callbackData: `wiz:start:${template!.id}` });
  const answers = ['نور', 'رامي', 'موقع اختبار رمز QR', 'رسالة تختبر توليد البطاقة.', '2026-08-01', 'خاتمة جميلة'];
  const fields = (template!.fieldsSchema || []) as Array<{ key: string; required: boolean }>;
  let answerIndex = 0;
  for (const field of fields) {
    if (!field.required) {
      await call({ actionType: 'callback', callbackData: 'wiz:skip_field' });
      continue;
    }
    await call({ actionType: 'text', textInput: answers[answerIndex++] ?? 'قيمة اختبار' });
  }
  await call({ actionType: 'callback', callbackData: 'wiz:colors' });
  await call({ actionType: 'callback', callbackData: 'wiz:design' });
  await call({ actionType: 'callback', callbackData: 'wiz:music' });
  await call({ actionType: 'callback', callbackData: 'wiz:dur:1' });
  const summary = await call({ actionType: 'callback', callbackData: 'wiz:summary' });
  assert(summary.text.includes('ملخص موقعك'), 'A review summary must be shown before confirming');
  const created = await call({ actionType: 'callback', callbackData: 'wiz:confirm' });
  const slug = /\/s\/([a-z0-9-]+)/.exec(created.text)?.[1];
  assert(slug, 'The site must be created');
  const [site] = await db.select().from(sites).where(eq(sites.slug, slug!)).limit(1);

  const menu = await call({ actionType: 'callback', callbackData: 'nav:main' });
  assert(
    menu.reply_markup.inline_keyboard.flat().some((b) => b.callback_data === 'nav:qr'),
    'The QR entry must appear in the main menu'
  );

  const qrMenu = await call({ actionType: 'callback', callbackData: 'nav:qr' });
  assert(qrMenu.text.includes('بطاقات QR'));
  const buttons = qrMenu.reply_markup.inline_keyboard.flat();
  assert(buttons.some((b) => b.callback_data === `qr:site:${site!.id}`), 'The site must be listed');
  assert(buttons.some((b) => b.callback_data === 'qr:referral'), 'The referral card must be offered');

  const card = await call({ actionType: 'callback', callbackData: `qr:site:${site!.id}` });
  assert.equal(card.mode, 'edit_media', 'The card must be delivered as a photo');
  assert(card.photo_url, 'A photo URL must be returned');
  assert(card.text.includes('@LoveCraftMakerBot'), 'The bot handle must appear in the message');
  assert(card.text.includes(`/s/${slug}`), 'The message must carry the site link');
  assert(card.text.includes('شكل قلب'), 'A love site must receive the heart shaped card');

  const imageResponse = await fetch(card.photo_url!);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const decoded = await decode(imageBuffer);
  assert(decoded, 'The delivered card must be scannable');
  assert(decoded!.endsWith(`/s/${slug}`), `The card must open the site, decoded: ${decoded}`);
  console.log(`Card for ${slug} scans to ${decoded}`);

  const again = await call({ actionType: 'callback', callbackData: `qr:site:${site!.id}` });
  assert.equal(again.photo_url, card.photo_url, 'The cached card must be reused');

  const referral = await call({ actionType: 'callback', callbackData: 'qr:referral' });
  assert.equal(referral.mode, 'edit_media');
  assert(referral.photo_url);
  const referralImage = Buffer.from(await (await fetch(referral.photo_url!)).arrayBuffer());
  const referralDecoded = await decode(referralImage);
  assert(
    referralDecoded?.startsWith('https://t.me/'),
    `The referral card must encode the referral link, decoded: ${referralDecoded}`
  );
  console.log(`Referral card scans to ${referralDecoded}`);

  const traversal = await fetch(`${BASE}/api/qr/image/..%2F..%2Fpackage.json`);
  assert([400, 404].includes(traversal.status), 'Traversal must be blocked');

  const crossOrigin = await fetch(`${BASE}/api/qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ mode: 'site', slug }),
  });
  assert.equal(crossOrigin.status, 403, 'Cross-origin requests must be rejected');

  console.log('\nALL QR BOT-FLOW CHECKS PASSED.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (testIdentity !== undefined) await db.delete(users).where(and(eq(users.telegramUserId, testIdentity), lt(users.telegramUserId, 0)));
    await pool.end();
  });
