"""FastAPI + aiogram webhook for Vercel. There is no polling loop or local session store."""
import asyncio
from html import escape
import hmac
import io
import json
import logging
from urllib.parse import urlsplit

from aiohttp import ClientError
from aiogram import Bot, Dispatcher, F
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.types import BufferedInputFile, CallbackQuery, InputMediaPhoto, LinkPreviewOptions, Message, Update
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from api_client import BackendError, LovecraftBackendClient, MAX_PHOTO_BYTES
from config import ConfigurationError, load_config
from keyboards import build_inline_keyboard

app = FastAPI(title="LOVECRAFT Telegram webhook", docs_url=None, redoc_url=None, openapi_url=None)
dispatcher = Dispatcher(disable_fsm=True)
log = logging.getLogger("lovecraft.telegram")
NO_PREVIEW = LinkPreviewOptions(is_disabled=True)
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def reply(status: int, **body):
    return JSONResponse(body, status_code=status, headers={"Cache-Control": "no-store"})


@app.get("/healthz")
async def health():
    try:
        load_config()
    except ConfigurationError:
        return reply(503, ok=False, service="lovecraft-telegram", configured=False)
    return reply(200, ok=True, service="lovecraft-telegram", configured=True)


class PhotoTooLarge(Exception):
    pass


class LimitedPhoto(io.BytesIO):
    def write(self, data):
        if self.tell() + len(data) > MAX_PHOTO_BYTES:
            raise PhotoTooLarge
        return super().write(data)


async def dismiss_old_panel(bot: Bot, chat_id: int, old: int | None, new: int):
    if old and old != new:
        try:
            await bot.delete_message(chat_id=chat_id, message_id=old, request_timeout=4)
        except TelegramAPIError:
            pass


async def show_view(bot: Bot, backend, chat_id: int, message_id: int | None, view: dict) -> int:
    keyboard = build_inline_keyboard(view.get("reply_markup", {}))
    text = str(view.get("text", ""))
    photo_url = view.get("photo_url") if view.get("mode") == "edit_media" else None
    if isinstance(photo_url, str) and photo_url:
        photo: str | BufferedInputFile | None = photo_url
        try:
            image_path = urlsplit(photo_url).path
            if image_path.startswith("/api/qr/image/"):
                photo = BufferedInputFile(await backend.qr_png(image_path), filename="lovecraft-qr.png")
        except (BackendError, ClientError, TimeoutError, ValueError):
            photo = None
        if photo is not None:
            try:
                if message_id:
                    await bot.edit_message_media(
                        chat_id=chat_id, message_id=message_id, reply_markup=keyboard,
                        media=InputMediaPhoto(media=photo, caption=text, parse_mode=ParseMode.HTML),
                    )
                    return message_id
            except TelegramBadRequest as error:
                if "message is not modified" in str(error).lower():
                    return message_id  # type: ignore[return-value]
            try:
                sent = await bot.send_photo(chat_id=chat_id, photo=photo, caption=text, parse_mode=ParseMode.HTML, reply_markup=keyboard)
                await dismiss_old_panel(bot, chat_id, message_id, sent.message_id)
                return sent.message_id
            except TelegramBadRequest:
                # Always deliver the link and buttons even if Telegram rejects media.
                pass
        if image_path_available(photo_url):
            text += f'\n\n<a href="{escape(photo_url, quote=True)}">فتح صورة بطاقة QR</a>'

    if message_id:
        try:
            await bot.edit_message_text(chat_id=chat_id, message_id=message_id, text=text,
                                        reply_markup=keyboard, parse_mode=ParseMode.HTML, link_preview_options=NO_PREVIEW)
            return message_id
        except TelegramBadRequest as error:
            if "message is not modified" in str(error).lower():
                return message_id
    sent = await bot.send_message(chat_id=chat_id, text=text, reply_markup=keyboard, parse_mode=ParseMode.HTML, link_preview_options=NO_PREVIEW)
    await dismiss_old_panel(bot, chat_id, message_id, sent.message_id)
    return sent.message_id


def image_path_available(url: str) -> bool:
    try:
        parsed = urlsplit(url)
        return parsed.scheme == "https" and bool(parsed.hostname) and parsed.path.startswith("/api/qr/image/")
    except ValueError:
        return False


