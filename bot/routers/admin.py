from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.repositories.admin_user import AdminUserRepository
from est13_core.db.repositories.lead import LeadRepository
from bot.services.texts import Texts

router = Router(name="admin")


async def _is_admin(message: Message, db: AsyncSession) -> bool:
    if message.from_user is None:
        return False
    admin_ids = await AdminUserRepository(db).list_active_tg_ids()
    return message.from_user.id in admin_ids


@router.message(Command("admin"))
async def admin_cmd(message: Message, db: AsyncSession) -> None:
    texts = Texts(db)
    if not await _is_admin(message, db):
        return

    rows = await LeadRepository(db).list_recent(limit=10)
    if not rows:
        await message.answer(await texts.t("admin_no_leads", "Заявок поки немає."))
        return

    lines = [await texts.t("admin_recent_leads", "Останні заявки:")]
    for lead_id, service_title, tg_id, status in rows:
        lines.append(f"#{lead_id} — {service_title} — tg:{tg_id} — {status}")
    await message.answer("\n".join(lines))
