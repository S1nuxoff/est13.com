from __future__ import annotations

import mimetypes
from datetime import datetime, timezone
from io import BytesIO

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from est13_core.config import get_settings
from est13_core.db.models.enums import LeadStatus
from est13_core.db.models.lead import Lead
from est13_core.db.models.service import Service
from est13_core.db.models.user import User


def build_bot() -> Bot:
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN is not set")
    return Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


USER_STATUS_LABELS: dict[str, str] = {
    "in_review": "На перевірці",
    "confirmed": "Підтверджено",
    "in_work": "В роботі",
    "paused": "Пауза",
    "done": "Завершено",
    "delivered": "Передано клієнту",
    "client_not_confirmed": "Клієнт не підтвердив",
    "rejected": "Відхилено",
    "lost": "Втрачено",
    "studio_cancelled": "Скасовано (студія)",
    "closed": "Закрито",
}


async def notify_user_lead_stage(
    db: AsyncSession, *, lead: Lead, reason: str | None = None
) -> None:
    status_value = getattr(lead.status, "value", str(lead.status))
    if status_value in ("filling", "abandoned", "awaiting_review"):
        return

    user = await db.get(User, int(lead.user_id))
    service = await db.get(Service, int(lead.service_id))
    if user is None:
        return

    chat_id = getattr(user, "last_chat_id", None) or int(user.tg_id)
    stage = USER_STATUS_LABELS.get(status_value, status_value)
    svc_title = service.title if service else ""

    text = (
        f"🧩 <b>Оновлення по вашому проєкту</b>\n\n"
        f"Заявка №<b>{lead.id}</b> ({svc_title})\n"
        f"Етап: <b>{stage}</b>"
    )
    if reason:
        text += f"\n\n{reason}"
    text += "\n\n📋 Переглянути: /my"

    kb = None
    if lead.status == LeadStatus.delivered:
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="✅ Підтверджую", callback_data=f"lead:client_ok:{lead.id}"
                    )
                ],
                [
                    InlineKeyboardButton(
                        text="✍️ Потрібні правки",
                        callback_data=f"lead:client_changes:{lead.id}",
                    )
                ],
            ]
        )

    bot = build_bot()
    try:
        await bot.send_message(chat_id=chat_id, text=text, reply_markup=kb)
    finally:
        await bot.session.close()


async def fetch_telegram_file_bytes(file_id: str) -> tuple[bytes, str]:
    bot = build_bot()
    try:
        tg_file = await bot.get_file(file_id)
        buf = BytesIO()
        await bot.download(tg_file, destination=buf)
        content = buf.getvalue()
        media_type = (
            mimetypes.guess_type(tg_file.file_path or "")[0]
            or "application/octet-stream"
        )
        return content, media_type
    finally:
        await bot.session.close()
