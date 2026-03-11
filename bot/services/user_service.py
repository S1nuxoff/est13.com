from __future__ import annotations

from aiogram import Bot
from aiogram.types import User as TgUser

from est13_core.db.repositories.user import UserRepository


class UserService:
    def __init__(self, users: UserRepository):
        self._users = users

    async def upsert_from_telegram_user(
        self,
        tg_user: TgUser | None,
        *,
        chat_id: int | None = None,
    ):
        if tg_user is None:
            return None
        return await self._users.upsert(
            tg_id=tg_user.id,
            username=tg_user.username,
            first_name=tg_user.first_name,
            last_name=tg_user.last_name,
            language_code=getattr(tg_user, "language_code", None),
            last_chat_id=chat_id,
        )

    async def try_update_avatar(
        self, bot: Bot, *, user_tg_id: int
    ) -> tuple[str | None, str | None]:
        try:
            photos = await bot.get_user_profile_photos(user_tg_id, limit=1)
            if not photos.photos:
                return None, None
            # Take the largest size from the first photo set
            best = max(photos.photos[0], key=lambda p: (p.width or 0) * (p.height or 0))
            return best.file_id, best.file_unique_id
        except Exception:
            return None, None
