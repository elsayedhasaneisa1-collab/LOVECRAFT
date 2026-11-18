"""ASGI integration tests. No deployment credentials or real Telegram messages are used."""
import os
import unittest
from unittest.mock import patch

from aiogram.exceptions import TelegramBadRequest
from aiogram.types import BufferedInputFile
from httpx import ASGITransport, AsyncClient

from main import app


ENV = {
    "TELEGRAM_BOT_TOKEN": "10001:" + "T" * 32,
    "TELEGRAM_WEBHOOK_SECRET": "W" * 48,
    "BOT_API_SECRET": "S" * 48,
    "BACKEND_API_URL": "https://lovecraft-site.example",
}
HEADERS = {"X-Telegram-Bot-Api-Secret-Token": ENV["TELEGRAM_WEBHOOK_SECRET"]}
CHAT = {"id": 321, "type": "private"}
SENDER = {"id": 321, "is_bot": False, "first_name": "Noor"}
PANEL = {"message_id": 77, "date": 1750000000, "chat": CHAT, "text": "Menu"}


def text_update(identifier, text="/start"):
    return {"update_id": identifier, "message": {"message_id": 333, "date": 1750000000,
                                                "chat": CHAT, "from": SENDER, "text": text}}


def callback_update(identifier, data="qr:site:1"):
    return {"update_id": identifier, "callback_query": {"id": "abc123", "chat_instance": "private-chat", "from": SENDER,
                                                        "data": data, "message": PANEL}}


def photo_update(identifier, size):
    return {"update_id": identifier, "message": {"message_id": 334, "date": 1750000000, "chat": CHAT, "from": SENDER,
        "photo": [{"file_id": "fixture-photo", "file_unique_id": "fixture-photo-unique", "width": 400, "height": 400, "file_size": size}]}}


class DeliveryBackend:
    deliveries = {}
    menu_calls = []
    png_requests = []

    def __init__(self, *_):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass

    async def delivery(self, action, update_id, chat_id, **fields):
        self.assert_private(chat_id)
        if action == "claim":
            entry = self.deliveries.setdefault(update_id, {})
            if entry.get("done"):
                return {"status": "delivered"}
            return {"status": "claimed", "lease": "fixture-lease", "lastMessageId": 77, "view": entry.get("view")}
        if action == "finish":
            self.deliveries[update_id]["done"] = True
            self.deliveries[update_id]["message"] = fields["messageId"]
        if action == "release":
            self.deliveries[update_id]["released"] = True
        return {"ok": True}

    @staticmethod
    def assert_private(value):
        assert value == 321

    async def interact(self, **fields):
        self.menu_calls.append(fields)
        view = {"mode": "edit_text", "parse_mode": "HTML", "text": "<b>أهلا</b>",
                "reply_markup": {"inline_keyboard": [[{"text": "القوالب", "callback_data": "nav:browse"}]]}}
        if fields['action'] == 'callback':
            view.update(mode="edit_media", photo_url="https://lovecraft-site.example/api/qr/image/fixture.png", text="https://lovecraft-site.example/s/my-site")
        self.deliveries[fields['update_id']]["view"] = view
        return view

    async def qr_png(self, path):
        self.png_requests.append(path)
        return b"\x89PNG\r\n\x1a\nfixture-png"


class WebhookTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        DeliveryBackend.deliveries.clear()
        DeliveryBackend.menu_calls.clear()
        DeliveryBackend.png_requests.clear()
        self.requests = []
        self.reject_media_edit = False
        self.fail_next_text = False
        self.env = patch.dict(os.environ, ENV, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        api = patch('main.LovecraftBackendClient', DeliveryBackend)
        api.start()
        self.addCleanup(api.stop)

        async def fake_bot_request(bot, method, **_):
            name = method.__api_method__
            self.requests.append((name, method))
            if name == "editMessageMedia" and self.reject_media_edit:
                raise TelegramBadRequest(method=method, message="message can't be edited")
            if name == "editMessageText" and self.fail_next_text:
                self.fail_next_text = False
                raise TimeoutError
            if name == "sendPhoto":
                from aiogram.types import Message
                return Message.model_validate({**PANEL, 'message_id': 78})
            # The handler only needs returned message IDs on new messages.
            return True

        tg = patch('aiogram.Bot.__call__', new=fake_bot_request)
        tg.start()
        self.addCleanup(tg.stop)
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test.local")
        self.addAsyncCleanup(self.client.aclose)

    async def test_health_and_reject_secret_mismatch(self):
        self.assertEqual((await self.client.get('/healthz')).status_code, 200)
        self.assertEqual((await self.client.post('/webhook', json=text_update(1))).status_code, 403)
        self.assertEqual((await self.client.post('/webhook', json={}, headers=HEADERS)).status_code, 400)
        self.assertEqual((await self.client.post('/webhook', content=b'x' * 100000, headers={**HEADERS, 'Content-Type': 'application/json'})).status_code, 413)
        self.assertEqual(self.requests, [])
        del os.environ['BOT_API_SECRET']
        self.assertEqual((await self.client.get('/healthz')).status_code, 503)

    async def test_start_and_repeat(self):
        update = text_update(2, '/start@LoveCraftMakerBot advance_code')
        for _ in range(2):
            self.assertEqual((await self.client.post('/webhook', json=update, headers=HEADERS)).status_code, 200)
        self.assertEqual(len(DeliveryBackend.menu_calls), 1)
        self.assertEqual(DeliveryBackend.menu_calls[0]['action'], 'start')
        self.assertEqual(DeliveryBackend.menu_calls[0]['startPayload'], 'advance_code')
        requests = [item for name, item in self.requests if name == 'editMessageText']
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].reply_markup.inline_keyboard[0][0].callback_data, 'nav:browse')
        self.assertEqual(DeliveryBackend.deliveries[2]['message'], 77)

    async def test_qr_uses_bytes_and_falls_back_to_send_photo(self):
        self.reject_media_edit = True
        res = await self.client.post('/webhook', headers=HEADERS, json=callback_update(3))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(DeliveryBackend.png_requests, ['/api/qr/image/fixture.png'])
        methods = [name for name, _ in self.requests]
        self.assertEqual(methods, ['answerCallbackQuery', 'editMessageMedia', 'sendPhoto', 'deleteMessage'])
        sent = self.requests[2][1]
        self.assertIsInstance(sent.photo, BufferedInputFile)
        self.assertTrue(sent.photo.data.startswith(b'\x89PNG'))
        self.assertIn('/s/my-site', sent.caption)
        self.assertEqual(DeliveryBackend.deliveries[3]['message'], 78)

    async def test_retry_resumes_persisted_view_after_transport_failure(self):
        self.fail_next_text = True
        update = text_update(5, 'موقع جديد')
        self.assertEqual((await self.client.post('/webhook', headers=HEADERS, json=update)).status_code, 503)
        self.assertTrue(DeliveryBackend.deliveries[5]['released'])
        self.assertEqual((await self.client.post('/webhook', headers=HEADERS, json=update)).status_code, 200)
        self.assertEqual(len(DeliveryBackend.menu_calls), 1)
        self.assertTrue(DeliveryBackend.deliveries[5]['done'])

    async def test_large_photo_preserves_wizard_without_download(self):
        res = await self.client.post('/webhook', headers=HEADERS, json=photo_update(6, 4 * 1024 * 1024 + 1))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(DeliveryBackend.menu_calls[0]['photoError'], 'size')
        self.assertEqual([name for name, _ in self.requests], ['editMessageText'])

    async def test_group_does_not_create_private_session(self):
        update = text_update(7)
        update['message']['chat'] = {'id': -555, 'type': 'group'}
        self.assertEqual((await self.client.post('/webhook', headers=HEADERS, json=update)).status_code, 200)
        self.assertEqual(DeliveryBackend.deliveries, {})
        self.assertEqual(self.requests, [])


if __name__ == '__main__':
    unittest.main()
