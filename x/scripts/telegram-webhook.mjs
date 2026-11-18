#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const expected = (process.env.TELEGRAM_BOT_USERNAME || 'LoveCraftMakerBot').replace(/^@/, '').trim();
const action = process.argv[2] || 'status';

function originFrom(value, key) {
  try {
    const url = new URL(value?.trim() || '');
    if (url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password && !url.port) return url.origin;
  } catch { /* Do not log a malformed URL which may include credentials. */ }
  throw new Error(`${key} must be the public production HTTPS origin.`);
}

async function telegram(method, payload = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !body?.ok) throw new Error(`${method} failed (HTTP ${res?.status || 'network error'}).`);
  return body.result;
}

async function get(url, expectedService) {
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || data?.ok !== true || (expectedService && data.service !== expectedService) || (!expectedService && data.telegramSchemaReady !== true)) {
    throw new Error(`Production health check failed (HTTP ${res?.status || 'network error'}). Confirm the domain is public and deployed.`);
  }
}

async function main() {
  if (!['register', 'status'].includes(action)) throw new Error('Use the register or status subcommand.');
  if (!/^\d+:[A-Za-z0-9_-]{20,100}$/.test(token || '')) throw new Error('Set TELEGRAM_BOT_TOKEN privately in the environment first.');
  const identity = await telegram('getMe');
  if (identity?.username?.toLowerCase() !== expected.toLowerCase()) throw new Error('The token identity does not match the configured Telegram bot username.');

  let webhook;
  if (action === 'register') {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret || '')) throw new Error('TELEGRAM_WEBHOOK_SECRET must contain 32–256 URL-safe characters.');
    const botOrigin = originFrom(process.env.BOT_WEBHOOK_BASE_URL, 'BOT_WEBHOOK_BASE_URL');
    const siteOrigin = originFrom(process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_APP_URL, 'BACKEND_API_URL');
    if (botOrigin === siteOrigin) throw new Error('The Python bot and Next.js website must have separate Vercel project origins.');
    webhook = `${botOrigin}/webhook`;
    await Promise.all([get(`${botOrigin}/healthz`, 'lovecraft-telegram'), get(`${siteOrigin}/api/health`)]);
    const guard = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      redirect: 'error', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (guard?.status !== 403) throw new Error('The public Python endpoint did not reject a request without its webhook secret.');
    const authorized = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: '{}',
      redirect: 'error', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (authorized?.status !== 400) throw new Error('The configured webhook secret does not match the Python deployment.');
    const backendSecret = process.env.BOT_API_SECRET?.trim();
    if (!backendSecret || backendSecret.length < 32) throw new Error('Set BOT_API_SECRET privately before registering the webhook.');
    const backend = await fetch(`${siteOrigin}/api/bot/delivery`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': backendSecret }, body: '{}',
      redirect: 'error', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (backend?.status !== 400) throw new Error('BOT_API_SECRET does not match the website deployment.');
    const connections = Number(process.env.TELEGRAM_WEBHOOK_CONNECTIONS || '1');
    if (!Number.isInteger(connections) || connections < 1 || connections > 4) throw new Error('TELEGRAM_WEBHOOK_CONNECTIONS must be between 1 and 4.');
    await telegram('setWebhook', {
      url: webhook, secret_token: secret, allowed_updates: ['message', 'callback_query'],
      max_connections: connections, drop_pending_updates: false,
    });
  }
  const info = await telegram('getWebhookInfo');
  if (webhook && info?.url !== webhook) throw new Error('Telegram did not confirm the selected webhook.');
  let target = 'not registered';
  if (info?.url) {
    try { const u = new URL(info.url); target = u.origin + (u.pathname === '/webhook' ? '/webhook' : ' (other path)'); }
    catch { target = 'registered (invalid URL)'; }
  }
  console.log(`Bot: @${identity.username}\nWebhook: ${target}\nPending updates: ${Number(info?.pending_update_count) || 0}`);
  if (info?.last_error_date) console.log('Telegram has recorded a delivery error; check the Python project logs and send a fresh /start message.');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Webhook verification failed.'); process.exitCode = 1; });
