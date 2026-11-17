"""
LOVECRAFT BOT — Secured Async Backend Client
Communicates with the LOVECRAFT Next.js Multi-Tenant Backend API.
"""
from typing import Any, Dict, Optional
import uuid
import aiohttp


class LovecraftBackendClient:
    def __init__(self, base_url: str, api_secret: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_secret = api_secret
        self._session: Optional[aiohttp.ClientSession] = None

    async def start(self) -> None:
        timeout = aiohttp.ClientTimeout(total=25)
        self._session = aiohttp.ClientSession(
            timeout=timeout,
            headers={
                "X-Bot-Secret": self._api_secret,
                "User-Agent": "LOVECRAFT-AIOGRAM-BOT/1.0",
            },
        )

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def interact(
        self,
        *,
        telegram_user_id: int,
        telegram_chat_id: int,
        first_name: str,
        last_name: Optional[str],
        username: Optional[str],
        action_type: str,
        start_payload: Optional[str] = None,
        callback_data: Optional[str] = None,
        text_input: Optional[str] = None,
        uploaded_asset: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        assert self._session is not None, "Client session not initialized"
        payload: Dict[str, Any] = {
            "telegramUserId": telegram_user_id,
            "telegramChatId": telegram_chat_id,
            "firstName": first_name,
            "lastName": last_name,
            "username": username,
            "actionType": action_type,
            "startPayload": start_payload,
            "callbackData": callback_data,
            "textInput": text_input,
            "uploadedAsset": uploaded_asset,
        }
        headers = {"Idempotency-Key": str(uuid.uuid4())}
        async with self._session.post(
            f"{self._base_url}/api/bot/engine", json=payload, headers=headers
        ) as resp:
            data = await resp.json()
            if resp.status >= 400:
                raise RuntimeError(data.get("error", f"Backend error {resp.status}"))
            return data

    async def upload_photo_catbox(
        self,
        *,
        telegram_user_id: int,
        telegram_chat_id: int,
        first_name: str,
        image_bytes: bytes,
        filename: str = "telegram_photo.jpg",
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        assert self._session is not None, "Client session not initialized"
        form = aiohttp.FormData()
        form.add_field("telegramUserId", str(telegram_user_id))
        form.add_field("telegramChatId", str(telegram_chat_id))
        form.add_field("firstName", first_name)
        form.add_field(
            "file",
            image_bytes,
            filename=filename,
            content_type=mime_type,
        )
        async with self._session.post(
            f"{self._base_url}/api/upload/catbox", data=form
        ) as resp:
            return await resp.json()
