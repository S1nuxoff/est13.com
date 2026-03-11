from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_tg_id(self, tg_id: int) -> User | None:
        result = await self._session.execute(select(User).where(User.tg_id == tg_id))
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        tg_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
        language_code: str | None = None,
        last_chat_id: int | None = None,
    ) -> User:
        user = await self.get_by_tg_id(tg_id)
        if user is None:
            user = User(tg_id=tg_id)
            self._session.add(user)

        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        user.language_code = language_code
        if last_chat_id is not None:
            user.last_chat_id = last_chat_id
        user.updated_at = datetime.utcnow()
        return user

    async def auto_disable_support_if_expired(self, user: User) -> bool:
        if not bool(getattr(user, "support_enabled", False)):
            return False
        until = getattr(user, "support_enabled_until", None)
        if until is None:
            return False
        now = datetime.now(timezone.utc)
        if until > now:
            return False

        user.support_enabled = False
        user.support_enabled_at = None
        user.support_enabled_until = None
        user.support_admin_id = None
        user.updated_at = datetime.utcnow()
        await self._session.flush()
        return True
