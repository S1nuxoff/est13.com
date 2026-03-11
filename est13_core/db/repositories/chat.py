from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.chat_message import ChatMessage
from est13_core.db.models.enums import MessageDirection


class ChatRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def mark_outbound_seen(
        self, *, user_id: int, seen_at: datetime | None = None
    ) -> int:
        when = seen_at or datetime.now(timezone.utc)
        stmt = (
            sa_update(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .where(ChatMessage.direction == MessageDirection.outbound)
            .where(ChatMessage.seen_at.is_(None))
            .values(seen_at=when)
        )
        res = await self._session.execute(stmt)
        return int(res.rowcount or 0)

    async def mark_inbound_admin_seen(
        self,
        *,
        user_id: int,
        seen_at: datetime | None = None,
        up_to_id: int | None = None,
    ) -> int:
        when = seen_at or datetime.now(timezone.utc)
        stmt = (
            sa_update(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .where(ChatMessage.direction == MessageDirection.inbound)
            .where(ChatMessage.admin_seen_at.is_(None))
        )
        if up_to_id is not None:
            stmt = stmt.where(ChatMessage.id <= up_to_id)
        stmt = stmt.values(admin_seen_at=when)
        res = await self._session.execute(stmt)
        return int(res.rowcount or 0)

    async def add_inbound(
        self,
        *,
        user_id: int,
        text: str,
        tg_message_id: int | None = None,
        lead_id: int | None = None,
    ) -> ChatMessage:
        msg = ChatMessage(
            user_id=user_id,
            direction=MessageDirection.inbound,
            text=text,
            tg_message_id=tg_message_id,
            lead_id=lead_id,
        )
        self._session.add(msg)
        await self._session.flush()
        return msg

    async def add_outbound(
        self,
        *,
        user_id: int,
        text: str,
        tg_message_id: int | None = None,
        admin_tg_id: int | None = None,
        admin_id: int | None = None,
        lead_id: int | None = None,
    ) -> ChatMessage:
        msg = ChatMessage(
            user_id=user_id,
            direction=MessageDirection.outbound,
            text=text,
            tg_message_id=tg_message_id,
            admin_tg_id=admin_tg_id,
            admin_id=admin_id,
            lead_id=lead_id,
        )
        self._session.add(msg)
        await self._session.flush()
        return msg

    async def list_messages(
        self, *, user_id: int, limit: int = 50, before_id: int | None = None
    ) -> list[ChatMessage]:
        stmt = select(ChatMessage).where(ChatMessage.user_id == user_id)
        if before_id is not None:
            stmt = stmt.where(ChatMessage.id < before_id)
        stmt = stmt.order_by(desc(ChatMessage.id)).limit(limit)
        res = await self._session.execute(stmt)
        items = list(res.scalars().all())
        items.reverse()
        return items

    async def list_messages_after(
        self, *, user_id: int, after_id: int, limit: int = 200
    ) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .where(ChatMessage.id > after_id)
            .order_by(ChatMessage.id)
            .limit(limit)
        )
        res = await self._session.execute(stmt)
        return list(res.scalars().all())
