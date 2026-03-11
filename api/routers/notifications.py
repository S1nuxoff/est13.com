from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from est13_core.db.models.chat_message import ChatMessage
from est13_core.db.models.enums import LeadStatus, MessageDirection
from est13_core.db.models.lead import Lead
from est13_core.db.models.user import User

from ..deps import get_db, require_admin_token
from ..schemas.notifications import NotificationsOut
from ..services.support import auto_disable_expired_support


def register(app: FastAPI) -> None:
    @app.get("/api/notifications", dependencies=[Depends(require_admin_token)])
    async def notifications(
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> NotificationsOut:
        try:
            await auto_disable_expired_support(db)
        except Exception:
            pass

        total_row = await db.execute(
            select(func.count(ChatMessage.id))
            .where(ChatMessage.direction == MessageDirection.inbound)
            .where(ChatMessage.admin_seen_at.is_(None))
        )
        unread_total = int(total_row.scalar_one() or 0)

        outside_row = await db.execute(
            select(func.count(ChatMessage.id))
            .join(User, User.id == ChatMessage.user_id)
            .where(ChatMessage.direction == MessageDirection.inbound)
            .where(ChatMessage.admin_seen_at.is_(None))
            .where(ChatMessage.lead_id.is_(None))
            .where(User.support_enabled.is_(False))
        )
        unread_outside_brief = int(outside_row.scalar_one() or 0)

        lead_row = await db.execute(
            select(func.count(Lead.id))
            .where(Lead.status == LeadStatus.awaiting_review)
            .where(Lead.submitted_at.is_not(None))
            .where(Lead.accepted_at.is_(None))
        )
        unaccepted_leads = int(lead_row.scalar_one() or 0)

        return NotificationsOut(
            unread_total=unread_total,
            unread_outside_brief=unread_outside_brief,
            unaccepted_leads=unaccepted_leads,
        )
