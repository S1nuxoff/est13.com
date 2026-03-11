from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base
from est13_core.db.models.enums import LeadStatus


class LeadEvent(Base):
    __tablename__ = "lead_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )

    from_status: Mapped[LeadStatus | None] = mapped_column(
        sa.Enum(LeadStatus, name="lead_status"),
        nullable=True,
        index=True,
    )
    to_status: Mapped[LeadStatus] = mapped_column(
        sa.Enum(LeadStatus, name="lead_status"),
        index=True,
    )

    admin_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
