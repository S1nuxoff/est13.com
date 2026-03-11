from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.admin_user import AdminUser
from est13_core.db.models.enums import AdminRole


class AdminUserRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_active_tg_ids(self) -> list[int]:
        result = await self._session.execute(
            select(AdminUser.tg_id).where(AdminUser.is_active.is_(True))
        )
        return [row[0] for row in result.all()]

    async def ensure_admins(
        self, tg_ids: list[int], role: AdminRole = AdminRole.admin
    ) -> None:
        if not tg_ids:
            return
        result = await self._session.execute(
            select(AdminUser).where(AdminUser.tg_id.in_(tg_ids))
        )
        existing = {a.tg_id for a in result.scalars().all()}
        for tg_id in tg_ids:
            if tg_id in existing:
                continue
            self._session.add(AdminUser(tg_id=tg_id, role=role, is_active=True))
