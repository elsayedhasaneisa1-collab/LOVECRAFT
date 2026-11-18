"""
LOVECRAFT BOT — Inline Keyboard Builder (STRICT: InlineKeyboardMarkup ONLY)
ReplyKeyboardMarkup is completely prohibited across the entire bot.
"""
from typing import Any, Dict, List
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def build_inline_keyboard(markup_dict: Dict[str, Any]) -> InlineKeyboardMarkup:
    raw_rows: List[List[Dict[str, Any]]] = markup_dict.get("inline_keyboard", [])
    rows: List[List[InlineKeyboardButton]] = []

    for raw_row in raw_rows:
        btn_row: List[InlineKeyboardButton] = []
        for item in raw_row:
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            if item.get("url"):
                btn_row.append(InlineKeyboardButton(text=text, url=str(item["url"])))
            elif item.get("switch_inline_query") is not None:
                btn_row.append(
                    InlineKeyboardButton(
                        text=text,
                        switch_inline_query=str(item["switch_inline_query"]),
                    )
                )
            elif item.get("callback_data"):
                btn_row.append(
                    InlineKeyboardButton(
                        text=text,
                        callback_data=str(item["callback_data"])[:64],
                    )
                )
        if btn_row:
            rows.append(btn_row)

    if not rows:
        rows.append([InlineKeyboardButton(text="🏠 القائمة الرئيسية", callback_data="nav:main")])

    return InlineKeyboardMarkup(inline_keyboard=rows)
