from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bot.services.texts import Texts

router = Router(name="health")


@router.message(Command("health"))
async def health_cmd(message: Message, db: AsyncSession) -> None:
    texts = Texts(db)
    await db.execute(text("SELECT 1"))
    await message.answer(await texts.t("health_ok", "OK"))
