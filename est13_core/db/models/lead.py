from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from est13_core.db.base import Base
from est13_core.db.models.enums import LeadSource, LeadStatus


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="RESTRICT"), index=True
    )

    # Tracks current question while lead is in progress (used for admin visibility and pausing/resuming flows).
    current_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[LeadStatus] = mapped_column(
        sa.Enum(LeadStatus, name="lead_status"),
        default=LeadStatus.filling,
        index=True,
    )

    source: Mapped[LeadSource] = mapped_column(
        sa.Enum(LeadSource, name="lead_source"),
        default=LeadSource.bot,
        index=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    accepted_by_admin_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admin_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
