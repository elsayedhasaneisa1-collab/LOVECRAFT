"""
LOVECRAFT BOT — Secure Environment Configuration
All secrets are loaded strictly from environment variables.
Never hardcode tokens or commit .env files.
"""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class BotConfig:
    telegram_bot_token: str
    backend_api_url: str
    bot_api_secret: str
    run_mode: str  # "polling" or "webhook"
    webhook_base_url: str
    webhook_path: str
    webhook_secret: str
    webhook_host: str
    webhook_port: int


def load_config() -> BotConfig:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN environment variable is required.")

    backend_url = os.getenv("BACKEND_API_URL", os.getenv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000")).rstrip("/")
    bot_secret = os.getenv("BOT_API_SECRET", "").strip()
    if not bot_secret:
        raise RuntimeError("BOT_API_SECRET environment variable is required.")

    return BotConfig(
        telegram_bot_token=token,
        backend_api_url=backend_url,
        bot_api_secret=bot_secret,
        run_mode=os.getenv("BOT_RUN_MODE", "polling").strip().lower(),
        webhook_base_url=os.getenv("BOT_WEBHOOK_BASE_URL", "").rstrip("/"),
        webhook_path=os.getenv("BOT_WEBHOOK_PATH", "/tg/webhook"),
        webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip(),
        webhook_host=os.getenv("BOT_WEBHOOK_HOST", "0.0.0.0"),
        webhook_port=int(os.getenv("BOT_WEBHOOK_PORT", "8081")),
    )
