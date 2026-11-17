"""
LOVECRAFT BOT — Production Telegram Bot (Python + aiogram 3)
Your Moments. Your Website.

Rules enforced:
- End-users ONLY (zero admin/owner commands inside Telegram Bot).
- Strictly InlineKeyboardMarkup ONLY (no ReplyKeyboardMarkup anywhere).
- Edits existing messages in place (edit_text / edit_media) to avoid chat clutter.
- Uploads photos to Catbox via secured backend API (stores URL only).
- Supports both continuous Polling and Webhook deployment modes.
"""
import asyncio
import io
import logging
from typing import Any, Dict, Optional

from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import (
    CallbackQuery,
    InputMediaPhoto,
    Message,
)
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

from config import load_config
from api_client import LovecraftBackendClient
from keyboards import build_inline_keyboard

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("lovecraft.bot")

router = Router(name="lovecraft_user_router")

# Tracks each chat's active panel message ID so text/photo steps edit in place
_active_panel_message: Dict[int, int] = {}

MAX_PHOTO_BYTES = 8 * 1024 * 1024  # 8 MB


async def render_response_on_callback(cb: CallbackQuery, view: Dict[str, Any]) -> None:
    """Updates current bot message via edit_media or edit_text with InlineKeyboardMarkup."""
    if not cb.message or not isinstance(cb.message, Message):
        await cb.answer()
        return

    kb = build_inline_keyboard(view.get("reply_markup", {}))
    text = str(view.get("text", ""))
    mode = view.get("mode", "edit_text")
    photo_url = view.get("photo_url")

    try:
        if mode == "edit_media" and photo_url:
            media = InputMediaPhoto(media=photo_url, caption=text, parse_mode=ParseMode.HTML)
            await cb.message.edit_media(media=media, reply_markup=kb)
        elif cb.message.photo:
            # Transitioning from a media preview card back to a text menu cleanly
            await cb.message.delete()
            sent = await cb.message.answer(text=text, reply_markup=kb, parse_mode=ParseMode.HTML)
            _active_panel_message[cb.message.chat.id] = sent.message_id
        else:
            await cb.message.edit_text(
                text=text,
                reply_markup=kb,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            _active_panel_message[cb.message.chat.id] = cb.message.message_id
    except TelegramBadRequest as exc:
        if "message is not modified" not in str(exc).lower():
            sent = await cb.message.answer(
                text=text,
                reply_markup=kb,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            _active_panel_message[cb.message.chat.id] = sent.message_id

    toast = view.get("callback_toast")
    await cb.answer(text=toast if toast else None)


async def render_response_on_message(bot: Bot, msg: Message, view: Dict[str, Any]) -> None:
    """Edits the existing active panel message when possible instead of spamming new messages."""
    kb = build_inline_keyboard(view.get("reply_markup", {}))
    text = str(view.get("text", ""))
    chat_id = msg.chat.id
    prev_id: Optional[int] = _active_panel_message.get(chat_id)

    # Gently remove user's wizard input message when allowed to keep single-panel UX clean
    if msg.text and not msg.text.startswith("/start"):
        try:
            await msg.delete()
        except TelegramBadRequest:
            pass

    if prev_id:
        try:
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=prev_id,
                text=text,
                reply_markup=kb,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            return
        except TelegramBadRequest:
            pass

    sent = await msg.answer(
        text=text,
        reply_markup=kb,
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    _active_panel_message[chat_id] = sent.message_id


@router.message(CommandStart())
async def handle_start(
    message: Message, command: CommandObject, backend: LovecraftBackendClient, bot: Bot
) -> None:
    if not message.from_user:
        return
    view = await backend.interact(
        telegram_user_id=message.from_user.id,
        telegram_chat_id=message.chat.id,
        first_name=message.from_user.first_name or "مستخدم",
        last_name=message.from_user.last_name,
        username=message.from_user.username,
        action_type="start",
        start_payload=command.args,
    )
    sent = await message.answer(
        text=view["text"],
        reply_markup=build_inline_keyboard(view.get("reply_markup", {})),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=True,
    )
    _active_panel_message[message.chat.id] = sent.message_id


@router.callback_query()
async def handle_callback(callback: CallbackQuery, backend: LovecraftBackendClient) -> None:
    if not callback.from_user or not callback.message:
        await callback.answer()
        return
    try:
        view = await backend.interact(
            telegram_user_id=callback.from_user.id,
            telegram_chat_id=callback.message.chat.id,
            first_name=callback.from_user.first_name or "مستخدم",
            last_name=callback.from_user.last_name,
            username=callback.from_user.username,
            action_type="callback",
            callback_data=callback.data or "nav:main",
        )
        await render_response_on_callback(callback, view)
    except Exception as exc:
        logger.exception("Callback processing failed: %s", exc)
        await callback.answer("حدث خطأ مؤقت، يرجى المحاولة مرة أخرى.", show_alert=True)


@router.message(F.photo)
async def handle_photo_upload(
    message: Message, backend: LovecraftBackendClient, bot: Bot
) -> None:
    if not message.from_user or not message.photo:
        return

    largest = message.photo[-1]
    if largest.file_size and largest.file_size > MAX_PHOTO_BYTES:
        await render_response_on_message(
            bot,
            message,
            {
                "text": "⚠️ <b>حجم الصورة كبير جداً</b>\nالحد الأقصى المسموح هو 8 ميجابايت.",
                "reply_markup": {
                    "inline_keyboard": [[{"text": "⏭️ متابعة بدون الصورة", "callback_data": "wiz:colors"}]]
                },
            },
        )
        return

    buf = io.BytesIO()
    await bot.download(largest, destination=buf)
    image_bytes = buf.getvalue()

    upload_res = await backend.upload_photo_catbox(
        telegram_user_id=message.from_user.id,
        telegram_chat_id=message.chat.id,
        first_name=message.from_user.first_name or "مستخدم",
        image_bytes=image_bytes,
    )

    if not upload_res.get("ok"):
        err_msg = upload_res.get("error", "تعذر رفع الصورة إلى Catbox حالياً.")
        await render_response_on_message(
            bot,
            message,
            {
                "text": f"⚠️ <b>فشل رفع الصورة</b>\n\n{err_msg}",
                "reply_markup": {
                    "inline_keyboard": [
                        [{"text": "⏭️ المتابعة إلى الألوان ▶️", "callback_data": "wiz:colors"}],
                        [{"text": "🏠 الرئيسية", "callback_data": "nav:main"}],
                    ]
                },
            },
        )
        return

    view = await backend.interact(
        telegram_user_id=message.from_user.id,
        telegram_chat_id=message.chat.id,
        first_name=message.from_user.first_name or "مستخدم",
        last_name=message.from_user.last_name,
        username=message.from_user.username,
        action_type="photo_uploaded",
        uploaded_asset={"assetId": upload_res["assetId"], "url": upload_res["url"]},
    )
    await render_response_on_message(bot, message, view)


@router.message(F.text)
async def handle_text_input(
    message: Message, backend: LovecraftBackendClient, bot: Bot
) -> None:
    if not message.from_user or not message.text:
        return
    view = await backend.interact(
        telegram_user_id=message.from_user.id,
        telegram_chat_id=message.chat.id,
        first_name=message.from_user.first_name or "مستخدم",
        last_name=message.from_user.last_name,
        username=message.from_user.username,
        action_type="text",
        text_input=message.text,
    )
    await render_response_on_message(bot, message, view)


async def main() -> None:
    cfg = load_config()
    backend = LovecraftBackendClient(cfg.backend_api_url, cfg.bot_api_secret)
    await backend.start()

    bot = Bot(
        token=cfg.telegram_bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp["backend"] = backend
    dp.include_router(router)

    if cfg.run_mode == "webhook" and cfg.webhook_base_url:
        webhook_url = f"{cfg.webhook_base_url}{cfg.webhook_path}"
        await bot.set_webhook(
            url=webhook_url,
            secret_token=cfg.webhook_secret or None,
            drop_pending_updates=True,
        )
        app = web.Application()
        handler = SimpleRequestHandler(
            dispatcher=dp,
            bot=bot,
            secret_token=cfg.webhook_secret or None,
        )
        handler.register(app, path=cfg.webhook_path)
        setup_application(app, dp, bot=bot)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host=cfg.webhook_host, port=cfg.webhook_port)
        logger.info("LOVECRAFT BOT running in WEBHOOK mode at %s", webhook_url)
        await site.start()
        try:
            await asyncio.Event().wait()
        finally:
            await backend.close()
            await bot.session.close()
    else:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("LOVECRAFT BOT running in POLLING mode")
        try:
            await dp.start_polling(bot)
        finally:
            await backend.close()
            await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
