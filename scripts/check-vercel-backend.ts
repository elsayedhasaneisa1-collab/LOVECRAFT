import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { db, pool, siteAssets, telegramDeliveries, templates, users, userSessions } from '../src/db';
import { POST as delivery } from '../src/app/api/bot/delivery/route';
import { POST as engine } from '../src/app/api/bot/engine/route';
import { POST as photo } from '../src/app/api/upload/photo/route';
import { POST as previousWebhook } from '../src/app/api/telegram/webhook/route';
import { GET as qr } from '../src/app/api/qr/image/[file]/route';
import { ensurePlatformSeeded } from '../src/lib/bootstrap';
import { readQrCard, signQrCard } from '../src/lib/qr-card-url';
import { prepareSitePhoto, uploadSitePhoto } from '../src/lib/site-media';

const origin = 'https://lovecraft-vercel-qa.example';
const identity = randomInt(1_000_000_000_000, 8_000_000_000_000);
const ids: number[] = [];
const secret = randomBytes(32).toString('hex');
const user = { telegramChatId: identity, telegramUserId: identity, firstName: 'QA' };

function req(route: string, body: unknown, credential: string | null = secret) {
  return new NextRequest(origin + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { 'X-Bot-Secret': credential } : {}) },
    body: JSON.stringify(body),
  });
}
async function invoke(handler: (r: NextRequest) => Promise<Response>, route: string, payload: unknown) {
  const res = await handler(req(route, payload));
  const text = await res.text();
  assert.equal(res.status, 200, text);
  return JSON.parse(text);
}
function newId() { const id = randomInt(1_000_000_000_000, 8_000_000_000_000); ids.push(id); return id; }
const claim = (updateId: number) => invoke(delivery, '/api/bot/delivery', { action: 'claim', chatId: identity, updateId });
const mark = (updateId: number, lease: string, action: 'finish' | 'release', messageId = 123) => invoke(delivery, '/api/bot/delivery', { action, chatId: identity, updateId, lease, messageId });
const view = (updateId: number, lease: string, payload: object) => invoke(engine, '/api/bot/engine', { ...user, ...payload, delivery: { updateId, lease } });

