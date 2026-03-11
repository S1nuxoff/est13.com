from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.service import Service


class ServiceRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_active(self) -> list[Service]:
        result = await self._session.execute(
            select(Service)
            .where(Service.is_active.is_(True))
            .order_by(Service.sort, Service.id)
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Service]:
        result = await self._session.execute(
            select(Service).order_by(Service.sort, Service.id)
        )
        return list(result.scalars().all())

    async def get(self, service_id: int) -> Service | None:
        result = await self._session.execute(
            select(Service).where(Service.id == service_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Service | None:
        result = await self._session.execute(
            select(Service).where(Service.slug == slug)
        )
        return result.scalar_one_or_none()

    async def ensure(self, *, slug: str, title: str, sort: int) -> Service:
        obj = await self.get_by_slug(slug)
        if obj is None:
            obj = Service(slug=slug, title=title, sort=sort, is_active=True)
            self._session.add(obj)
        return obj

    async def ensure_default(self, *, slug: str, title: str, sort: int) -> Service:
        obj = await self.get_by_slug(slug)
        if obj is None:
            obj = Service(slug=slug, title=title, sort=sort, is_active=True)
            self._session.add(obj)
        return obj