async def process_update(message: Message | CallbackQuery, bot: Bot, backend, update_id: int):
    callback = message if isinstance(message, CallbackQuery) else None
    telegram_message = callback.message if callback else message
    if not isinstance(telegram_message, Message) or telegram_message.chat.type != "private":
        if callback:
            try:
                await bot.answer_callback_query(callback.id, request_timeout=4)
            except TelegramAPIError:
                pass
        return
    user = message.from_user
    if user is None or user.is_bot or user.id != telegram_message.chat.id:
        return
    chat_id = user.id
    claimed = await backend.delivery("claim", update_id, chat_id)
    status = claimed.get("status")
    if status == "busy":
        raise BackendError(409)
    if status not in {"claimed", "delivered"}:
        raise BackendError(502)

    async def acknowledge(note: str | None = None):
        if callback:
            try:
                await bot.answer_callback_query(callback.id, text=note, show_alert=bool(note), request_timeout=4)
            except TelegramAPIError:
                pass

    if status == "delivered":
        await acknowledge()
        return
    lease = claimed["lease"]
    panel = claimed.get("lastMessageId")
    finished = False
    try:
        if callback and panel and telegram_message.message_id != panel and not claimed.get("view"):
            await acknowledge("القائمة دي قديمة. استخدم آخر رسالة من البوت.")
            await backend.delivery("finish", update_id, chat_id, lease=lease, messageId=panel)
            finished = True
            return
        await acknowledge()
        view = claimed.get("view")
        if not view:
            fields = {"chat_id": chat_id, "first_name": user.first_name, "username": user.username, "last_name": user.last_name,
                      "update_id": update_id, "lease": lease}
            if callback:
                view = await backend.interact(**fields, action="callback", callbackData=(callback.data or "nav:main")[:120])
            elif telegram_message.photo or telegram_message.document:
                photo = telegram_message.photo[-1] if telegram_message.photo else telegram_message.document
                error_code = None
                upload = None
                try:
                    if photo.file_size and photo.file_size > MAX_PHOTO_BYTES:
                        raise PhotoTooLarge
                    if not telegram_message.photo and photo.mime_type not in ALLOWED_MIME:
                        raise ValueError
                    file = await bot.get_file(photo.file_id)
                    if not file.file_path:
                        raise ValueError
                    with LimitedPhoto() as buf:
                        await bot.download_file(file.file_path, destination=buf, timeout=10)
                        upload = await backend.upload_photo(chat_id, update_id, lease, buf.getvalue())
                except PhotoTooLarge:
                    error_code = "size"
                except BackendError as error:
                    if error.status == 401:
                        raise
                    error_code = "size" if error.status == 413 else "file" if error.status in (400, 415) else "storage"
                except (TelegramAPIError, ClientError, TimeoutError, ValueError):
                    error_code = "file"
                if error_code or not upload or not upload.get("ok"):
                    view = await backend.interact(**fields, action="photo_error", photoError=error_code or "storage")
                else:
                    view = await backend.interact(**fields, action="photo_uploaded", uploadedAsset={"assetId": upload["assetId"], "url": upload["url"]})
            else:
                text = (telegram_message.text or "").strip()
                parts = text.split(maxsplit=1)
                if parts and parts[0].split("@", 1)[0].lower() == "/start":
                    view = await backend.interact(**fields, action="start", startPayload=parts[1][:120] if len(parts) > 1 else None)
                else:
                    view = await backend.interact(**fields, action="text", textInput=text[:2200])
        active_panel = panel or (telegram_message.message_id if callback else None)
        sent = await show_view(bot, backend, chat_id, active_panel, view)
        await backend.delivery("finish", update_id, chat_id, lease=lease, messageId=sent)
        finished = True
    finally:
        if not finished:
            # Fast failures can retry immediately; a killed function is recovered by lease expiry.
            try:
                await asyncio.wait_for(backend.delivery("release", update_id, chat_id, lease=lease), timeout=3)
            except (BackendError, ClientError, TimeoutError):
                pass


@dispatcher.callback_query(F.message)
async def handle_callback(callback: CallbackQuery, bot: Bot, backend, telegram_update_id: int):
    await process_update(callback, bot, backend, telegram_update_id)


@dispatcher.message(F.text | F.photo | F.document)
async def handle_message(message: Message, bot: Bot, backend, telegram_update_id: int):
    await process_update(message, bot, backend, telegram_update_id)


@app.post("/webhook")
async def webhook(request: Request):
    try:
        config = load_config()
    except ConfigurationError:
        return reply(503, ok=False)
    incoming = request.headers.get("x-telegram-bot-api-secret-token", "")
    if len(incoming) > 256 or not hmac.compare_digest(incoming.encode(), config.webhook_secret.encode()):
        return reply(403, ok=False)
    if request.headers.get("content-type", "").partition(";")[0].strip().lower() != "application/json":
        return reply(415, ok=False)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 96 * 1024:
            return reply(413, ok=False)
    try:
        parsed = json.loads(body)
        update_id = parsed.get("update_id") if isinstance(parsed, dict) else None
        if type(update_id) is not int or not 0 < update_id <= 9_999_999_999_999:
            return reply(400, ok=False)
        bot = Bot(config.telegram_bot_token, session=AiohttpSession(timeout=12))
        async with bot.context(), LovecraftBackendClient(config.backend_api_url, config.bot_api_secret) as backend:
            async with asyncio.timeout(50):
                update = Update.model_validate(parsed, context={"bot": bot})
                await dispatcher.feed_update(bot, update, backend=backend, telegram_update_id=update_id)
    except (ValueError, ValidationError):
        return reply(400, ok=False)
    except (BackendError, TelegramAPIError, ClientError, TimeoutError) as error:
        # Telegram and aiohttp exceptions may contain token-bearing URLs; log only the class.
        log.warning("Webhook delivery deferred (%s)", type(error).__name__)
        return reply(503, ok=False)
    except Exception as error:
        log.error("Webhook delivery failed (%s)", type(error).__name__)
        return reply(500, ok=False)
    return reply(200, ok=True)
