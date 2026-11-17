"""Read the Python Vercel project's server-side secrets without logging values."""
from dataclasses import dataclass, field
import os
import re
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv(override=False)


class ConfigurationError(Exception):
    pass


@dataclass(frozen=True)
class BotConfig:
    telegram_bot_token: str = field(repr=False)
    bot_api_secret: str = field(repr=False)
    webhook_secret: str = field(repr=False)
    backend_api_url: str


def load_config() -> BotConfig:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    backend_secret = os.getenv("BOT_API_SECRET", "").strip()
    webhook_secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]{20,100}", token):
        raise ConfigurationError("TELEGRAM_BOT_TOKEN is missing or malformed")
    if len(backend_secret) < 32:
        raise ConfigurationError("BOT_API_SECRET must be at least 32 characters")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", webhook_secret):
        raise ConfigurationError("TELEGRAM_WEBHOOK_SECRET must be URL-safe, 32 to 256 characters")
    raw_origin = os.getenv("BACKEND_API_URL", "").strip().rstrip("/")
    try:
        parts = urlsplit(raw_origin)
        local = not os.getenv("VERCEL") and parts.hostname in {"localhost", "127.0.0.1", "::1"}
        if (not parts.hostname or parts.username or parts.password or parts.path or parts.query or parts.fragment
                or not (parts.scheme == "https" or (local and parts.scheme == "http"))):
            raise ValueError
    except ValueError:
        raise ConfigurationError("BACKEND_API_URL must be the production HTTPS origin of the Next.js project") from None
    return BotConfig(token, backend_secret, webhook_secret, raw_origin)
