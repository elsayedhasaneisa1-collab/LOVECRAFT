import { NextRequest, NextResponse } from "next/server";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { processBotInteraction } from "@/lib/bot-fsm";
import { uploadImageToCatbox } from "@/lib/catbox";
import { registerOrTouchTelegramUser } from "@/lib/site-engine";
import {
  checkRateLimit,
  constantTimeCompare,
  getClientIp,
  logSecurityEvent,
} from "@/lib/security";

async function callTelegramApi(token: string, method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!webhookSecret || !botToken) {
    return NextResponse.json(
      { error: "Webhook secrets are not configured in environment variables." },
      { status: 503 }
    );
  }

  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!incomingSecret || !constantTimeCompare(incomingSecret, webhookSecret)) {
    await logSecurityEvent({
      severity: "high",
      eventType: "telegram_webhook_invalid_secret",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = checkRateLimit(`tg-webhook:${ip}`, 180, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let update: Record<string, unknown>;
  try {
    update = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensurePlatformSeeded();

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "lovecraft.app";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${proto}://${host}`;

  // 1. Callback query (InlineKeyboardMarkup interaction — edits existing message)
  if (update.callback_query && typeof update.callback_query === "object") {
    const cq = update.callback_query as {
      id: string;
      from: { id: number; first_name?: string; last_name?: string; username?: string };
      data?: string;
      message?: { message_id: number; chat: { id: number }; photo?: unknown[] };
    };
    if (cq.message && cq.from) {
      const view = await processBotInteraction({
        telegramUserId: cq.from.id,
        telegramChatId: cq.message.chat.id,
        firstName: cq.from.first_name || "مستخدم",
        lastName: cq.from.last_name,
        username: cq.from.username,
        actionType: "callback",
        callbackData: cq.data || "nav:main",
        baseUrl,
        ipAddress: ip,
      });

      if (view.mode === "edit_media" && view.photo_url) {
        await callTelegramApi(botToken, "editMessageMedia", {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          media: {
            type: "photo",
            media: view.photo_url,
            caption: view.text,
            parse_mode: "HTML",
          },
          reply_markup: view.reply_markup,
        });
      } else if (cq.message.photo) {
        await callTelegramApi(botToken, "deleteMessage", {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
        });
        await callTelegramApi(botToken, "sendMessage", {
          chat_id: cq.message.chat.id,
          text: view.text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: view.reply_markup,
        });
      } else {
        await callTelegramApi(botToken, "editMessageText", {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: view.text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: view.reply_markup,
        });
      }
      await callTelegramApi(botToken, "answerCallbackQuery", { callback_query_id: cq.id });
    }
    return NextResponse.json({ ok: true });
  }

  // 2. Message (/start, text step, or photo step)
  if (update.message && typeof update.message === "object") {
    const msg = update.message as {
      message_id: number;
      chat: { id: number };
      from?: { id: number; first_name?: string; last_name?: string; username?: string };
      text?: string;
      photo?: Array<{ file_id: string; file_size?: number }>;
    };
    if (!msg.from) return NextResponse.json({ ok: true });

    // Photo received -> download from Telegram -> validate -> upload to Catbox -> store URL only
    if (Array.isArray(msg.photo) && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1]!;
      const fileInfoRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(
          largest.file_id
        )}`
      );
      const fileInfo = (await fileInfoRes.json()) as {
        ok?: boolean;
        result?: { file_path?: string };
      };
      if (fileInfo.ok && fileInfo.result?.file_path) {
        const dlRes = await fetch(
          `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
        );
        const bytes = new Uint8Array(await dlRes.arrayBuffer());
        const reg = await registerOrTouchTelegramUser({
          telegramUserId: msg.from.id,
          telegramChatId: msg.chat.id,
          firstName: msg.from.first_name || "مستخدم",
          lastName: msg.from.last_name,
          username: msg.from.username,
          ipAddress: ip,
        });
        if (!reg.ban.isBanned) {
          const uploaded = await uploadImageToCatbox({
            userId: reg.user.id,
            fileBytes: bytes,
            assetRole: "gallery",
          });
          if (uploaded.ok) {
            const view = await processBotInteraction({
              telegramUserId: msg.from.id,
              telegramChatId: msg.chat.id,
              firstName: msg.from.first_name || "مستخدم",
              lastName: msg.from.last_name,
              username: msg.from.username,
              actionType: "photo_uploaded",
              uploadedAsset: { assetId: uploaded.assetId, url: uploaded.url },
              baseUrl,
              ipAddress: ip,
            });
            await callTelegramApi(botToken, "sendMessage", {
              chat_id: msg.chat.id,
              text: view.text,
              parse_mode: "HTML",
              reply_markup: view.reply_markup,
            });
            return NextResponse.json({ ok: true });
          } else {
            await callTelegramApi(botToken, "sendMessage", {
              chat_id: msg.chat.id,
              text: `⚠️ ${uploaded.message}`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "⏭️ المتابعة للألوان ▶️", callback_data: "wiz:colors" }]],
              },
            });
            return NextResponse.json({ ok: true });
          }
        }
      }
    }

    // /start or text input
    const text = (msg.text || "").trim();
    const isStart = text === "/start" || text.startsWith("/start ");
    const startPayload = isStart ? text.slice(7).trim() || null : null;

    const view = await processBotInteraction({
      telegramUserId: msg.from.id,
      telegramChatId: msg.chat.id,
      firstName: msg.from.first_name || "مستخدم",
      lastName: msg.from.last_name,
      username: msg.from.username,
      actionType: isStart ? "start" : "text",
      startPayload,
      textInput: isStart ? null : text,
      baseUrl,
      ipAddress: ip,
    });

    await callTelegramApi(botToken, "sendMessage", {
      chat_id: msg.chat.id,
      text: view.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: view.reply_markup,
    });
  }

  return NextResponse.json({ ok: true });
}
