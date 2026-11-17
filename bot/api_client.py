"""Requests to the Vercel-hosted Next.js backend; the bot does not connect to Postgres."""
from typing import Any
import re

import aiohttp


MAX_PHOTO_BYTES = 4 * 1024 * 1024
MAX_QR_BYTES = 1024 * 1024


class BackendError(Exception):
    def __init__(self, status: int, code: str = ""):
        super().__init__("Backend request failed")
        self.status = status
        self.code = code


class LovecraftBackendClient:
    def __init__(self, base_url: str, api_secret: str):
        self._base_url = base_url
        self._secret = api_secret
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=16, connect=4))
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def _post(self, path: str, *, payload: dict | None = None, form: aiohttp.FormData | None = None) -> dict:
        assert self._session is not None
        async with self._session.post(
            self._base_url + path, headers={"X-Bot-Secret": self._secret}, json=payload, data=form,
            allow_redirects=False,
        ) as res:
            try:
                data = await res.json()
            except (ValueError, aiohttp.ContentTypeError):
                raise BackendError(res.status) from None
            if res.status != 200 or not isinstance(data, dict):
                raise BackendError(res.status, data.get("code", "") if isinstance(data, dict) else "")
            return data

    async def delivery(self, action: str, update_id: int, chat_id: int, **fields: Any) -> dict:
        return await self._post("/api/bot/delivery", payload={"action": action, "updateId": update_id, "chatId": chat_id, **fields})

    async def interact(self, *, chat_id: int, first_name: str, username: str | None, last_name: str | None,
                       update_id: int, lease: str, action: str, **fields: Any) -> dict:
        return await self._post("/api/bot/engine", payload={
            "telegramUserId": chat_id, "telegramChatId": chat_id, "firstName": first_name[:100] or "مستخدم",
            "username": username[:64] if username else None, "lastName": last_name[:100] if last_name else None,
            "actionType": action, "delivery": {"updateId": update_id, "lease": lease}, **fields,
        })

    async def upload_photo(self, chat_id: int, update_id: int, lease: str, image: bytes) -> dict:
        form = aiohttp.FormData()
        form.add_field("telegramUserId", str(chat_id))
        form.add_field("updateId", str(update_id))
        form.add_field("lease", lease)
        form.add_field("file", image, filename="telegram.jpg", content_type="application/octet-stream")
        return await self._post("/api/upload/photo", form=form)

    async def qr_png(self, path: str) -> bytes:
        # Fetch a signed card only from our configured web project, never a caller-provided host.
        if not re.fullmatch(r"/api/qr/image/[A-Za-z0-9_.-]{35,900}", path):
            raise BackendError(400)
        assert self._session is not None
        async with self._session.get(self._base_url + path, allow_redirects=False) as res:
            if res.status != 200 or res.content_type != "image/png":
                raise BackendError(res.status)
            if (res.content_length or 0) > MAX_QR_BYTES:
                raise BackendError(413)
            content = bytearray()
            async for chunk in res.content.iter_chunked(65536):
                content.extend(chunk)
                if len(content) > MAX_QR_BYTES:
                    raise BackendError(413)
            return bytes(content)
