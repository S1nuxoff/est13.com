from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base
from est13_core.db.models.enums import MessageDirection


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    direction: Mapped[MessageDirection] = mapped_column(
        sa.Enum(MessageDirection, name="message_direction"),
        index=True,
    )

    text: Mapped[str] = mapped_column(Text, default="")

    tg_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admin_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    admin_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    # Best-effort: considered "seen" when we receive any inbound message from the same user after it was sent.
    seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Best-effort: considered "seen by admins" when any admin opens the chat in the web UI.
    admin_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
