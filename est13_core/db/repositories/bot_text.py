from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.bot_text import BotText


class BotTextRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_obj(self, key: str) -> BotText | None:
        result = await self._session.execute(select(BotText).where(BotText.key == key))
        return result.scalar_one_or_none()

    async def get(self, key: str) -> str | None:
        obj = await self.get_obj(key)
        return obj.value if obj else None

    async def set(self, key: str, value: str) -> None:
        obj = await self.get_obj(key)
        if obj is None:
            self._session.add(BotText(key=key, value=value))
        else:
            obj.value = value

    async def ensure_default(self, key: str, value: str) -> None:
        result = await self._session.execute(
            select(BotText.key).where(BotText.key == key)
        )
        if result.first() is None:
            self._session.add(BotText(key=key, value=value))