async function main() {
  if (!process.env.DATABASE_URL || !['127.0.0.1','localhost','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) {
    throw new Error('Run this fixture against local PostgreSQL only.');
  }
  process.env.BOT_API_SECRET = secret;
  process.env.QR_SIGNING_SECRET = randomBytes(32).toString('hex');
  process.env.NEXT_PUBLIC_APP_URL = origin;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  await ensurePlatformSeeded();

  const start = newId(), selectTemplate = newId(), input = newId(), other = newId();
  assert.equal((await delivery(req('/api/bot/delivery', { action: 'claim', chatId: identity, updateId: start }, 'wrong'))).status, 401);
  assert.equal((await engine(req('/api/bot/engine', { ...user, actionType: 'start' }))).status, 403, 'Worker must not bypass the delivery journal');
  assert.equal((await previousWebhook()).status, 410);
  const first = await claim(start);
  assert.equal(first.status, 'claimed');
  assert.equal((await claim(start)).status, 'busy');
  assert.equal((await claim(other)).status, 'busy');
  const menu = await view(start, first.lease, { actionType: 'start' });
  assert.match(menu.text, /LOVECRAFT/);
  await mark(start, first.lease, 'finish');
  assert.equal((await claim(start)).status, 'delivered');
  const [row] = await db.select({ pending: telegramDeliveries.pendingView }).from(telegramDeliveries).where(eq(telegramDeliveries.updateId, start));
  assert.equal(row.pending, null);

  const [template] = await db.select({ id: templates.id }).from(templates).where(eq(templates.slug, 'love-confession')).limit(1);
  assert(template);
  const tplUpdate = await claim(selectTemplate);
  assert.equal(tplUpdate.lastMessageId, 123);
  await view(selectTemplate, tplUpdate.lease, { actionType: 'callback', callbackData: `wiz:start:${template.id}` });
  await mark(selectTemplate, tplUpdate.lease, 'finish');
  const [owner] = await db.select().from(users).where(eq(users.telegramUserId, identity));
  const next = await claim(input);
  const text = { actionType: 'text', textInput: 'نور' };
  const saved = await view(input, next.lease, text);
  await mark(input, next.lease, 'release');
  const retried = await claim(input);
  assert.deepEqual(retried.view, saved);
  assert.notEqual(retried.lease, next.lease);
  assert.deepEqual(await view(input, retried.lease, text), saved);
  const [session] = await db.select().from(userSessions).where(eq(userSessions.userId, owner.id));
  assert.equal(session.draftPayload.stepIndex, 1, 'Telegram retry must not advance the wizard twice');
  await mark(input, retried.lease, 'finish');

  const collision = newId();
  const racing = await Promise.all([claim(collision), claim(collision)]);
  assert.equal(racing.filter((c) => c.status === 'claimed').length, 1);
  const lease = racing.find((c) => c.status === 'claimed').lease;
  const attempt = await view(collision, lease, { actionType: 'photo_error', photoError: 'size' });
  assert.match(attempt.text, /خطوة إضافة الصور/);
  await mark(collision, lease, 'finish');

  const sample = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#9871ef' } }).jpeg().toBuffer();
  const file = new File([new Uint8Array(sample)], 'photo.jpg', { type: 'image/jpeg' });
  const out = await prepareSitePhoto(sample, ['image/jpeg']);
  assert(out);
  assert.equal((await sharp(out).metadata()).format, 'webp');
  assert.equal(await prepareSitePhoto(Buffer.from('<svg/>'), ['image/jpeg']), null);
  const notYet = await uploadSitePhoto(identity, file);
  assert(!notYet.ok);
  assert.equal(notYet.status, 409);
  await db.update(userSessions).set({ wizardStep: 'photos' }).where(eq(userSessions.id, session.id));
  const noStore = await uploadSitePhoto(identity, file);
  assert(!noStore.ok);
  assert.equal(noStore.code, 'STORAGE_NOT_CONFIGURED');
  const form = new FormData();
  form.append('file', file);
  assert.equal((await photo(new NextRequest(`${origin}/api/upload/photo`, { method: 'POST', body: form }))).status, 401);
  const [assets] = await db.select({ id: siteAssets.id }).from(siteAssets).where(eq(siteAssets.userId, owner.id));
  assert.equal(assets, undefined, 'Unsuccessful upload must not create a row');

  // Use the real Blob SDK with a loopback fake; no token/network to Vercel is needed.
  let bytes: Buffer | undefined;
  const blob = createServer(async (r, res) => {
    if (r.method !== 'PUT') { res.statusCode = 400; res.end('{}'); return; }
    const pieces = [];
    for await (const chunk of r) pieces.push(Buffer.from(chunk));
    bytes = Buffer.concat(pieces);
    const pathname = 'site-media/32c0479b-fb56-48ea-bc82-4aeb74d7f9d2.webp';
    const url = `https://fixture.public.blob.vercel-storage.com/${pathname}`;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ url, downloadUrl: url, pathname, contentType: 'image/webp', contentDisposition: 'inline' }));
  });
  await new Promise<void>((resolve) => blob.listen(0, '127.0.0.1', resolve));
  try {
    const address = blob.address();
    assert(address && typeof address !== 'string');
    process.env.VERCEL_BLOB_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.BLOB_READ_WRITE_TOKEN = ['vercel', 'blob', 'rw', 'fixture', 'not-a-real-token'].join('_');
    const savedImage = await uploadSitePhoto(identity, file);
    assert(savedImage.ok, 'Blob-backed upload should succeed');
    assert(bytes);
    assert.equal((await sharp(bytes).metadata()).format, 'webp');
    const [stored] = await db.select().from(siteAssets).where(eq(siteAssets.id, savedImage.assetId));
    assert.equal(stored.catboxUrl, savedImage.url);
    assert.equal(stored.provider, 'vercel-blob');
    assert.equal(stored.fileSizeBytes, bytes.byteLength);
  } finally {
    delete process.env.VERCEL_BLOB_API_URL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await new Promise<void>((resolve, reject) => blob.close((error) => error ? reject(error) : resolve()));
  }

  const target = `${origin}/s/noor-envelope`;
  const name = signQrCard({ url: target, theme: 'love', handle: 'LoveCraftMakerBot' });
  assert(name);
  assert.equal(readQrCard(name)?.url, target);
  const forged = name.replace(/\.([A-Za-z0-9_-])/, (_, c) => `.${c === 'A' ? 'B' : 'A'}`);
  const fetchQR = (file: string) => qr(new NextRequest(`${origin}/api/qr/image/${file}`), { params: Promise.resolve({ file }) });
  assert.equal((await fetchQR(forged)).status, 404);
  const card = await fetchQR(name);
  assert.equal(card.status, 200);
  assert.equal(card.headers.get('content-type'), 'image/png');
  assert(card.headers.get('vercel-cdn-cache-control')?.includes('s-maxage'));
  const rgba = await sharp(Buffer.from(await card.arrayBuffer())).resize(700).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(rgba.data), rgba.info.width, rgba.info.height)?.data, target);
  const manifest = JSON.parse(await readFile('bot/vercel.json', 'utf8'));
  assert.equal(manifest.framework, 'fastapi');
  assert.equal(manifest.functions['main.py'].maxDuration, 60);
  console.log('Vercel backend: secret guards, persistent bot panel, transactional replay, photo validation, signed scannable PNG, and build manifests passed.');
}

const localDb = process.env.DATABASE_URL && ['127.0.0.1','localhost','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname);
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (!localDb) return;
  if (ids.length) await db.delete(telegramDeliveries).where(and(inArray(telegramDeliveries.updateId, ids), eq(telegramDeliveries.chatId, identity)));
  await db.delete(users).where(and(eq(users.telegramUserId, identity), ne(users.accountStatus, 'permanent_ban')));
  await pool.end();
});
