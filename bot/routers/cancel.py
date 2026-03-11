from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.enums import LeadStatus
from est13_core.db.repositories.lead import LeadRepository
from bot.services.texts import Texts

router = Router(name="cancel")


@router.message(Command("cancel"))
async def cancel_cmd(message: Message, db: AsyncSession, state: FSMContext) -> None:
    texts = Texts(db)
    data = await state.get_data()
    lead_id = data.get("lead_id")
    if isinstance(lead_id, int):
        await LeadRepository(db).set_status(lead_id, LeadStatus.abandoned)
    await state.clear()
    await message.answer(
        await texts.t(
            "cancel_cmd_done", "Ок, скасовано. Натисніть /start щоб почати заново."
        )
    )
